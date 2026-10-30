// Lets an admin paste a whole set of questions in a plain, forgiving,
// exam-paper-like format instead of hand-writing JSON (no quotes/commas/
// escaping to get right). This is the "Simple text" mode in the Mock Tests
// admin form; parseQuestionsText() turns it into exactly the same
// {part, question, option_a..d, correct_option, marks, negative_marks}
// shape the API already expects, so nothing downstream has to change.
//
// Expected shape per question, separated by a blank line:
//
//   What is the SI unit of capacitance?
//   A) Farad
//   B) Henry
//   C) Ohm
//   D) Tesla
//   Answer: A
//   Marks: 2
//   Negative: 0.5
//   Part: A
//   Hint: $2026 \equiv 2 \pmod 4$, so the units digit of $7^2 + 3^2$ is 8.
//
// Hint is optional and is shown only in the results review, after submitting.
// It may also follow the answer on the same line:  Answer: D | Hint: ...
// Marks/Negative/Part are optional (default 2, 0.5, "A"). A leading "1)",
// "Q1:" etc. on the question line is stripped automatically. Any image link
// (pasted directly, or inserted via the "Add image" button) just becomes
// part of the question or option text — it renders as a picture automatically,
// the same as Notes and PYQs. A table can sit between the question text and
// the options: write its rows on consecutive lines, each starting with "|"
// (the "Insert table" button or pasting cells from a spreadsheet does this).

import { separateTables } from "./richText.js";

const OPTION_RE = /^([A-Da-d])[).:\-]\s*(.*)$/;
const ANSWER_RE = /^(?:ans(?:wer)?|correct(?:\s*answer)?)\s*[:.\-]?\s*\(?\s*([A-Da-d])\s*\)?(?![A-Za-z0-9])/i;
const HINT_RE = /^(?:hint|explanation|solution)\s*:\s*(.*)$/i;
const INLINE_HINT_RE = /\s[|;]\s*(?:hint|explanation|solution)\s*:\s*(.*)$/i;
const MARKS_RE = /^marks?\s*[:.\-]?\s*\+?([\d.]+)/i;
const NEG_RE = /^neg(?:ative)?(?:\s*marks?)?\s*[:.\-]?\s*-?([\d.]+)/i;
const PART_RE = /^part\s*[:.\-]?\s*([A-Ca-c])/i;
const LEADING_NUM_RE = /^(?:q\s*\d*\s*[:.)]\s*|\d+\s*[).]\s*)/i;

// Question lines are joined with a single newline (a blank line would mean
// "next question" here), but a markdown table must be separated from the text
// around it by a blank line — otherwise the sentence after the table is read
// as one more table row. separateTables adds that blank line.
const joinQuestionLines = (lines) => separateTables(lines.join("\n"));

