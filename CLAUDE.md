# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run build:dev    # Dev-mode build
npm run lint         # ESLint
npm run preview      # Preview production build

# Testing
npm run test         # Run all tests once (vitest run)
npm run test:watch   # Watch mode
```

Run a single test file:
```bash
npx vitest run src/path/to/file.test.ts
```

Tests live in `src/**/*.{test,spec}.{ts,tsx}` with jsdom environment. Setup file: `src/test/setup.ts`.

## Environment

Copy `.env.example` to `.env`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

## Architecture

### Stack
React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui (Radix UI). Backend is Supabase (Postgres, Auth, Edge Functions, Storage). Data fetching via TanStack Query. Routing via React Router v6. Charts via Recharts.

### Multi-tenancy
Every clinic is a **tenant** identified by `clinic_id`. All tables (except `user_roles` and `clinics`) carry a `clinic_id` foreign key. Row-level security (RLS) is enforced in Postgres using the `get_user_clinic_id()` and `has_role()` DB functions. Never query data without scoping to `clinic_id`.

### Auth & Roles (`src/contexts/AuthContext.tsx`)
- `AuthProvider` fetches the user's `profiles` row and `user_roles` rows on login.
- When a user has multiple roles, the highest-privilege role wins (priority: superadmin > admin > doctor > reception).
- `admin_doctor` is a composite role handled client-side (has both `admin` and `doctor` rows in `user_roles`); the context resolves it to `"admin"` role. Route guards in `App.tsx` use both `"admin"` and `"admin_doctor"` checks.
- `useAuth()` exposes `{ user, profile, role, clinicId, loading, signIn, signOut }`.

### Role-based routing (`src/App.tsx`)
Routes are conditionally rendered by role. The root `/` redirects doctors to `/doctor-queue`, everyone else to `ReceptionDashboard`.

| Role | Routes |
|------|--------|
| reception | `/`, `/patients` |
| doctor / admin_doctor | `/doctor-queue`, `/visit/:id`, `/patients` |
| admin / admin_doctor | above + `/reports`, `/admin` |
| superadmin | all + `/superadmin` |

### Database Schema (key tables)
- `clinics` — tenant root; has `license_expiry`, `license_key`, `plan_type`
- `profiles` — one per user, holds `name`, `email`, `clinic_id`, linked to `auth.users` via `user_id`
- `user_roles` — many roles per user (`app_role` enum: `superadmin | admin | doctor | reception`)
- `patients` — scoped to `clinic_id`
- `appointments` — links patient + doctor + clinic; status enum: `Booked | Waiting | WithDoctor | Completed | Cancelled`
- `visits` — created when a doctor starts seeing a patient; links to `appointments`; status: `InProgress | Completed`
- `treatment_plans` — items within a visit (treatment + price + discount)
- `payments` — payments against a `treatment_plan_id`
- `treatments` — clinic-specific treatment catalog
- `audit_logs` — admin-visible action log scoped to clinic

**Views** (read-only, all clinic-scoped): `appointment_summary`, `daily_revenue`, `monthly_revenue`, `doctor_performance`, `treatment_popularity`, `patient_balances`

### Appointment → Visit flow
Reception creates an **appointment** (status `Booked`). When the patient arrives, reception moves it to `Waiting`. Doctor starts a visit → a **visit** row is created (`InProgress`) and the appointment becomes `WithDoctor`. Doctor adds treatment plan items, uploads images, writes notes, then completes the visit → status becomes `Completed`. Payments are recorded separately against individual `treatment_plan` rows.

### Internationalization (`src/contexts/LanguageContext.tsx`)
All UI strings go through `t(key)` from `useLanguage()`. Translations are a static `Record<string, Record<'en'|'ar', string>>` in `LanguageContext.tsx`. Language preference is stored in `localStorage`; switching to Arabic sets `document.documentElement.dir = 'rtl'`. Add new keys to the `translations` object — no external files.

### License enforcement (`src/components/LicenseGuard.tsx`)
Wraps all authenticated routes. Reads `clinics.license_expiry` for the current clinic. Blocks the UI entirely if expired; shows a warning banner if expiring within 7 days.

### Supabase integration (`src/integrations/supabase/`)
- `client.ts` — typed `createClient<Database>` instance; import from here everywhere
- `types.ts` — auto-generated DB types; regenerate with `supabase gen types typescript` after schema changes

### Edge Functions (`supabase/functions/`)
- `manage-user` — create/deactivate users (called from AdminPanel and SuperAdmin)
- `export-backup` — exports full clinic data as JSON (called from AdminPanel backup tab)

### Component structure
- `src/components/ui/` — shadcn/ui primitives (auto-generated, don't hand-edit)
- `src/components/modals/` — feature modals: `AppointmentModal`, `EditAppointmentModal`, `PatientModal`, `PatientHistoryModal`, `PatientProfileModal`, `PaymentModal`
- `src/components/Layout.tsx` — top-level shell with nav (role-aware)
- `src/pages/` — one file per route/feature
