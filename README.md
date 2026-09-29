# RICS Group 03 Study Hub

A shared web app for RICS APC Group 03: SOE evidence, Q&A practice, case studies and presentations, the study calendar, an attendance register, announcements and group discussions. It works on phones (add it to the Home Screen) and on desktop, in light or dark mode.

There is no login. People open the link, pick their name on the "Continue as who?" screen, and that choice is remembered on their device. Names are not verified, so anyone with the link can act as any member. That was a deliberate choice for the group, so keep the link inside the group.

## What's in it

| Section | What it does |
| --- | --- |
| Home | Next session, latest announcement, group progress, and a personal to-do list |
| Announcements | Group notices with "seen by" tracking, a push reminder for anyone who hasn't opened one, and copy-for-WhatsApp |
| Calendar | Month and list views. Times show in each person's local time with UAE / Oman time alongside. Reminders, and export to phone calendars (.ics) |
| Attendance | Anyone can mark anyone Present, Late, Excused or Absent per session. Running record with attendance rates, and a WhatsApp summary |
| SOE register | Level 1 to 3 evidence per candidate and competency. Upload a PDF, Word file, text file or photo and it's converted to editable text in the browser, or paste text. Submitting notifies the group. Only the candidate can change their own SOE text |
| Q&A practice | The assigned questioner writes questions, and answers follow the workbook structure: context, action, RICS basis, outcome, plus feedback |
| Case studies | Each member's case study, presentation readiness for the workshop (target: 2 per group), slides upload, and questions from others |
| Discussions | Posts with images and files. Everyone can reply, including the person who posted |
| Alerts | Activity feed plus opt-in push notifications per device |
| Members | Names, pathway, notes and progress. Only names are stored, no emails |

## How it's built

- Next.js 16 (App Router) on Vercel, with functions in `bom1` (Mumbai)
- Supabase Postgres and Storage in `ap-south-1` (Mumbai)
- Web Push (VAPID) for alerts; a Supabase `pg_cron` job calls `/api/cron/reminders` for session reminders
- PDF.js, Mammoth and Tesseract.js for SOE text conversion, all in the browser

### Security model

The browser never talks to Supabase directly. API routes use the project's publishable key (server-side only) plus an `x-app-key` header. Row level security on every table and on the `group-files` bucket only allows requests whose header hashes to the value in `private.app_secret`, so the publishable key on its own can read and write nothing. Files upload straight from the browser to storage through one-time signed links, and download through short-lived signed links.

## Setup

1. Create a Supabase project and run `supabase/migrations/0001_init.sql`.
2. Generate a secret with `openssl rand -hex 32`, then store its hash:
   ```sql
   insert into private.app_secret (id, key_hash)
   values (1, encode(extensions.digest('<APP_KEY>', 'sha256'), 'hex'));
   ```
3. Load the starting data. `scripts/seed_from_xlsx.py` rebuilds `supabase/seed.sql` from the group's tracker workbook (it imports names only). The workbook itself is not committed.
4. Copy `.env.example` to `.env.local` and fill it in. `npm run vapid` prints push keys.
5. `npm install`, then `npm run dev`.

### Session reminders

Enable `pg_cron` and `pg_net` in Supabase, then schedule a job:

```sql
select cron.schedule('g03-reminders', '*/5 * * * *', $$
  select net.http_get(
    url := 'https://<your-app>/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
$$);
```
