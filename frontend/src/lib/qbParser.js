// Bulk entry for the practice question bank. An admin pastes questions in a
// plain, forgiving format; parseQuestionBank() turns each one into the rows
// the database expects (the question, its options, its answer key).
//
//   Q: A particle of mass m ... what is the energy?
//   A) hbar*omega/2
//   B) hbar*omega
//   C) 3 hbar*omega/2
//   D) 2 hbar*omega
//   Answer: A
//   Explanation: Ground state of the harmonic oscillator ...
//   Difficulty: easy            (easy | medium | hard — default medium)
//   Source: CSIR NET Dec 2022   (optional)
//   Topic: Vector Analysis      (optional; overrides the Topic chosen above the box)
//   ---
//
// Kinds of question are worked out from the answer:
//   - options present, one letter   -> MCQ            Answer: B
//   - options present, several      -> multiple-select Answer: A, C
//   - no options, a number          -> numerical       Answer: 3.14   (Tolerance: 0.01 optional)
// An explicit "Type: mcq | msq | nat" line overrides the guess.
//
// Questions are separated by a line containing only "---". If there is no such
// line, a blank line separates them instead (fine unless an explanation or a
// table needs blank lines of its own).

import { separateTables } from "./richText.js";

const OPTION_RE = /^([A-Fa-f])[).:\-]\s*(.*)$/;
const ANSWER_RE = /^(?:ans(?:wer)?|correct(?:\s*answers?)?)\s*[:.\-]\s*(.+)$/i;
const EXPLANATION_RE = /^(?:explanation|solution|sol)\s*[:.\-]\s*(.*)$/i;
const DIFFICULTY_RE = /^difficulty\s*[:.\-]\s*(\w+)/i;
const TYPE_RE = /^type\s*[:.\-]\s*(\w+)/i;
const SOURCE_RE = /^source\s*[:.\-]\s*(.+)$/i;
const TOPIC_RE = /^topic\s*[:.\-]\s*(.+)$/i;
const TOLERANCE_RE = /^tolerance\s*[:.\-]\s*([\d.eE+-]+)/i;
const LEADING_RE = /^(?:q\s*\d*\s*[:.)]\s*|\d+\s*[).]\s*)/i;

const LETTERS = "ABCDEF";

function splitBlocks(raw) {
  const text = (raw || "").replace(/\r\n/g, "\n");
  const hasRules = /^\s*-{3,}\s*$/m.test(text);
  const parts = hasRules ? text.split(/^\s*-{3,}\s*$/m) : text.split(/\n\s*\n+/);
  return parts.map((b) => b.trim()).filter(Boolean);
}

function parseAnswerLetters(value) {
  return [...new Set(
    (value || "").toUpperCase().replace(/[^A-F,;&\s]/g, "").split(/[\s,;&]+/).filter(Boolean)
  )].sort();
}

