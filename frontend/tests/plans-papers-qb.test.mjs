import test from "node:test";
import assert from "node:assert/strict";
import { parseDriveFileId, drivePreviewUrl, driveViewUrl } from "../src/drivePdf.js";
import { parseQuestionBank, questionToText, SAMPLE_QB_TEXT } from "../src/qbParser.js";
import {
  effectivePlan, planRank, planRelation, featuresAddedBy, planIncludes, FEATURES, daysLeft,
  activePeriods, formatPrice, PERIODS,
} from "../src/plans.js";

// ---- Drive PDF links ----
test("Drive share link -> embeddable preview", () => {
  const link = "https://drive.google.com/file/d/1AbC_dEf-1234567890xyz/view?usp=sharing";
  assert.equal(drivePreviewUrl(link), "https://drive.google.com/file/d/1AbC_dEf-1234567890xyz/preview");
  assert.equal(driveViewUrl(link), "https://drive.google.com/file/d/1AbC_dEf-1234567890xyz/view");
});
test("Drive open?id= link and bare id both work", () => {
  assert.equal(parseDriveFileId("https://drive.google.com/open?id=1AbC_dEf-1234567890xyz"), "1AbC_dEf-1234567890xyz");
  assert.equal(parseDriveFileId("1AbC_dEf-1234567890xyz"), "1AbC_dEf-1234567890xyz");
});
test("non-Drive text gives no viewer", () => {
  assert.equal(drivePreviewUrl("https://example.com/paper.pdf"), null);
  assert.equal(drivePreviewUrl(""), null);
  assert.equal(drivePreviewUrl(null), null);
});

// ---- Plans overlap ----
test("plans are ordered and overlap", () => {
  assert.ok(planRank("complete") > planRank("notes_mock"));
  assert.ok(planRank("notes_mock") > planRank("mock"));
  assert.ok(planRank("mock") > planRank("free"));
  assert.equal(planRank("nonsense"), 0);
  const notesFeature = FEATURES.find((f) => f.since === "notes_mock");
  assert.ok(planIncludes("complete", notesFeature));
  assert.ok(planIncludes("notes_mock", notesFeature));
  assert.ok(!planIncludes("mock", notesFeature));
  const mockFeature = FEATURES.find((f) => f.since === "mock");
  assert.ok(planIncludes("notes_mock", mockFeature), "higher plan includes lower plan features");
  assert.ok(featuresAddedBy("free").length > 0 && featuresAddedBy("complete").length > 0);
});
test("effective plan honours expiry and admin", () => {
  const now = new Date("2026-11-08T00:00:00Z");
  assert.equal(effectivePlan(null, now), "free");
  assert.equal(effectivePlan({ plan: "mock", plan_expires_at: "2027-01-01T00:00:00Z" }, now), "mock");
  assert.equal(effectivePlan({ plan: "mock", plan_expires_at: "2026-10-01T00:00:00Z" }, now), "free");
  assert.equal(effectivePlan({ plan: "complete", plan_expires_at: null }, now), "complete", "no expiry = does not lapse");
  assert.equal(effectivePlan({ plan: "free", role: "admin" }, now), "complete");
  assert.equal(effectivePlan({ plan: "paid" }, now), "free", "legacy value is not trusted client-side");
});
test("plan relations drive Upgrade / Renew / Included buttons", () => {
  assert.equal(planRelation("mock", "mock"), "current");
  assert.equal(planRelation("complete", "mock"), "included");
  assert.equal(planRelation("free", "notes_mock"), "upgrade");
});
test("days left, prices and billing periods", () => {
  const now = new Date("2026-11-08T00:00:00Z");
  assert.equal(daysLeft("2026-11-18T00:00:00Z", now), 10);
  assert.equal(daysLeft(null, now), null);
  assert.equal(formatPrice(1499), "\u20B91,499");
  assert.equal(formatPrice(null), null);
  const plans = [
    { id: "free" }, { id: "mock", price_monthly: 199, price_yearly: 1799 },
    { id: "notes_mock", price_monthly: 349 }, { id: "complete" },
  ];
  assert.deepEqual(activePeriods(plans).map((p) => p.id), ["monthly", "yearly"]);
  assert.equal(PERIODS.length, 4);
});

