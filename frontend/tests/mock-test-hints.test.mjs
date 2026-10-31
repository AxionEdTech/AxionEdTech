// Hints and JSON validation for mock-test questions.
import test from "node:test";
import assert from "node:assert/strict";
import { parseQuestionsText, normalizeQuestions, questionsToText } from "../src/mockTestParser.js";

const t = (name, cond, extra = "") => test(name, () => assert.ok(cond, String(extra)));
// the user's own question, in Simple text, in their original one-line style
let r = parseQuestionsText(`What is the last (units) digit of the sum $7^{2026} + 3^{2026}$?
A) 0
B) 2
C) 6
D) 8
Ans: (D) | Hint: $2026 \\equiv 2 \\pmod 4$. Units digit of $7^2 + 3^2 = 9 + 9 = 18 \\rightarrow 8$.`);
t("original style: Ans: (D) | Hint: ... parses", r.errors.length === 0 && r.questions[0].correct_option === "D", JSON.stringify(r));
t("hint captured with its maths", r.questions[0].hint.startsWith("$2026 \\equiv 2") && r.questions[0].hint.includes("\\rightarrow 8$"), r.questions[0].hint);
r = parseQuestionsText(`Q1\nA) 1\nB) 2\nC) 3\nD) 4\nAnswer: B\nHint: first line\nsecond line of the hint\nMarks: 4`);
t("separate Hint: line, multi-line, then Marks still parsed", r.questions[0].hint === "first line\nsecond line of the hint" && r.questions[0].marks === 4, JSON.stringify(r.questions[0]));
r = parseQuestionsText(`Q1\nA) 1\nB) 2\nC) 3\nD) 4\nAnswer: B`);
t("no hint -> null", r.questions[0].hint === null);
r = parseQuestionsText(`Which is Bohr's model?\nA) x\nB) y\nC) z\nD) w\nAnswer: A\nExplanation: Bohr quantised orbits.`);
t("Explanation: works like Hint:", r.questions[0].hint === "Bohr quantised orbits.");
{ const h = parseQuestionsText(`Hint-based learning is?\nA) a\nB) b\nC) c\nD) d\nAnswer: A`); t("a question that merely starts with the word Hint is still a question", h.errors.length === 0 && h.questions[0].question === "Hint-based learning is?" && h.questions[0].hint === null, JSON.stringify(h)); }
// round trip
const rt = parseQuestionsText(questionsToText(parseQuestionsText(`Q one\nA) 1\nB) 2\nC) 3\nD) 4\nAnswer: C\nHint: because.\n\nQ two\nA) 1\nB) 2\nC) 3\nD) 4\nAnswer: A`).questions));
t("round trip keeps hints (and hint-less questions)", rt.errors.length === 0 && rt.questions[0].hint === "because." && rt.questions[1].hint === null, JSON.stringify(rt));

// JSON: exactly the user's structure, plus a hint
const json = [{ part: "A", question: "What is the last (units) digit of the sum $7^{2026} + 3^{2026}$?", option_a: "0", option_b: "2", option_c: "6", option_d: "8", correct_option: "D", marks: 2, negative_marks: 0.5, hint: "$2026 \\equiv 2 \\pmod 4$." }];
let n = normalizeQuestions(json);
t("JSON in the user's structure + hint validates", n.errors.length === 0 && n.questions[0].hint.startsWith("$2026") && n.questions[0].option_a === "0", JSON.stringify(n));
t("JSON without hint -> hint null", normalizeQuestions([{ ...json[0], hint: undefined }]).questions[0].hint === null);
n = normalizeQuestions([{ ...json[0], hint: undefined, correct_option: "(d)", part: "Part b", negative_marks: -0.25, marks: "4", explanation: "via alias" }]);
t("tidies d/(D)/Part b/-0.25/'4'/explanation", n.errors.length === 0 && n.questions[0].correct_option === "D" && n.questions[0].part === "B" && n.questions[0].negative_marks === 0.25 && n.questions[0].marks === 4 && n.questions[0].hint === "via alias", JSON.stringify(n));
n = normalizeQuestions([{ ...json[0], option_c: "" }, { ...json[0], correct_option: "E" }, "oops", { ...json[0], marks: "abc", part: "D" }]);
t("reports every problem with question numbers", n.errors.length === 4 && /Question 1: option_c is missing/.test(n.errors[0]) && /Question 2: correct_option must be A, B, C or D \(got "E"\)/.test(n.errors[1]) && /Question 3: expected an object/.test(n.errors[2]) && /Question 4: .*part must be A, B or C.*marks must be a number/.test(n.errors[3]), n.errors.join(" || "));
t("numeric option 0 is fine (not 'missing')", normalizeQuestions([{ ...json[0], option_a: 0 }]).errors.length === 0);
t("not-an-array is explained", normalizeQuestions({ a: 1 }).errors[0].includes("must be a list"));