export function parseQuestionsText(raw) {
  const blocks = (raw || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions = [];
  const errors = [];

  blocks.forEach((block, i) => {
    const num = i + 1;
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const questionLines = [];
    const options = {};
    let correct = null;
    let marks = 2;
    let negative = 0.5;
    let part = "A";
    let seenOption = false;
    const hintLines = [];
    let inHint = false;

    for (const line of lines) {
      const hintMatch = line.match(HINT_RE);
      if (hintMatch) { hintLines.push(hintMatch[1]); inHint = true; continue; }
      const optMatch = line.match(OPTION_RE);
      const ansMatch = line.match(ANSWER_RE);
      const marksMatch = line.match(MARKS_RE);
      const negMatch = line.match(NEG_RE);
      const partMatch = line.match(PART_RE);

      if (optMatch) { options[optMatch[1].toUpperCase()] = optMatch[2].trim(); seenOption = true; inHint = false; continue; }
      if (ansMatch) {
        correct = ansMatch[1].toUpperCase();
        const inline = line.match(INLINE_HINT_RE); // "Answer: D | Hint: ..."
        inHint = !!inline;
        if (inline) hintLines.push(inline[1]);
        continue;
      }
      if (marksMatch) { marks = Number(marksMatch[1]); inHint = false; continue; }
      if (negMatch) { negative = Number(negMatch[1]); inHint = false; continue; }
      if (partMatch) { part = partMatch[1].toUpperCase(); inHint = false; continue; }
      if (inHint) { hintLines.push(line); continue; } // a hint can run over several lines
      if (!seenOption) questionLines.push(line);
    }

    if (questionLines.length === 0) {
      errors.push(`Question ${num}: couldn't find any question text.`);
      return;
    }
    const questionText = joinQuestionLines(questionLines).replace(LEADING_NUM_RE, "").trim();

    const missing = ["A", "B", "C", "D"].filter((L) => !options[L]);
    if (missing.length) {
      errors.push(`Question ${num}: missing option${missing.length > 1 ? "s" : ""} ${missing.join(", ")} (expected lines like "A) ...").`);
      return;
    }
    if (!correct) {
      errors.push(`Question ${num}: no "Answer:" line found (e.g. "Answer: B").`);
      return;
    }

    questions.push({
      part,
      question: questionText,
      option_a: options.A, option_b: options.B, option_c: options.C, option_d: options.D,
      correct_option: correct,
      marks,
      negative_marks: negative,
      hint: hintLines.length ? joinQuestionLines(hintLines).trim() || null : null,
    });
  });

  return { questions, errors };
}

// ---------- JSON mode ----------
// Hand-written or AI-written JSON is easy to get slightly wrong (a lowercase
// "d", a missing option, "-0.5" for the negative marks...). This checks it the
// way the Simple text parser does and tidies the harmless differences, so a
// mistake is reported before saving instead of being silently stored:
//  - correct_option: "d", "(D)", "Option D" -> "D"       part: "a", "Part B" -> "A"/"B"
//  - negative_marks: -0.5 -> 0.5 (it is always subtracted)
//  - hint: also accepted as "explanation" or "solution"
const text = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const asLetter = (v, allowed) => {
  const m = text(v).match(/^\(?\s*(?:option\s*|part\s*)?([A-Za-z])\s*\)?\.?$/i);
  const L = m ? m[1].toUpperCase() : null;
  return L && allowed.includes(L) ? L : null;
};

export function normalizeQuestions(list) {
  const questions = [];
  const errors = [];
  if (!Array.isArray(list)) {
    return { questions, errors: ["The questions must be a list: [ { ... }, { ... } ]."] };
  }
  list.forEach((raw, i) => {
    const num = i + 1;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`Question ${num}: expected an object { ... }.`);
      return;
    }
    const problems = [];
    const question = text(raw.question);
    if (!question) problems.push("the question text is empty");
    const opts = {};
    for (const L of ["a", "b", "c", "d"]) {
      opts[L] = text(raw[`option_${L}`]);
      if (!opts[L]) problems.push(`option_${L} is missing`);
    }
    const correct = asLetter(raw.correct_option ?? raw.answer, ["A", "B", "C", "D"]);
    if (!correct) problems.push(`correct_option must be A, B, C or D (got "${text(raw.correct_option ?? raw.answer)}")`);
    const part = text(raw.part) === "" ? "A" : asLetter(raw.part, ["A", "B", "C"]);
    if (!part) problems.push(`part must be A, B or C (got "${text(raw.part)}")`);
    const marks = text(raw.marks) === "" ? 2 : Number(raw.marks);
    if (!Number.isFinite(marks)) problems.push(`marks must be a number (got "${text(raw.marks)}")`);
    const negative = text(raw.negative_marks) === "" ? 0.5 : Math.abs(Number(raw.negative_marks));
    if (!Number.isFinite(negative)) problems.push(`negative_marks must be a number (got "${text(raw.negative_marks)}")`);
    if (problems.length) { errors.push(`Question ${num}: ${problems.join("; ")}.`); return; }
    questions.push({
      part, question,
      option_a: opts.a, option_b: opts.b, option_c: opts.c, option_d: opts.d,
      correct_option: correct, marks, negative_marks: negative,
      hint: text(raw.hint ?? raw.explanation ?? raw.solution) || null,
    });
  });
  return { questions, errors };
}

// The reverse conversion — used to pre-fill the Simple text box with a
// readable version of an existing test's questions when an admin re-opens it
// to edit, instead of dropping them back into raw JSON.
export function questionsToText(questions) {
  return questions.map((q) =>
    [
      // blank lines would split this into several questions when re-parsed;
      // the parser puts them back around tables by itself
      String(q.question).replace(/\n{2,}/g, "\n"),
      `A) ${q.option_a}`,
      `B) ${q.option_b}`,
      `C) ${q.option_c}`,
      `D) ${q.option_d}`,
      `Answer: ${q.correct_option}`,
      `Marks: ${q.marks}`,
      `Negative: ${q.negative_marks}`,
      `Part: ${q.part}`,
      ...(q.hint ? [`Hint: ${String(q.hint).replace(/\n{2,}/g, "\n")}`] : []),
    ].join("\n")
  ).join("\n\n");
}

export const SAMPLE_QUESTIONS_TEXT = `Which organelle is the primary site of ATP synthesis?
A) Golgi apparatus
B) Mitochondrion
C) Peroxisome
D) Lysosome
Answer: B
Marks: 2
Negative: 0.5
Part: A
Hint: ATP is made by oxidative phosphorylation, which happens in the inner mitochondrial membrane.

What is the SI unit of capacitance?
A) Farad
B) Henry
C) Ohm
D) Tesla
Answer: A
Marks: 2
Negative: 0.5
Part: A`;
