# Axion EdTech — Exam Prep Portal (1.0.0 version)

This version has **no server for you to manage**. There are only two pieces:

1. **Supabase** — a free service that stores your data (notes, questions, student
   accounts, test results) and handles login security for you.
2. **Vercel** — a free service that shows your website to visitors.

You will click through both of their websites — no command-line typing is required
for either one, except one small optional step if you want to test the site on your
own computer before it's live.

---

## Part 1 — Set up Supabase (your database + login system)

1. Go to **supabase.com** and click **Start your project**. Sign up (GitHub login is easiest).
2. Click **New project**. Give it any name, e.g. `csir-net-portal`. Set a database
   password — write it down somewhere safe, you likely won't need it again but keep it.
   Choose a region close to your students (e.g. Mumbai, if most are in India). Click
   **Create new project** and wait ~2 minutes while it sets up.
3. On the left sidebar, click the **SQL Editor** icon.
4. Click **New query**.
5. Open the file `supabase/schema.sql` from this project (in a plain text editor —
   Notepad, TextEdit, or VS Code all work), select all the text, copy it, and paste
   it into the SQL Editor box on the Supabase website.
6. Click **Run** (bottom right). You should see "Success. No rows returned." This one
   paste created your entire database — all the tables, security rules, and sample content.
7. On the left sidebar, click **Settings → API**. You'll see two things you need later:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (a long string of letters/numbers)
   Keep this browser tab open — you'll copy these into Vercel in Part 3.

**By default, new sign-ups are allowed to log in immediately (no email confirmation
step).** If you'd rather require students to click a confirmation link in their email
first, go to **Authentication → Providers → Email** in Supabase and turn on "Confirm email."

---

## Part 2 — Make yourself the admin

You'll do this *after* you've signed up in the actual app (Part 3), but here's the one
command you'll need, so you know what's coming: in Supabase's **SQL Editor**, run
(replacing the email with your own):

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

That's it — that one line turns your regular account into an admin account, which
unlocks the **Admin** menu in the website for adding notes, questions, and tests.

---

## Part 3 — Put the website online with Vercel

1. First, get the code onto GitHub — if you haven't done this part before:
   - Create a free account at **github.com**
   - Install **GitHub Desktop** from **desktop.github.com** and sign in
   - Unzip this project folder somewhere on your computer
   - In GitHub Desktop: **File → Add local repository** → choose the unzipped folder
     → click "create a repository" when it asks → **Create Repository** → **Publish repository**
     (tick "Keep this code private" if you don't want the code itself to be public —
     this has no effect on who can use the actual website, since login is still required there)

2. Go to **vercel.com** → sign up (GitHub login is easiest) → **Add New** → **Project**
   → choose your repo.
3. Vercel will ask for a **Root Directory** — click **Edit** and select `frontend`.
4. Before clicking Deploy, expand **Environment Variables** and add two:
   - `VITE_SUPABASE_URL` → paste the Project URL from Part 1, step 7
   - `VITE_SUPABASE_ANON_KEY` → paste the anon public key from Part 1, step 7
5. Click **Deploy**. Wait about a minute. You'll get a live link like
   `https://csir-net-portal.vercel.app` — that's your website, live on the internet.

---

## Part 4 — Try it out

1. Open your live Vercel link, click **Register**, and create your own account.
2. Go back to Supabase's SQL Editor and run the admin command from Part 2 with your email.
3. Refresh the website and log in again — you'll now see an **Admin** link in the top menu.
4. Click **Admin** → add a note, a previous-year question, or a mock test. It appears
   for students immediately.

---

## How the free / paid split works

Every note, question, and mock test has a **"Paid plan only"** checkbox when you add it
as admin. Everyone can see non-premium content the moment they sign up (your free tier).
Content marked "Paid plan only" is completely invisible to free accounts — not just
hidden in the app, but blocked at the database level, so there's no trick a visitor can
use in their browser to see it early.

To upgrade a specific student to paid (for now, done manually until you connect a
payment provider): log in as admin, go to **Admin → Manage Students**, find them, and
click **Mark as paid**.

**Next step when you're ready:** connect a real payment gateway (Razorpay is the
standard choice in India) so students can pay and get upgraded automatically instead
of you doing it by hand. That's a contained addition on top of what's here — happy to
build it whenever you want to add it.

---

## Testing on your own computer first (optional)

If you want to see changes before they go live, you can run the site locally. This is
the one part that uses a terminal:

- **Windows:** press the Windows key, type `cmd`, press Enter
- **Mac:** press Cmd+Space, type `Terminal`, press Enter

Then, in that black/white window, type each of these lines and press Enter after each
(replace `path/to/frontend` with the actual unzipped folder path — you can usually drag
the folder into the terminal window to auto-fill the path):

```bash
cd path/to/frontend
npm install
```
(This second command needs Node.js installed first — get it free from **nodejs.org**,
the "LTS" version, if `npm` says it's not recognized.)

Copy `.env.example` to a new file named `.env` in that same folder, and fill in your
Supabase URL and key from Part 1. Then:

```bash
npm run dev
```
It will print a link like `http://localhost:5173` — open that in your browser.

---

## What's actually protecting your data

- Every table's access rules ("who can see/change what") live inside Supabase's
  database itself (Row Level Security), not in website code — so even if someone
  found a bug in the website's JavaScript, the database would still refuse to hand
  over data it shouldn't.
- Mock test answer keys are never sent to a student's browser while they're taking
  the test — the scoring happens inside the database itself, and only the final
  score comes back.
- Passwords are handled entirely by Supabase's authentication system, never stored
  or seen by your own code.
- Notes are shown read-only with copy/right-click/print blocked and a watermark of
  the viewer's name — a deterrent, not a guarantee (a phone camera can always defeat
  any browser-based protection — that's true of every site, not just this one).
