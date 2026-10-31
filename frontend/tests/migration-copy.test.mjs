// The app carries a copy of migration 4 (shown in Admin -> Mock Tests -> Database update).
// It must be identical to the original in supabase/.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("src/sql copy of migration 4 matches supabase/ (run `npm run sync-sql` if this fails)", () => {
  const original = readFileSync(new URL("../../supabase/migration_4_hints_and_results_cleanup.sql", import.meta.url), "utf8");
  const copy = readFileSync(new URL("../src/sql/migration_4_hints_and_results_cleanup.sql", import.meta.url), "utf8");
  assert.equal(copy, original);
});
