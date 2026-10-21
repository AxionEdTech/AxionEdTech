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
//
// Marks/Negative/Part are optional (default 2, 0.5, "A"). A leading "1)",
// "Q1:" etc. on the question line is stripped automatically. Any image link
// (pasted directly, or inserted via the "Add image" button) just becomes
// part of the question or option text — it renders as a picture automatically,
// the same as Notes and PYQs.

const OPTION_RE = /^([A-Da-d])[).:\-]\s*(.*)$/;
const ANSWER_RE = /^(?:ans(?:wer)?|correct(?:\s*answer)?)\s*[:.\-]?\s*([A-Da-d])\b/i;
const MARKS_RE = /^marks?\s*[:.\-]?\s*\+?([\d.]+)/i;
const NEG_RE = /^neg(?:ative)?(?:\s*marks?)?\s*[:.\-]?\s*-?([\d.]+)/i;
const PART_RE = /^part\s*[:.\-]?\s*([A-Ca-c])/i;
const LEADING_NUM_RE = /^(?:q\s*\d*\s*[:.)]\s*|\d+\s*[).]\s*)/i;

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

    for (const line of lines) {
      const optMatch = line.match(OPTION_RE);
      const ansMatch = line.match(ANSWER_RE);
      const marksMatch = line.match(MARKS_RE);
      const negMatch = line.match(NEG_RE);
      const partMatch = line.match(PART_RE);

      if (optMatch) { options[optMatch[1].toUpperCase()] = optMatch[2].trim(); seenOption = true; continue; }
      if (ansMatch) { correct = ansMatch[1].toUpperCase(); continue; }
      if (marksMatch) { marks = Number(marksMatch[1]); continue; }
      if (negMatch) { negative = Number(negMatch[1]); continue; }
      if (partMatch) { part = partMatch[1].toUpperCase(); continue; }
      if (!seenOption) questionLines.push(line);
    }

    if (questionLines.length === 0) {
      errors.push(`Question ${num}: couldn't find any question text.`);
      return;
    }
    const questionText = questionLines.join("\n").replace(LEADING_NUM_RE, "").trim();

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
      q.question,
      `A) ${q.option_a}`,
      `B) ${q.option_b}`,
      `C) ${q.option_c}`,
      `D) ${q.option_d}`,
      `Answer: ${q.correct_option}`,
      `Marks: ${q.marks}`,
      `Negative: ${q.negative_marks}`,
      `Part: ${q.part}`,
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

What is the SI unit of capacitance?
A) Farad
B) Henry
C) Ohm
D) Tesla
Answer: A
Marks: 2
Negative: 0.5
Part: A`;
