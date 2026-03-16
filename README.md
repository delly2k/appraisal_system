# Employee Performance Appraisal Portal

Internal Next.js application for employee performance appraisals, workplans, and development profiles. Built with the App Router, TypeScript, Tailwind CSS, shadcn/ui, and placeholder auth (Microsoft Entra ID to be integrated).

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (Radix-based components)
- **Supabase** (PostgreSQL + client; schema not yet implemented)
- **Microsoft Entra ID** (placeholder auth; integration planned)
- **Role-based access control** (employee, manager, hr, admin)

## Project structure

```
/app
  /dashboard     Dashboard with placeholder cards
  /appraisals    My Appraisals + /team (manager)
  /workplans     My Workplans
  /development   Development Profile
  /admin         HR Administration (admin role)
  /api           API routes (e.g. health)
/components
  /ui            shadcn-style components
  /layout        AppShell, Sidebar, TopNav
  /forms         Form components (placeholder)
/lib
  supabase.ts    Browser Supabase client
  supabase-server.ts  Server Supabase client
  auth.ts        Placeholder auth (Entra ID later)
  dynamics.ts    Dynamics 365 / Dataverse placeholder
  permissions.ts RBAC helpers
/types           Shared TypeScript types
/hooks           useAuth, usePermissions
/utils           cn() and helpers
```

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env.local` and fill in values when you implement Supabase, Entra ID, and Dynamics.

3. **Run development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The app redirects to `/dashboard`.

   **Sign in:** Go to [/login](http://localhost:3000/login) and use **Sign in with Microsoft** (Azure AD / Entra ID). Set `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and the Azure AD env vars in `.env`. **Sign out:** Use the user menu (avatar) in the top nav and choose **Sign out**.

## Navigation and roles

- **Dashboard** – All roles
- **My Appraisals** – All roles
- **My Workplans** – All roles
- **Development Profile** – All roles
- **Team Reviews** – Manager (and admin)
- **HR Administration** – Admin (and hr for view/reports)

The sidebar shows only links the current user is allowed to see. When `SEED_USER_EMAIL` is set (e.g. `delano.walters@dbankjm.com`), the app loads that user from `app_users`; see "Seeded users and Dynamics sync" below.

### Seeded users and Dynamics sync

Two app users are seeded (migration `0011_seed_app_users.sql`): **GM** `delano.walters@dbankjm.com` (role `gm`) and **Admin** `admin@dbankjm.com` (role `admin`). To use them: (1) Run Dynamics sync: `POST /api/sync/employees`. (2) Apply migrations so the seed runs; if you run the migration after sync, the GM gets `employee_id` and `division_id` from `employees`. (3) Set `SEED_USER_EMAIL=delano.walters@dbankjm.com` or `admin@dbankjm.com` in `.env`. If the GM was seeded before sync, re-run the migration or run: `UPDATE app_users SET employee_id = (SELECT employee_id FROM employees WHERE email = 'delano.walters@dbankjm.com' LIMIT 1), division_id = (SELECT division_id FROM employees WHERE email = 'delano.walters@dbankjm.com' LIMIT 1) WHERE email = 'delano.walters@dbankjm.com';`

## What’s included (no DB yet)

- App Router layout with responsive sidebar + top nav
- Placeholder auth returning a fixed user (no Entra ID)
- RBAC permission checks for nav and future features
- Placeholder Supabase and Dynamics clients
- Dashboard with placeholder cards: Active Appraisal Cycle, Pending Self Assessments, Manager Reviews Pending, Recent Performance Scores
- Placeholder pages for appraisals, workplans, development, team reviews, admin
- Health API: `GET /api/health`

## Next steps

1. Integrate **Microsoft Entra ID** in `lib/auth.ts` and protect routes (e.g. middleware).
2. Define **Supabase** schema and replace placeholder data with real queries.
3. Implement **Dynamics 365 / Dataverse** calls in `lib/dynamics.ts` for employees and reporting lines.
4. Add forms and API routes for appraisals, workplans, and admin.

## Scripts

- `npm run dev` – Development server
- `npm run build` – Production build
- `npm run start` – Start production server
- `npm run lint` – Run ESLint
