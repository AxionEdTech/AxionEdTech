// The Admin "Database update" boxes show migrations 4 and 5 so they can be copied with one click.
// Vercel builds from frontend/, which can't see ../supabase, so the app carries a copy of each.
// The files in supabase/ are the originals: edit THOSE, then run `npm run sync-sql`.
// (`npm test` fails if a copy ever differs from its original.)
import { copyFileSync } from "node:fs";

const FILES = [
  "migration_4_hints_and_results_cleanup.sql",
  "migration_5_plans_papers_exam_hub_question_bank.sql",
];
for (const f of FILES) {
  copyFileSync(new URL(`../../supabase/${f}`, import.meta.url), new URL(`../src/sql/${f}`, import.meta.url));
  console.log(`copied ${f} into src/sql/`);
}
