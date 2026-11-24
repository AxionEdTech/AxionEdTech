# Changelog

Newest first. Entries before v1.1 use the old file locations — see the table under v1.1.

## v1.2 — November 2026: exams list, question-bank topics, finished-test cards

**Database:** run `supabase/migrations/migration_7_question_bank_topics.sql` once (the Admin page
offers it with a Copy button). Safe to run again. Result row: `true, true`.

### New
- **Exams are managed in Admin → Exam Info → "Exams on the website"**: add an exam, remove one, move it
  up/down, give it a short description, and tick *Home page* for the ones shown as big cards on the Home
  page and in the footer. Saved in site settings (no database update). Removing an exam only stops it
  being listed — its papers, notes, tests and information stay.
- The "Information is being added" lines are gone from the Exams page and exam pages.
- **Question Bank topics**: each question can have a Topic inside its unit (e.g. Mathematical Methods of
  Physics › Vector Analysis). Set it above the paste box in Admin → Question Bank, or per question with a
  `Topic:` line. Existing topics are suggested so spellings stay the same; the admin list filters by topic.
- The Question Bank page has **Subject-wise** and **Topic-wise** views, like Mock Tests. Inside a unit,
  topic tabs switch between "All topics" and one topic, with counts.
- **Mock test cards remember your attempts**: a submitted test shows its score with **View result** and
  **Reset** (start again — the earlier result stays in My Results); an unfinished one shows **Resume test**.

### Fixed
- Dashboard → "Recently viewed notes" kept showing deleted notes. The list is now checked against the
  notes that exist (and picks up renamed titles); opening a deleted note's old link also removes it.

## v1.1 — November 2026: phone number at sign-up, bug fixes, tidier layout

**Database:** run `supabase/migrations/migration_6_phone_number_and_fixes.sql` once (the Admin page
offers it with a Copy button). Safe to run again. Result row: `true, true, true`.

### New
- **Phone number at sign-up** — an optional "Phone number" box on the Register page. It is not
  checked or verified; it is saved on the student's profile as extra contact information.
- **Admin → Students & Subscriptions** shows each student's phone (tap to call on a phone), searches
  by phone too, and has **Download list (CSV)** for Excel / Google Sheets.
- **Admin page grouped** into *Study content*, *Students & plans* and *Website*. The open tab stays in
  the address (`/admin?tab=subs`), so a refresh or bookmark returns to it. The "Saved." message stays
  visible while you scroll.
- **One database-update box** at the top of Admin checks updates 4, 5 and 6 in order (replaces the two
  separate boxes).

### Fixed
- **Background watermark** was a 560 px square pushed off the bottom-right corner (mostly cut off, and
  wider than a phone screen). It is now a transparent logo, centred under the header and sized to fit
  any screen. The sign-up/login logo lost its off-white box the same way.
- **Admin → PYQs (text) could not save** on databases built from these scripts: the old separate
  question/option columns were still required. (Migration 6.)
- **Previous Year Papers: clicking an exam tab did nothing** — two address updates in a row, the second
  undoing the first.