// ---- Question bank bulk parser ----
test("sample question bank text parses with no errors", () => {
  const { questions, errors } = parseQuestionBank(SAMPLE_QB_TEXT);
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 3);
  assert.deepEqual(questions.map((q) => q.qtype), ["mcq", "msq", "nat"]);
  assert.equal(questions[0].answer_key, "A");
  assert.equal(questions[1].answer_key, "A,B");
  assert.equal(questions[2].answer_key, "6");
  assert.equal(questions[0].options.length, 4);
  assert.equal(questions[0].explanation.includes("n=0"), true);
  assert.deepEqual(questions[2].options, []);
});
test("errors are reported per question, good ones still parse", () => {
  const { questions, errors } = parseQuestionBank(`Q: Fine?\nA) yes\nB) no\nAnswer: A\n---\nQ: No answer given\nA) x\nB) y\n---\nQ: Bad letter\nA) x\nB) y\nAnswer: D\n---\nQ: Not a number\nAnswer: abc`);
  assert.equal(questions.length, 1);
  assert.equal(errors.length, 3);
  assert.ok(errors[0].startsWith("Question 2"));
});
test("multi-line explanation, tolerance and source are kept", () => {
  const { questions, errors } = parseQuestionBank(`Q: Compute g.\nAnswer: 9.8\nTolerance: 0.1\nSource: CSIR NET Jun 2021\nExplanation: Use Newton.\n\nSecond paragraph of the solution.\n---`);
  assert.deepEqual(errors, []);
  assert.equal(questions[0].nat_tolerance, 0.1);
  assert.equal(questions[0].source, "CSIR NET Jun 2021");
  assert.ok(questions[0].explanation.includes("Second paragraph"));
});
test("blank-line separation works when there is no --- line", () => {
  const { questions } = parseQuestionBank(`Q: One\nA) a\nB) b\nAnswer: A\n\nQ: Two\nA) a\nB) b\nAnswer: B`);
  assert.equal(questions.length, 2);
});
test("MCQ with two answers is rejected unless Type: msq", () => {
  assert.equal(parseQuestionBank(`Q: x\nA) a\nB) b\nC) c\nAnswer: A,B\nType: mcq`).errors.length, 1);
  assert.equal(parseQuestionBank(`Q: x\nA) a\nB) b\nC) c\nAnswer: A,B`).errors.length, 0);
});
test("editing round-trip keeps the question and answer", () => {
  const { questions } = parseQuestionBank(SAMPLE_QB_TEXT);
  const q = questions[0];
  const text = questionToText(q, { answer_key: q.answer_key, nat_tolerance: 0, explanation: q.explanation });
  const again = parseQuestionBank(text);
  assert.deepEqual(again.errors, []);
  assert.equal(again.questions[0].content, q.content);
  assert.deepEqual(again.questions[0].options, q.options);
  assert.equal(again.questions[0].answer_key, q.answer_key);
});

// ---- Updates centre helpers ----
import { sortUpdates, upcomingDates, daysUntil, categoryLabel } from "../src/updates.js";
test("updates: pinned first, then newest", () => {
  const sorted = sortUpdates([
    { id: 1, is_pinned: false, created_at: "2026-11-01T00:00:00Z" },
    { id: 2, is_pinned: false, created_at: "2026-11-05T00:00:00Z" },
    { id: 3, is_pinned: true, created_at: "2026-10-01T00:00:00Z" },
  ]);
  assert.deepEqual(sorted.map((x) => x.id), [3, 2, 1]);
});
test("updates: upcoming dates only include today or later, soonest first", () => {
  const today = new Date(2026, 10, 8);
  const items = [
    { id: 1, event_date: "2026-11-07" }, { id: 2, event_date: "2026-12-01" },
    { id: 3, event_date: "2026-11-08" }, { id: 4, event_date: null },
  ];
  assert.deepEqual(upcomingDates(items, today).map((x) => x.id), [3, 2]);
  assert.equal(daysUntil("2026-11-18", today), 10);
  assert.equal(categoryLabel("admit_card"), "Admit card");
  assert.equal(categoryLabel("nope"), "General");
});

