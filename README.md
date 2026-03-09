# Dental Clinic Management System

A multi-tenant dental clinic management system built with React, TypeScript, and Lovable Cloud.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — database, auth, edge functions, storage
- **Charts:** Recharts
- **Routing:** React Router v6

## Features

- **Multi-tenant architecture** — each clinic is an isolated tenant with its own data
- **Role-based access control** — SuperAdmin, Admin, Doctor, Reception
- **Reception Dashboard** — appointment management, patient check-in, payment tracking
- **Doctor Queue & Visit** — treatment plans, image uploads, clinical notes
- **Patient Management** — patient records with visit history and balances
- **Admin Panel** — treatment catalog, user management, audit logs, data backup
- **Super Admin** — clinic/tenant management, admin user provisioning
- **Reports** — daily/monthly revenue, doctor performance, treatment popularity, outstanding balances
- **Bilingual** — English and Arabic with full RTL support
- **License management** — expiry tracking and enforcement

## User Roles

| Role | Access |
|------|--------|
| **SuperAdmin** | Manage all clinics, create admin users |
| **Admin** | Manage own clinic: treatments, doctors, receptionists, reports, audit logs |
| **Doctor** | View queue, manage visits, treatment plans, notes, images |
| **Reception** | Manage appointments, patients, payments |

## Local Development

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

## Deployment

Open the project in [Lovable](https://lovable.dev) and click **Share → Publish**.
