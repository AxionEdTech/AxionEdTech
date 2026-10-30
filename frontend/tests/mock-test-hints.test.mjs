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