export function parseQuestionBank(raw) {
  const questions = [];
  const errors = [];

  splitBlocks(raw).forEach((block, i) => {
    const num = i + 1;
    const lines = block.split("\n").map((l) => l.replace(/\s+$/, ""));
    const stem = [];
    const options = []; // option texts in order of appearance
    const explanation = [];
    let answerRaw = null;
    let difficulty = "medium";
    let explicitType = null;
    let source = null;
    let topic = null;
    let tolerance = 0;
    let mode = "stem"; // stem | options | explanation

    for (const line of lines) {
      const t = line.trim();
      if (!t && mode !== "explanation" && mode !== "stem") continue;
      let m;
      if ((m = t.match(ANSWER_RE))) { answerRaw = m[1].trim(); mode = "after"; continue; }
      if ((m = t.match(EXPLANATION_RE))) { explanation.push(m[1]); mode = "explanation"; continue; }
      if ((m = t.match(DIFFICULTY_RE))) { difficulty = m[1].toLowerCase(); mode = "after"; continue; }
      if ((m = t.match(TYPE_RE))) { explicitType = m[1].toLowerCase(); mode = "after"; continue; }
      if ((m = t.match(SOURCE_RE))) { source = m[1].trim(); mode = "after"; continue; }
      if ((m = t.match(TOPIC_RE))) { topic = m[1].trim().replace(/\s+/g, " ").slice(0, 120); mode = "after"; continue; }
      if ((m = t.match(TOLERANCE_RE))) { tolerance = Number(m[1]); mode = "after"; continue; }
      if (mode === "explanation") { explanation.push(line); continue; }
      if ((m = t.match(OPTION_RE)) && mode !== "after" && stem.length > 0) {
        // Options must run A, B, C… in order; anything else is just text.
        if (m[1].toUpperCase() === LETTERS[options.length]) {
          options.push(m[2]);
          mode = "options";
          continue;
        }
      }
      if (mode === "options" && options.length > 0) {
        options[options.length - 1] += `\n${t}`; // continuation of the previous option
        continue;
      }
      if (mode === "stem") stem.push(line);
    }

    const label = `Question ${num}`;
    const stemText = separateTables(stem.join("\n").trim().replace(LEADING_RE, "")).trim();
    if (!stemText) { errors.push(`${label}: the question text is empty.`); return; }
    if (answerRaw === null) { errors.push(`${label}: missing an "Answer:" line.`); return; }
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      errors.push(`${label}: Difficulty must be easy, medium or hard.`); return;
    }

    let qtype = explicitType;
    if (qtype && !["mcq", "msq", "nat"].includes(qtype)) {
      errors.push(`${label}: Type must be mcq, msq or nat.`); return;
    }
    if (!qtype) {
      if (options.length === 0) qtype = "nat";
      else qtype = parseAnswerLetters(answerRaw).length > 1 ? "msq" : "mcq";
    }

    let answerKey;
    if (qtype === "nat") {
      const value = Number(answerRaw.replace(/,/g, ""));
      if (!Number.isFinite(value)) { errors.push(`${label}: a numerical answer must be a number (got "${answerRaw}").`); return; }
      if (options.length > 0) { errors.push(`${label}: a numerical question should not have A) B) options.`); return; }
      answerKey = String(value);
    } else {
      if (options.length < 2) { errors.push(`${label}: needs at least two options (A, B, …).`); return; }
      const letters = parseAnswerLetters(answerRaw);
      const valid = LETTERS.slice(0, options.length).split("");
      if (letters.length === 0 || letters.some((l) => !valid.includes(l))) {
        errors.push(`${label}: the answer must be among ${valid.join(", ")}.`); return;
      }
      if (qtype === "mcq" && letters.length !== 1) {
        errors.push(`${label}: an MCQ has exactly one correct option (use "Type: msq" for several).`); return;
      }
      answerKey = letters.join(",");
    }

    questions.push({
      qtype,
      difficulty,
      content: stemText,
      options: qtype === "nat" ? [] : options.map((o) => o.trim()),
      source: source || null,
      topic: topic || null,
      answer_key: answerKey,
      nat_tolerance: qtype === "nat" && Number.isFinite(tolerance) ? Math.abs(tolerance) : 0,
      explanation: explanation.join("\n").trim(),
    });
  });

  return { questions, errors };
}

// One question back into the paste format — used to edit an existing question.
export function questionToText(q, answer) {
  const lines = [`Q: ${q.content}`];
  (q.options || []).forEach((o, i) => lines.push(`${LETTERS[i]}) ${o}`));
  lines.push(`Answer: ${answer?.answer_key ?? ""}`);
  lines.push(`Type: ${q.qtype}`);
  lines.push(`Difficulty: ${q.difficulty}`);
  if (q.source) lines.push(`Source: ${q.source}`);
  if (q.qtype === "nat" && Number(answer?.nat_tolerance) > 0) lines.push(`Tolerance: ${answer.nat_tolerance}`);
  if (answer?.explanation) lines.push(`Explanation: ${answer.explanation}`);
  return lines.join("\n");
}

export const SAMPLE_QB_TEXT = `Q: The ground-state energy of a one-dimensional harmonic oscillator is
A) $\\hbar\\omega/2$
B) $\\hbar\\omega$
C) $3\\hbar\\omega/2$
D) $2\\hbar\\omega$
Answer: A
Difficulty: easy
Explanation: $E_n = (n + \\tfrac12)\\hbar\\omega$, so $n=0$ gives $\\hbar\\omega/2$.
---
Q: Which of these are conserved for a particle in a central potential?
A) Energy
B) Angular momentum
C) Linear momentum
D) Parity of the wavefunction
Answer: A, B
Difficulty: medium
---
Q: The value of $\\sum_{n=1}^{\\infty} 1/n^2$ is $\\pi^2/k$. Find $k$.
Answer: 6
Difficulty: easy`;
