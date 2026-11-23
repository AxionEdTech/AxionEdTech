// The app carries copies of the migrations shown in the Admin "Database updates" box.
// Each must be identical to the original in supabase/migrations/.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SQL_COPIES } from "../scripts/sync-sql.mjs";

for (const f of SQL_COPIES) {
  test(`src/sql copy of ${f} matches supabase/migrations/ (run \`npm run sync-sql\` if this fails)`, () => {
    const original = readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), "utf8");
    const copy = readFileSync(new URL(`../src/sql/${f}`, import.meta.url), "utf8");
    assert.equal(copy, original);
  });
}
