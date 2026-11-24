import test from "node:test";
import assert from "node:assert/strict";
import { parseQuestionBank } from "../src/lib/qbParser.js";
import { normalizeExams, examsFromSettings, examsToSetting, DEFAULT_EXAMS, EXAMS_SETTING_KEY } from "../src/lib/exams.js";

test("Topic: line is read per question and tidied", () => {
  const { questions, errors } = parseQuestionBank(`Q: Curl of a gradient is
A) 0
B) 1
Answer: A
Topic:   Vector   Analysis
---
Q: No topic here
A) x
B) y
Answer: B`);
  assert.deepEqual(errors, []);
  assert.equal(questions[0].topic, "Vector Analysis");
  assert.equal(questions[1].topic, null);
});

test("a Topic: line inside the stem area does not become question text", () => {
  const { questions } = parseQuestionBank("Q: What is 2+2?\nTopic: Arithmetic\nAnswer: 4");
  assert.equal(questions[0].content, "What is 2+2?");
  assert.equal(questions[0].topic, "Arithmetic");
});

test("exam list: trims, drops blanks and case-insensitive duplicates", () => {
  const out = normalizeExams([{ name: "  IIT  JAM " }, { name: "iit jam" }, { name: "" }, { name: "GATE", featured: 1, blurb: " x " }]);
  assert.deepEqual(out, [{ name: "IIT JAM", blurb: "", featured: false }, { name: "GATE", blurb: "x", featured: true }]);
});

test("exam list: falls back to defaults when unsaved, empty or broken", () => {
  assert.equal(examsFromSettings({}), DEFAULT_EXAMS);
  assert.equal(examsFromSettings({ [EXAMS_SETTING_KEY]: "not json" }), DEFAULT_EXAMS);
  assert.equal(examsFromSettings({ [EXAMS_SETTING_KEY]: "[]" }), DEFAULT_EXAMS);
  const saved = examsToSetting([{ name: "JEST", featured: true }, { name: "TIFR" }]);
  assert.deepEqual(examsFromSettings({ [EXAMS_SETTING_KEY]: saved }).map((e) => e.name), ["JEST", "TIFR"]);
});

test("defaults keep CSIR NET, GATE, JEST on the Home page", () => {
  assert.deepEqual(DEFAULT_EXAMS.filter((e) => e.featured).map((e) => e.name), ["CSIR NET", "GATE", "JEST"]);
});
