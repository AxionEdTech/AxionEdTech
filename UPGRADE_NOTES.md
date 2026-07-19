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
