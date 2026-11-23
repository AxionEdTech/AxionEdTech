# Axion EdTech — Exam Prep Portal (v1.1)

Physics exam preparation site (CSIR NET, GATE, JEST …) — notes, mock tests, a
question bank, previous-year papers, plans and subscriptions.

There is **no server for you to manage**. Two free services do everything:

- **Supabase** stores the data (notes, questions, students, results) and handles logins.
- **Vercel** shows the website. Every time you push to GitHub, Vercel rebuilds it.

---

## Updating the live site to this version

1. **Database first.** Log in to the site as admin and open **Admin**. A yellow box says
   **"Database update 6 needed"**. Click **Copy the SQL**, then **Open this site's Supabase
   SQL Editor**, paste, press **Run**. The result row should read **true, true, true**.
   Back on the Admin page, click **Check again** — it now says *Database is up to date*.
   (The same SQL is in `supabase/migrations/migration_6_phone_number_and_fixes.sql`.)
2. **Then the website.** Replace your project folder with this one, and in GitHub Desktop
   **Commit** and **Push**. Vercel redeploys on its own within a minute or two.

Doing them in the other order is harmless: sign-ups keep working, and phone numbers typed
before step 1 are copied across when you run it.

---

## What's in the folder

```
AxionEdTech/
├── README.md                ← this file
├── CHANGELOG.md             ← what changed in each version
├── supabase/                ← the database (run in Supabase → SQL Editor)
│   ├── fresh_install_all.sql    builds everything on a NEW, empty project
│   ├── migrations/              the same thing in steps 1–6 (for existing sites)
│   └── tools/                   reset / re-create profiles (rarely needed)
└── frontend/                ← the website (Vercel's "Root Directory")
    ├── index.html               page title, description, fonts
    ├── public/                  logo files and favicon
    ├── tests/                   quick automatic checks (npm test)
    └── src/
        ├── App.jsx              list of every page and its web address
        ├── pages/               one file per page (Home, Notes, MockTestAttempt …)
        ├── components/          pieces used on several pages (Navbar, cards, footer …)
        │   └── admin/           the Admin page's managers and the database-update box
        ├── context/             who is logged in, plan names, updates feed
        ├── lib/                 plain helpers: talking to Supabase (api.js), plans,
        │                        exam lists, text/maths formatting, parsers
        ├── styles/              base.css (basics) and site.css (look of the site)
        └── sql/                 copies of migrations 4–6 used by the Admin update box
```

## Where to change what

| I want to…                                                  | Do it here |
|-------------------------------------------------------------|------------|
| Add notes, tests, questions, papers, updates, prices        | **Admin page** on the site (no code) |
| Change contact details, social links, payment instructions  | **Admin → Settings & Social** |
| See students and their phone numbers, grant/revoke plans    | **Admin → Students & Subscriptions** (search, or **Download list (CSV)**) |
| Add an exam, subject or unit to the dropdowns / their order | `frontend/src/lib/taxonomy.js` |
| Change what each plan includes (the feature list)           | `frontend/src/lib/plans.js` → `FEATURES` |
| Change the CSIR NET / GATE marking pattern presets          | `frontend/src/lib/examPatterns.js` |
| Change the menu at the top                                  | `frontend/src/components/Navbar.jsx` → `LINKS` / `MORE` |
| Change the home page text                                   | `frontend/src/pages/Home.jsx` |
| Change colours                                              | top of `frontend/src/styles/base.css` (`--navy`, `--royal`, `--gold` …) |
| Make the background logo fainter/stronger                   | `frontend/src/styles/site.css` → `--watermark-opacity` |
| Change the sign-up form                                     | `frontend/src/pages/Register.jsx` |
| Change the confirmation email                               | Supabase → Authentication → Email Templates |

---

## Setting up from scratch (new Supabase project)

### 1. Supabase
1. **supabase.com** → **New project**. Pick a region near your students (e.g. Mumbai).
2. **SQL Editor → New query**, paste all of `supabase/fresh_install_all.sql`, **Run**.
   If it warns about "destructive operations", choose **Run this query**.
3. **Settings → API**: keep the **Project URL** and the **anon public** key for step 2.
4. Before real students sign up: **Authentication → SMTP Settings** — add your own email
   provider (Resend, Brevo …); Supabase's built-in sender is heavily rate-limited and often
   lands in Spam. Also set **Authentication → URL Configuration → Site URL** to your live address.

### 2. Vercel
1. Put this folder on GitHub (GitHub Desktop → **Add local repository** → **Publish**; you
   can keep it private).
2. **vercel.com → Add New → Project** → pick the repository.
3. **Root Directory**: `frontend`.
4. **Environment Variables**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1.3.
5. **Deploy**.

### 3. Make yourself admin
Register on the live site, then in Supabase → SQL Editor run (with your email):

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Log out and back in — the **Admin** link appears in the menu.

---

## How access works

- **Previous-year papers and exam information** are free for everyone, no account needed.
- Every note, test, question and download has an **"Included from plan"** setting:
  Free → Mock Test → Notes + Mock → Complete. Each plan includes everything below it.
- This is enforced **inside the database** (Row Level Security), not just hidden on the page,
  so nobody can see more by tinkering in the browser. Mock-test and question-bank answer keys
  never reach the browser before the student has answered.
- Payments are manual for now: students pay using your instructions and send a reference;
  you approve it in **Admin → Students & Subscriptions**, which switches the plan on.

---

## Trying changes on your own computer (optional)

Needs **Node.js** (the LTS version from nodejs.org). In a terminal:

```bash
cd path/to/AxionEdTech/frontend
npm install
```

Copy `.env.example` to `.env` and fill in the two Supabase values, then:

```bash
npm run dev      # opens the site at http://localhost:5173
npm test         # quick automatic checks
npm run build    # the same build Vercel does — shows any error before you push
```

If you edit a file in `supabase/migrations/`, run `npm run sync-sql` so the Admin update box
carries the new copy (`npm test` reminds you if you forget).