// The JSON an AI tool produced for a real question: it carries an extra "image_prompt"
// field that the site doesn't use. Unknown fields must be ignored, not rejected.
{
  const real = [{
    part: "A",
    question: "What is the last (units) digit of the sum $7^{2026} + 3^{2026}$?",
    image_prompt: null,
    option_a: "0", option_b: "2", option_c: "6", option_d: "8",
    correct_option: "D",
    hint: "$2026 \\equiv 2 \\pmod 4$. Units digit of $7^2 + 3^2 = 9 + 9 = 18 \\rightarrow 8$.",
    marks: 2, negative_marks: 0.5,
  }];
  const n = normalizeQuestions(real);
  t("JSON with an extra image_prompt field is accepted and the field is ignored", n.errors.length === 0 && !("image_prompt" in n.questions[0]), JSON.stringify(n));
  t("...and its hint comes through intact", n.questions[0].hint === real[0].hint, n.questions[0].hint);
}

// ---- pictures in JSON questions ----
{
  const base = { part: "A", question: "Identify the circuit.", option_a: "1", option_b: "2", option_c: "3", option_d: "4", correct_option: "A" };
  const DRIVE = "https://drive.google.com/file/d/1AbC_dEf-123/view?usp=sharing";
  const one = (extra) => normalizeQuestions([{ ...base, ...extra }]);

  t("an AI image prompt (plain text) is ignored: not stored, not shown", (() => { const n = one({ image_prompt: "Clean 2D diagram of two trains on parallel tracks" }); return n.errors.length === 0 && n.questions[0].question === "Identify the circuit."; })());
  t("image_prompt: null is ignored", one({ image_prompt: null }).questions[0].question === "Identify the circuit.");
  t('"image" with a Drive link is added after the question text', one({ image: DRIVE }).questions[0].question === `Identify the circuit.\n\n${DRIVE}`);
  t('"image_url" and "image_link" work too', one({ image_url: DRIVE }).questions[0].question.endsWith(DRIVE) && one({ image_link: DRIVE }).questions[0].question.endsWith(DRIVE));
  t("a link placed in image_prompt is treated as the picture", one({ image_prompt: DRIVE }).questions[0].question.endsWith(DRIVE));
  t("a direct .png link is accepted", one({ image: "https://example.com/figures/q1.png" }).errors.length === 0);
  t("the link is not added twice if the question already contains it", one({ question: `See ${DRIVE}`, image: DRIVE }).questions[0].question === `See ${DRIVE}`);
  t("empty / null image is ignored", one({ image: "" }).questions[0].question === "Identify the circuit." && one({ image: null }).questions[0].question === "Identify the circuit.");
  t("something that is not an image link is reported, with the question number", (() => { const n = one({ image: "TBD" }); return n.errors.length === 1 && /Question 1: image must be a Google Drive share link/.test(n.errors[0]); })());
  t("a Drive FOLDER link is rejected (it would not show a picture)", one({ image: "https://drive.google.com/drive/folders/1AbC?usp=sharing" }).errors.length === 1);
}
