// The Admin "Database update" box shows migration 4 so it can be copied with one click.
// Vercel builds from frontend/, which can't see ../supabase, so the app carries a copy.
// supabase/migration_4_hints_and_results_cleanup.sql is the original: edit THAT one,
// then run `npm run sync-sql`. (`npm test` fails if the two ever differ.)
import { copyFileSync } from "node:fs";
copyFileSync(new URL("../../supabase/migration_4_hints_and_results_cleanup.sql", import.meta.url), new URL("../src/sql/migration_4_hints_and_results_cleanup.sql", import.meta.url));
console.log("copied migration 4 into src/sql/");
