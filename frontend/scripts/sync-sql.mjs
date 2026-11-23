// The Admin "Database updates" box offers migrations 4, 5 and 6 for one-click copying.
// Vercel builds from frontend/, which can't see ../supabase, so the app carries a copy of each.
// The files in supabase/migrations/ are the originals: edit THOSE, then run `npm run sync-sql`.
// (`npm test` fails if a copy ever differs from its original.)
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SQL_COPIES = [
  "migration_4_hints_and_results_cleanup.sql",
  "migration_5_plans_papers_exam_hub_question_bank.sql",
  "migration_6_phone_number_and_fixes.sql",
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const f of SQL_COPIES) {
    copyFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), new URL(`../src/sql/${f}`, import.meta.url));
    console.log(`copied ${f} into src/sql/`);
  }
}