- **Mock tests**
  - The countdown fell behind when the tab was in the background (browsers slow timers there); it now
    reads the clock each second, measured from the server's start time.
  - An answer whose save failed (bad connection) looked saved but was graded as blank. Saves now go out
    in order, a warning shows if any hasn't reached the server, they are re-sent when the connection
    returns, and **Submit makes sure all of them are saved first**.
  - A failed submit replaced the whole test with an error; it now shows in the dialog with **Try again**.
  - **Previous** can step back from the first question of Part B into Part A.
  - Leaving the page mid-test asks first.
  - The database now refuses answers sent after the time is up (plus 2 minutes' grace). (Migration 6.)
- **Pages reloading by themselves**: the login listener re-loaded the profile on every hourly token
  refresh (and when the tab regained focus), which reset the Question Bank list mid-practice. It now
  reloads only when a different person signs in, and no longer makes database calls inside Supabase's
  callback (which can freeze the app on "Loading…").
- Question bank: an answer key typed as `b` or `A, C` is highlighted correctly.
- "Log in" buttons return you to the page you were on, not always the dashboard. Visiting
  `/login` or `/register` while signed in goes to the dashboard.
- Exam pages with `%` in the name no longer crash.
- Links typed in Admin (author profiles, update links, WhatsApp/Telegram) only become clickable if they
  are real web addresses.
- Students could change the email shown on their own profile from the browser console. (Migration 6.)
- Pinch-to-zoom works on phones again (useful for equations).

### Moved files
| Before                                   | Now                                              |
|------------------------------------------|--------------------------------------------------|
| `frontend/src/*.js` helpers               | `frontend/src/lib/`                              |
| `src/AuthContext.jsx`, `usePlans.jsx`, `useAnnouncements.js` | `src/context/`             |
| `src/richContent.jsx`                    | `src/components/RichContent.jsx`                 |
| `src/styles.css`, `src/site.css`         | `src/styles/base.css`, `src/styles/site.css`     |
| `src/components/DatabaseUpdatePanel.jsx`, `PlansUpdatePanel.jsx` | `src/components/admin/DatabaseUpdates.jsx` |
| `supabase/schema.sql`, `migration_2…5`   | `supabase/migrations/migration_1_schema.sql`, `migration_2…6` |
| `supabase/reset_before_rebuild.sql`, `backfill_existing_users.sql` | `supabase/tools/`      |
| `public/logo-watermark.png`              | `public/logo-transparent.png` (now truly transparent) |

## Mid 2026 — Content organisation upgrade

## What changed
1. **frontend/src/taxonomy.js (NEW)** — single source of truth for the list AND
   display order of Exams, Subjects and Units. Edit this file to add a unit/exam.
2. **AdminPanel.jsx** — Exam / Subject / Unit are now dropdowns (not free text),
   so section names can never fragment from typos or casing. Unit list depends on
   the chosen Subject (e.g. Physics -> Quantum Mechanics, Classical Mechanics...).
3. **Notes.jsx** — sections now render in syllabus order (taxonomy), not
   alphabetical.
4. **PYQ.jsx** — exam tabs and exam sections render in taxonomy order
   (CSIR NET, GATE, JEST ...); years remain newest-first.

## Not changed (already working)
- LaTeX (`$...$`, `$$...$$`) and images (`![cap](url)` or bare image link) already
  render in Notes, PYQ, Mock Test attempt AND result via richContent.jsx.
- Premium/paid toggle.

## No database migration required
This upgrade is client-side only and works with your existing schema
(notes.exam/subject/unit, pyqs.exam/subject/year/part).

### Optional: clean up old inconsistent rows
If earlier free-text entries created duplicate sections, normalise them once in
Supabase SQL editor, e.g.:
```sql
update public.notes set unit = 'Quantum Mechanics'
  where lower(unit) in ('qm','quantum mechanics','quantum mechnaics');
update public.pyqs set exam = 'CSIR NET'
  where lower(replace(exam,'-',' ')) = 'csir net';
```

## Deploy
Root Directory on Vercel must be `frontend`. Commit and push:
```
git add -A && git commit -m "Controlled taxonomy + ordered sections for notes/PYQ/admin" && git push origin main
```


## July 2026 UI upgrade
- Dashboard redesigned for multiple exams with filter-oriented navigation and responsive layout.
- Notes lists are numbered and ordered by `position` where supplied.
- Previous Papers use a continuous booklet layout, sequential global numbering, 10-question pagination, and reset pagination upon filter changes.
- Direct image URLs ending in supported image extensions already render through `richContent.jsx`; Markdown image syntax is supported too.
- `AdSlot.jsx` is opt-in and safe by default. Use only after ad-network approval; do not use in mock attempts or next to answers.

## September 2026 — Notice board, guest preview tier, PYQ sessions
**Run `supabase/migration_3_notice_board_and_access_tiers.sql` in Supabase → SQL Editor before deploying this frontend build.** It's additive/idempotent and safe on your live database. See the comments inside for exactly what it does; in short:

1. **Notice board** — a new "Notices" tab in Admin posts short updates (title,
   message, pin-to-top, show/hide). They appear on the public Home page and
   on the logged-in Dashboard, newest-and-pinned first.
2. **Three access tiers, enforced in the database (not just hidden in the UI)**:
   - **Guest (no account)** — sees the home page, and only notes/PYQs/mock
     tests an admin has explicitly checked "Show to visitors without logging
     in". For mock tests this only ever means the catalog (title, exam,
     subject, duration, question count) — never the actual questions, and
     starting an attempt always requires an account since a score has to
     belong to somebody.
   - **Free account** — sees all non-"Paid plan only" notes, PYQs, and mock
     tests, in full.
   - **Paid plan** — sees everything, same as before.
   `/notes`, `/pyqs`, and `/tests` no longer require login to open at all;
   Row Level Security is what actually decides how much content comes back
   for each visitor, so there's no way to see more by tinkering with the page.
3. **PYQ sessions** — a new optional "Session" field (e.g. `June`, `December`)
   sits alongside Year, so an exam held twice a year (CSIR NET) can have two
   distinct papers for the same year instead of colliding. Leave it blank for
   exams that run once a year.
