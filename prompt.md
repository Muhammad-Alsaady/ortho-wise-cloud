# Multi-Tenant Logging System (Supabase Only)

You are working on a multi-tenant dental clinic management system using Supabase (database + auth) and a frontend deployed on Vercel.

Each clinic is isolated using `clinic_id`. Users belong to a clinic and have roles (admin, doctor, receptionist). There is also a **SuperAdmin** role that can access all tenants.

Implement a complete logging system using **Supabase only (no external services like Sentry)**.

---

## 1. Logs Table (Supabase)

Generate SQL for a `logs` table:

* id (uuid, primary key)
* clinic_id (uuid, required)
* user_id (uuid, nullable)
* level (text: INFO, WARNING, ERROR)
* action (text: e.g. CREATE_APPOINTMENT, DELETE_DOCTOR)
* entity (text: e.g. appointment, doctor, auth)
* message (text)
* details (jsonb, optional)
* created_at (timestamp, default now)

Also:

* Add indexes on `clinic_id` and `created_at`

---

## 2. Logging Service

Create a reusable logging utility (e.g. `logService.ts`):

Functions:

* logInfo(action, entity, message, details?)
* logWarning(action, entity, message, details?)
* logError(action, entity, error, details?)

Requirements:

* Automatically include `clinic_id` and `user_id`
* Insert into Supabase `logs` table
* Fail silently (logging must NOT break app flow)
* Log errors to console as fallback

---

## 3. Integration

Update key parts of the app:

* Wrap DB/API operations with try/catch
* On success (important actions) → logInfo(...)
* On failure → logError(...)

Do NOT log everything — only meaningful actions and errors.

---

## 4. SuperAdmin Logs Page

Create a new page: **"System Logs" (SuperAdmin only)**

Purpose:

* Monitor logs across ALL clinics (cross-tenant visibility)

Features:

* Fetch logs from Supabase (no clinic restriction)
* Filters:

  * clinic_id
  * level (INFO, WARNING, ERROR)
  * date range
* Sorting: newest first
* Pagination required

Display:

* timestamp
* clinic_id
* level (color-coded: error=red, warning=yellow, info=blue)
* message
* action
* user_id (if exists)

---

## 5. Access Control

* Only SuperAdmin can access this page
* Other roles (admin, doctor, receptionist) must NOT access it

---

## 6. Performance

* Use pagination (limit + offset or cursor)
* Do NOT fetch all logs at once
* Optimize queries using indexes

---

## 7. Constraints

* No external logging services
* No sensitive data (passwords, tokens)
* Must support multi-tenancy
* Logging must not affect performance or break the app

---

## 8. Output

Provide:

1. SQL for logs table
2. Logging service implementation
3. Example usage
4. SuperAdmin logs page component

Focus on clean, production-ready code.
