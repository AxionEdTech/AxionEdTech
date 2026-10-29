import test from "node:test";
import assert from "node:assert/strict";
import { parseQuestionsText, questionsToText } from "../src/mockTestParser.js";

const check = (name, cond) => test(name, () => assert.ok(cond));
const D = "https://drive.google.com/file/d/1AbC_dEf-123/view?usp=sharing";
// mock-test text parser: tables, Drive links in options, and edit round-trips
const src = `Match the following:
| List I | List II |
| --- | --- |
| a | 1 |
| b | 2 |
Which pairing is correct?
A) a-1, b-2
B) ${D}
C) a-2
D) none
Answer: A
Marks: 4
Negative: 1
Part: B

Plain question with picture ${D} in the middle
A) one
B) two
C) three
D) four
Answer: C`;
const { questions, errors } = parseQuestionsText(src);
check("no errors", errors.length === 0);
check("two questions", questions.length === 2);
check("blank line before table", questions[0].question.includes("Match the following:\n\n| List I"));
check("blank line after table", questions[0].question.includes("| b | 2 |\n\nWhich pairing"));
check("option keeps drive link", questions[0].option_b === D);
check("marks/neg/part parsed", questions[0].marks === 4 && questions[0].negative_marks === 1 && questions[0].part === "B");
check("plain question untouched", questions[1].question === `Plain question with picture ${D} in the middle`);
// round trip: edit -> text -> parse gives identical questions
const again = parseQuestionsText(questionsToText(questions));
check("round trip: no errors", again.errors.length === 0);
check("round trip: identical", JSON.stringify(again.questions) === JSON.stringify(questions));