4. **Manual note ordering** — Admin → Notes → "Reorder notes" now lets you
   move a whole topic, or a single note within it, up or down with one click.
   Notes you haven't touched keep the existing syllabus-based order
   automatically (see `frontend/src/noteOrdering.js`).
5. **PYQ admin bug fix** — the PYQ editor already asked for a single
   `content` field (question + options + answer as one block), but no
   migration had ever added that column to the live `pyqs` table, so saving
   a PYQ was almost certainly failing. `migration_3` adds it and
   best-effort backfills anything left over in the older structured columns.
6. **Branding** — the new circular logo now appears in the navbar, the
   favicon, and both auth screens; the accent color moved from green to the
   blue used in the logo.
7. **Mock Test admin: bulk entry + Google Drive images** — Admin → Mock Tests
   now defaults to a plain-text "Simple text" box: paste a whole set of
   questions at once (question, `A)`–`D)`, `Answer: B`, optional
   `Marks:`/`Negative:`/`Part:`), separated by a blank line — no JSON
   quoting/escaping to get right, and it shows a live "N questions ready" +
   a clear per-question error list as you type (see
   `frontend/src/mockTestParser.js`). The old JSON box is still there as
   "Advanced" for anyone who prefers it. An "Add image from Drive" button
   (also added to Notes and PYQs) converts a pasted Google Drive share link
   into a working image and drops it in at the cursor — nothing is uploaded
   to Supabase, so it costs no storage on our side; the file just needs to be
   shared as "Anyone with the link can view" (see `frontend/src/driveImage.js`).
   The actual exam-taking screen (`MockTestAttempt.jsx`/`MockTestResult.jsx`,
   CSIR-NET-style timer, parts, palette, marking) was **not** touched.
8. **Author / About info in the footer** — a new Admin → Author tab manages
   a small "about the creator" block (name, photo via a Drive link, short
   bio, email, Instagram, YouTube, website) that now shows in the footer on
   every page except the exam-attempt screen. Supports more than one entry
   (e.g. a co-author) — each can be hidden independently without deleting it.
   Fully editable without a redeploy.

## October 2026 — Tables, pictures in place, previews
**No database migration needed** — this is a front-end change only (notes, PYQs and mock-test
questions are still stored as plain text, so everything already saved keeps working).

### Pictures (Google Drive)
Paste the Drive **share link** anywhere in the text and the picture appears *exactly there*:
between two sentences, on its own line, inside a table cell, or as a whole mock-test option
(`A) https://drive.google.com/file/d/…/view?usp=sharing`). The "Add image from Drive" button
still works too. The Drive file must be shared as **"Anyone with the link can view"**.

- Works in Notes, PYQs, Notices, and mock-test questions/options — in both Simple text and JSON.
- A link written as `[my text](link)` stays an ordinary link (use that for a PDF or any
  Drive file that is *not* a picture). Links inside `` `code` `` stay literal text.
- While a picture loads it holds its place in a framed box, so the text doesn't jump. If it
  can't load (usually sharing isn't "Anyone with the link"), students see a short message
  instead of a silent gap.

### Tables
- **Insert table** (Notes, PYQs, Mock Tests): pick columns/rows, type into the grid, insert.
  Empty rows are left out. The first row is the heading row.
- **Paste from Excel / Google Sheets / Word**: copy the cells and paste into the text box
  (or into the table grid) — it becomes a table automatically.
- Or write it by hand: a heading row, a `| --- | --- |` row, then one row per line.
  `:---`, `:---:`, `---:` align a column left / centre / right.
- A line break inside a cell: type `<br>`. A `|` inside a cell: write `\|`; inside maths
  use `\vert` (e.g. `$\vert\psi\rangle$`) — the grid does both for you.
- Wide tables scroll sideways inside their own box (with an edge shadow showing there is
  more), instead of breaking the page layout.
- **Mock tests, Simple text:** put the table between the question line and the `A)` options,
  one row per line, each row starting with `|`. **JSON:** the table is just a string with
  `\n` between rows — "Insert table" writes it with the escaping done.

### Preview
Notes/PYQs have a **Preview** button; Mock Tests has one that shows every question as the
exam page will, with the correct option highlighted — check pictures and tables before saving.

### Fixed along the way
- "Add image from Drive" sat inside the admin `<form>` as a nested `<form>`; inserting an
  image could also submit the outer form (saving a half-written note/question). It no
  longer does.
- Mock-test **results** lost their correct/incorrect highlighting when the PYQ layout was
  reworked (the styles were removed but are still used there). Restored.