// ---- Dashboard analytics ----
import { summarizeAttempts, attemptPercent, sparkPoints } from "../src/analytics.js";
test("analytics: summary of submitted attempts only", () => {
  const s = summarizeAttempts([
    { submitted_at: "2026-10-01T00:00:00Z", score: 60, max_score: 100, correct_count: 30, wrong_count: 10 },
    { submitted_at: "2026-10-05T00:00:00Z", score: 80, max_score: 100, correct_count: 40, wrong_count: 0 },
    { submitted_at: null, score: null, max_score: null },
  ]);
  assert.equal(s.count, 2);
  assert.equal(s.avgPct, 70);
  assert.equal(s.bestPct, 80);
  assert.equal(s.accuracy, 88);
  assert.deepEqual(s.series, [60, 80]);
});
test("analytics: empty, negative score and chart points", () => {
  assert.deepEqual(summarizeAttempts([]).series, []);
  assert.equal(attemptPercent({ score: -4, max_score: 100 }), 0);
  assert.equal(sparkPoints([]), "");
  assert.equal(sparkPoints([50, 100]).split(" ").length, 2);
});

// ---- Re-ordering notes must never change a note's plan ----
test("a position-only update leaves the plan alone", async () => {
  // withPlan is private to api.js, so check the source contract directly.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/api.js", import.meta.url), "utf8");
  assert.match(src, /payload\.min_plan === undefined\) return payload/);
});

// ---- Mock test marking patterns ----
import { EXAM_PATTERNS, applyPattern, patternSummary } from "../src/examPatterns.js";
test("CSIR NET pattern: marks and negative marks follow the part", () => {
  const out = applyPattern(
    [{ part: "A", marks: 9, negative_marks: 9 }, { part: "b" }, { part: "C" }, { part: "Z", marks: 1, negative_marks: 0 }],
    EXAM_PATTERNS.csir_net_physics
  );
  assert.deepEqual(out.map((q) => [q.marks, q.negative_marks]), [[2, 0.5], [3.5, 0.875], [5, 1.25], [1, 0]]);
});
test("CSIR NET pattern adds up to 200 marks and 75 questions", () => {
  const parts = EXAM_PATTERNS.csir_net_physics.parts;
  assert.equal(parts.reduce((s, p) => s + p.total, 0), 75);
  assert.equal(parts.reduce((s, p) => s + p.attempt * p.marks, 0), 200);
});
test("pattern summary compares counts with the real paper", () => {
  const qs = [...Array(20)].map(() => ({ part: "A" })).concat([...Array(3)].map(() => ({ part: "B" })));
  const sum = patternSummary(qs, EXAM_PATTERNS.csir_net_physics);
  assert.equal(sum[0].complete, true);
  assert.equal(sum[1].message, "Part B: 3 of 25 questions");
  assert.equal(sum[2].have, 0);
  assert.deepEqual(patternSummary(qs, null), []);
});

// ---- Links, social handles, downloads ----
import { safeUrl } from "../src/links.js";
import { socialLinks, orderCategories } from "../src/social.js";
import { driveDownloadUrl } from "../src/drivePdf.js";
test("only web links are allowed through", () => {
  assert.equal(safeUrl("https://instagram.com/axionedtech"), "https://instagram.com/axionedtech");
  assert.equal(safeUrl("  http://example.com "), "http://example.com/");
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("data:text/html,x"), null);
  assert.equal(safeUrl("not a url"), null);
  assert.equal(safeUrl(""), null);
});
test("social links: empty and unsafe ones are dropped, order is stable", () => {
  const out = socialLinks({ instagram_url: "https://instagram.com/x", youtube_url: "", telegram_url: "javascript:1", linkedin_url: "https://linkedin.com/company/x" });
  assert.deepEqual(out.map((s) => s.key), ["instagram_url", "linkedin_url"]);
});
test("download categories: known first in fixed order, new ones after", () => {
  assert.deepEqual(orderCategories(["Other", "Zebra", "Cheat Sheets", "Previous Year Papers", "Alpha", "Cheat Sheets"]),
    ["Previous Year Papers", "Cheat Sheets", "Other", "Alpha", "Zebra"]);
});
test("Drive direct-download link", () => {
  assert.equal(driveDownloadUrl("https://drive.google.com/file/d/1AbC_dEf-1234567890xyz/view"),
    "https://drive.google.com/uc?export=download&id=1AbC_dEf-1234567890xyz");
  assert.equal(driveDownloadUrl("https://example.com/x.pdf"), null);
});
