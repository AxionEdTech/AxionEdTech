// The app carries copies of migrations 4 and 5 (shown in the Admin "Database update" boxes).
// Each must be identical to the original in supabase/.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const f of ["migration_4_hints_and_results_cleanup.sql", "migration_5_plans_papers_exam_hub_question_bank.sql"]) {
  test(`src/sql copy of ${f} matches supabase/ (run \`npm run sync-sql\` if this fails)`, () => {
    const original = readFileSync(new URL(`../../supabase/${f}`, import.meta.url), "utf8");
    const copy = readFileSync(new URL(`../src/sql/${f}`, import.meta.url), "utf8");
    assert.equal(copy, original);
  });
}
