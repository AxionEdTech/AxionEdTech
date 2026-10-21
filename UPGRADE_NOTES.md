# AxionEdTech — Content Organisation Upgrade

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
<<<<<<< HEAD
   - **Guest (no account)** — sees the home page and only notes/PYQs an admin
     has explicitly checked "Show to visitors without logging in (free
     preview)".
   - **Free account** — sees all non-"Paid plan only" notes and PYQs, in full.
   - **Paid plan** — sees everything, same as before.
   `/notes` and `/pyqs` no longer require login to open at all; Row Level
   Security is what actually decides how much content comes back for each
   visitor, so there's no way to see more by tinkering with the page.
=======
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
>>>>>>> eff2ac1 (Notice board, access tiers, PYQ sessions, mock test bulk entry, author footer)
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
<<<<<<< HEAD

No changes were made to Mock Tests — attempts still require an account
(scoring and progress are tied to a user), which is standard for graded
tests.
=======
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
>>>>>>> eff2ac1 (Notice board, access tiers, PYQ sessions, mock test bulk entry, author footer)
