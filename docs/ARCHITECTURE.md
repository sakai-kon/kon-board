# KON BOARD Architecture

## Stack

- **Frontend:** Vanilla HTML, CSS and JavaScript
- **Hosting/source:** GitHub repository and GitHub Pages-compatible static files
- **Authentication:** Supabase Auth (GitHub first; additional providers can be enabled later)
- **Database:** Supabase PostgreSQL

## Core data model

`auth.users` is managed by Supabase. `profiles` stores public board identity. `posts` belongs to one profile, and `comments` belongs to both a post and a profile.

## Security rules

- Browser code uses only the Supabase anon/publishable key.
- Never expose a `service_role` key in `config.js` or the repository.
- RLS allows public reading of board content but restricts writes and edits to the authenticated owner.
- Reports are private to the reporter in the initial schema; administrator moderation can later use server-side code or Supabase roles.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Enable GitHub OAuth in Supabase and add the correct redirect URL.
4. Copy `js/config.example.js` to `js/config.js` and enter the project URL and anon/publishable key.
5. Open the site or deploy the repository to GitHub Pages.

`js/config.js` is intentionally not committed.

## Next milestones

1. Add Google/Discord login providers.
2. Add replies, likes and report UI.
3. Add profiles and user pages.
4. Add moderation roles and an admin dashboard.
5. Add realtime comment updates.
6. Add pagination and full-text search.