- Tables were clipped by the note card (`overflow: hidden`). They now scroll in place.

### Tests
`cd frontend && npm test` runs a few quick checks of the link detection, table builder
and mock-test parser (no extra installs needed).

## October 2026 (2) — Hints, results clean-up, mock-test fixes
**Run `supabase/migration_4_hints_and_results_cleanup.sql` once** in Supabase → SQL Editor
(it is safe to run again), **before** deploying this build. Until it has been run, saving a
mock test shows a message telling you so; everything else keeps working.

### Hints in the results
Each question can have a hint that students see **only in their results review**, after they
submit — never during the test (the database doesn't send it while a test is running).
- **JSON:** add `"hint": "..."` to a question. `explanation` / `solution` also work. Leave it out
  (or `""`) for no hint. Maths works: `"hint": "$2026 \\equiv 2 \\pmod 4$ ..."`.
- **Simple text:** a `Hint:` line, or on the answer line: `Answer: D | Hint: ...`.
- Editing an existing test now shows each question's hint (empty ones as `"hint": ""`), so you
  can add hints to tests you already created. Preview shows them too.

### Results disappear with their test
The migration deletes results that already outlived their test, and makes sure the link
between a result and its test is "delete together" in your database. Results whose test is gone
(or no longer visible to that student) are also never listed in My Results.

### Other mock-test fixes
- **"Start" on an old, abandoned attempt** used to resume it with the timer already at zero and
  instantly submit it with a zero score. Now an attempt whose time ran out is closed (graded on
  what was answered, or discarded if nothing was), and Start begins fresh.
- **Saving a test is all-or-nothing.** Before, a failed save could leave an empty test behind or
  wipe an existing test's questions. Empty tests are no longer shown to students.
- **Editing a test keeps students' answers attached** to questions whose text you didn't change
  (it used to give every question a new id, so old results showed "Not attempted").
- **JSON is checked before saving**, with the question number in each message: it accepts `d` /
  `(D)` for the answer, turns `-0.5` into `0.5` for negative marks, and rejects a missing option or
  a part other than A/B/C instead of storing a broken question.
- My Results shows readable dates; the exam page no longer hangs on a test with no questions.

## October 2026 (3) — Registration email notice, safer migration 4
### Registration
People weren't told an email was coming. Now:
- The sign-up form says so **before** they submit: a confirmation link will be emailed and must be
  clicked before they can log in.
- After submitting, a clear "Check your email" screen shows their address, three steps, a
  Spam/Promotions reminder, a **Resend confirmation email** button (with a 60-second wait so it can't
  be spammed) and "Wrong email address? Go back".
- **Already-registered emails:** Supabase reports these as a successful sign-up but sends *no* email, so
  people used to wait for a message that never came. They now get "This email is already registered —
  Log in" instead.
- **Log in with an unconfirmed email** explains why and offers the resend button; wrong-password and
  email-rate-limit errors are in plain words.

The email itself (subject, wording, logo) is set in Supabase → Authentication → Email Templates.
Supabase's built-in sender has a very low hourly limit and often lands in Spam; before real students
sign up, add your own SMTP provider under Authentication → SMTP Settings (Resend, Brevo, etc.). Also
check Authentication → URL Configuration → Site URL is your live site, so the link opens it.

### Migration 4 (re-run safe)
`migration_4_hints_and_results_cleanup.sql` now finishes with a result row — **save_mock_test_installed,
hint_column_added, expired_attempts_handled should all be true** — and refreshes Supabase's API so the new
function is seen straight away. It also replaces the two older functions it touches (start_test_attempt,
list_mock_tests) with drop-and-create, so an older version with a different shape can't abort it.
Supabase may show a "destructive operations" pop-up (the script removes results of tests that no longer
exist): click "Run this query". If saving a test still says "needs a one-time update", run
`notify pgrst, 'reload schema';` and check you ran it in the same Supabase project the site uses.

## October 2026 (4) — Database update box, pictures in JSON, answers in results, Remove
### "Database update" box (Admin → Mock Tests)
The site now checks, from inside Admin → Mock Tests, whether migration 4 is installed in the Supabase
project it is connected to. If not, a box explains what's missing and gives you: **Copy the SQL**, a link
that opens *that project's* SQL Editor, and **Check again**. Once it shows "✔ Database update installed",
saving tests, hints, results clean-up and the Remove button all work. (The SQL also still lives in
`supabase/migration_4_hints_and_results_cleanup.sql`; the app carries a copy in `frontend/src/sql/`.
Edit the `supabase/` one, then run `npm run sync-sql` — `npm test` fails if they differ.)

### Pictures in JSON questions
- `image_prompt` (a text description for an AI image tool) is **ignored** — never stored, never shown.
- When you have the picture, put its Google Drive share link in **`"image": "https://drive.google.com/file/d/…/view"`**
  (`image_url` / `image_link` also work). It is shown with the question, right after its text, in the exam,
  the results and the preview. A link placed in `image_prompt` itself, or written inside `question`, works too.
- Something that isn't an image link (e.g. `"image": "TBD"` or a Drive *folder*) is reported with the
  question number instead of silently showing nothing. The Drive file must be shared "Anyone with the link".

### Results
- Under every question in a result: **Your answer / Correct answer** (or "Not attempted · Correct answer"),
  the highlighted options, and the **Hint** if the question has one.
- **My Results has a Remove button** on every entry (needs migration 4). It checks the entry was really
  removed and says so if not, instead of pretending.
- Deleting a mock test in Admin now confirms the test was really deleted (the database can report
  "success" for a delete that matched nothing). Its questions and all students' results go with it.


---

## November 2026 — site redesign (plans, papers, exam hub, question bank, downloads)

### Install order (important)
1. **Migration 4** (`supabase/migration_4_hints_and_results_cleanup.sql`) — if Admin → Mock Tests still shows
   "One-time database update needed", install that first, exactly as before.
2. **Migration 5** (`supabase/migration_5_plans_papers_exam_hub_question_bank.sql`) — open **Admin**: a red box
   "Database update 5 needed" appears at the top with a *Copy the SQL* button and a link to the right Supabase SQL
   editor. Run it, press *Check again*; the result row must show `true, true, true`. It is safe to run twice.
   Run both **before** (or right after) the new site goes live: the new pages read the new tables.

Migration 5 **closes a security hole**: before it, any signed-in student could change their own `plan` from the
browser console. Plan, expiry and role can now only be changed by an admin. Existing `paid` students become
`complete` with no expiry, so nobody loses access. It also re-creates `save_mock_test`, `list_mock_tests` and
`start_test_attempt` from migration 4 with their behaviour kept (hints, expired attempts, "no questions yet") plus the
plan check — which is why migration 4 must come first.

### Then, in the app (Admin)
1. **Plans & Prices** — rename plans, set prices (empty = hidden), pick the "most popular" plan. A new name shows everywhere.
2. **Settings & Social** — support email, "How students pay", About text and your social-media links (empty = hidden).
3. **Previous Year Papers** — paste Google Drive links (file shared as *Anyone with the link → Viewer*).
4. **Downloads** — Drive links for sample notes, sample mocks, cheat sheets, anything; type a new category to create it.
5. **Exam Info**, **Question Bank** (paste questions in the format shown), **Updates** (type + date + link).
6. **Notes** — each note has "Included from plan"; *Move a whole topic to a plan* changes a topic in one step.
7. **Mock Tests** — plan, kind (full-length / subject / topic / PYQ-style) and a "CSIR NET — Physical Sciences" marking
   pattern (Part A +2/−0.5, B +3.5/−0.875, C +5/−1.25; 180 min).

### How access works
Plans are ordered `free < mock < notes_mock < complete`; every note, test, question and download stores the lowest plan
that unlocks it (`min_plan`), so higher plans include lower ones automatically. The database enforces this
(`can_view()` in the RLS policies); the UI only mirrors it. A plan that expires falls back to Free by itself.
Question-bank answers live in an admin-only table and are revealed only after a student answers. Drive links of
locked downloads are never sent to the browser.

### Payments
Today: a student picks a plan → pays by the instructions you wrote → sends the reference → you press
**Payment received — activate** in Admin → Subscriptions. For automatic payments (Razorpay) you need a Razorpay account,
a Supabase Edge Function that creates the order, and a webhook that verifies Razorpay's signature and then calls
`grant_plan()` (already in migration 5, callable only server-side).

### Not built yet
- "Attempt any 15 / 20 / 20" scoring for CSIR NET (only the first N answered per part count, max score 200). Today every
  question in the test counts, so build a CSIR-style paper with exactly 15 + 20 + 20 questions to get 200 marks.
- GATE / JEST mock formats (multiple-select and numerical answers) in the test engine; the question bank already has them.
- Written step-by-step test solutions and subject-wise / time-management analytics (shown as "Soon" on the plan cards).

### Fixed along the way
- Logging in now returns you to the page you were trying to reach.
- A broken admin test form (a scripted edit once removed part of it) was rebuilt; every admin tab is now opened in an
  automated browser check.
