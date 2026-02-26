# Project Workbench — User Guide

This guide explains how to use Project Workbench for project budget and resourcing. The content is written in standard Markdown so you can copy it into Confluence (paste as Markdown or use Confluence’s Markdown macro).

---

## Getting started

### Logging in

1. Open the app URL (e.g. `https://your-app.vercel.app` or `http://localhost:3000`).
2. Enter your **email** and **password**.
3. After signing in, you are taken to the **Projects** list.

If you see "Invalid email or password", an administrator may need to run the initial database seed or add your user account (see Technical documentation).

### First-time setup (administrators)

The first admin user is created when the database is seeded. Use the credentials configured in the environment (e.g. `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`). Do not use default credentials in production.

---

## Projects list

The main Projects page shows all projects you can access. Use the filter tabs to narrow the list.

| Filter | Description |
|--------|-------------|
| **My projects** | Projects where you are listed as PM, PGM, or CAD (based on your user profile). |
| **Active** | All projects with status Active. |
| **Closed** | All projects with status Closed. |
| **All** | Every project. |
| **At risk** | Projects that are over- or under-resourced compared to plan (based on actuals and thresholds). |

From the table you can:

- Click a **project name** to open the project detail page.
- (Admins only) Use **Delete** to remove a project.

---

## Project detail

Each project has a detail page with several tabs. The header shows the **as-of date** (end of the previous week), which is used for all “to date” calculations and which weeks are considered completed.

### Tabs

| Tab | Purpose |
|-----|---------|
| **Overview** | Summary, key roles (PM, PGM, CAD), project notes, SOW, Estimate, Float, and Metric links, and a snapshot of budget and revenue recovery. |
| **Resourcing** | Planned hours, actual hours, and Float scheduled hours by person and week. Use this to compare plan vs actual vs Float and spot gaps. |
| **Budget** | Budget lines (e.g. SOW, CO, Other) with low/high hours and dollars, and burn to date. |
| **Rates** | Per-role rate card for the project, or a single bill rate if the project uses one rate for all roles. |
| **Assignments** | People assigned to the project, their roles, and any bill-rate overrides. |
| **Settings** | Edit project name, client, dates, status, single rate, notes, SOW/Estimate/Float/Metric links, resourcing thresholds, and key roles. |

Only users with edit permission can change data; the **Settings** tab may be read-only for some viewers.

---

## Creating a new project

1. From the Projects list, click **New project** (or go to `/projects/new`).
2. Fill in:
   - **Slug** — Short URL-friendly identifier (e.g. `acme-2025`).
   - **Name** — Full project name.
   - **Client** — Client or account name.
   - **Start date** and **End date** (required).
   - **Status** — Active or Closed.
   - Optional: single bill rate, notes, SOW link, estimate link, Float link, Metric link, and resourcing thresholds.
3. Submit to create the project. You can then add assignments, key roles, budget lines, and rates from the project detail page.

If you use **Float Import** first, you can create projects from the import data; project names in the CSV must match the names you give here (or you can create projects and later run a backfill to apply Float data).

---

## Float Import (Admin only)

Admins can import scheduled hours from Float by uploading a CSV export.

### Where to go

**Admin → Float Import** (link in the header when you are an Admin).

### CSV format

The import expects a CSV that looks like a Float export:

- **Header row:** The importer looks for a row that contains “name” (or similar) and “project” or “client”. Float often has a few metadata lines above the header; the importer skips to the first line that looks like a header.
- **Columns:**
  - **Person name** — Column header can be “Person”, “Name”, “Resource”, or “Employee” (or the first column if none match).
  - **Role** — Column header “Role” (or the second column).
  - **Project** — Column header “Project” (or a column containing “project” that isn’t “Client”).
  - **Client** (optional) — “Client”, “Client name”, “Account”, or “Customer”. Used when creating projects from Float data.
  - **Weekly hours** — One column per week, with the week’s **Monday date** as the header in **ISO format** (e.g. `2025-02-17`).

### Example column headers

| Person | Role | Project | Client | 2025-02-17 | 2025-02-24 |
|--------|------|---------|--------|------------|------------|
| Jane Doe | Project Manager | Alpha Project | Acme | 40 | 40 |

- **Project names** in the CSV must match existing projects in Workbench if you want hours to land on those projects. Otherwise, add the projects first (or create them from the import), then run the import again or use backfill if your deployment supports it.
- **Roles** must exist in Workbench (Admin → Roles). If the CSV contains roles that don’t exist yet, the import records them as “unknown”; add those roles in Admin → Roles and re-import if needed.

### Limits

- **File size:** Maximum 10 MB per file.
- **Rate limiting:** In production, if Redis is configured, the import is rate-limited (e.g. 20 requests per 15 minutes per user).

---

## Admin: Roles, People, and Users (Admin only)

Available from the Admin area (link in the header).

| Page | Purpose |
|------|---------|
| **Roles** | Create and manage roles (e.g. Project Manager, FE Developer). Role names must match the ones used in project assignments and in Float CSV exports. |
| **People** | Manage people (name, email, active). These are the resources that appear on project assignments and in Float import. |
| **Users** | Manage app logins (email and password) and permissions. Set **User** or **Admin**, and optionally set a **position role** (Project Manager, Program Manager, Client Account Director) so “My projects” shows the right list. |

---

## Key concepts

### Weeks and “as-of” date

- **Weeks** run Monday–Sunday. All hours (planned, actual, Float) are stored by the **Monday** of that week.
- The **as-of date** is the end of the previous week (Sunday). The app uses it to decide which weeks count as “completed” for to-date totals and which data you can edit. You cannot change the as-of date; it is set by the system.

### Planned vs actual vs Float

| Type | Meaning |
|------|---------|
| **Planned** | Internal estimate of hours (entered in Workbench). |
| **Actual** | Hours from timesheets or actuals (entered in Workbench). |
| **Float** | Scheduled hours imported from Float via the CSV import. |

The Resourcing tab shows all three so you can compare plan, actual, and Float schedule.

### Key roles (PM, PGM, CAD)

Each project can have people in **key roles**:

- **PM** — Project Manager  
- **PGM** — Program Manager  
- **CAD** — Client Account Director  

Your **My projects** filter uses your user **position role** (set in Admin → Users) to show only projects where you are PM, PGM, or CAD.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **Invalid email or password** | Ensure the database has been seeded and your user exists. Ask an admin to run the seed or add your account in Admin → Users. |
| **Project names must match** (Float import) | Create projects in Workbench with the exact names used in the Float CSV, or adjust the CSV to match existing project names. Add missing roles in Admin → Roles and re-import if needed. |
| **File too large** (Float import) | Maximum upload size is 10 MB. Split the export or reduce the date range. |
| **Too many import requests** | Wait and try again later; the import is rate-limited when Redis is configured. |

---

*For setup, deployment, and technical details, see the Technical documentation and the main README.*
