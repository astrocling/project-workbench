# Project Workbench — User Guide

This guide explains how to use Project Workbench for project budget and resourcing. The content is written in standard Markdown so you can copy it into Confluence (paste as Markdown or use Confluence’s Markdown macro).

---

## Getting started

### Logging in

1. Open the app URL (e.g. `https://your-app.vercel.app` or `http://localhost:3000`).
2. Enter your **email** and **password**.
3. After signing in, you are taken to the app—by default the **PM Dashboard** (or the page you were trying to open, such as the Projects list).

If you see "Invalid email or password", an administrator may need to run the initial database seed or add your user account (see Technical documentation).

### First-time setup (administrators)

The first admin user is created when the database is seeded. Use the credentials configured in the environment (e.g. `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`). Do not use default credentials in production.

---

## Projects list

The main Projects page (`/projects`) lists projects you can access. Use the filter tabs to narrow the list.

| Filter | Description |
|--------|-------------|
| **My Projects** | Projects where you are assigned a **key role** (PM, PGM, or CAD). Workbench matches your login to a **Person** record (typically by email, or by name if your user profile’s first and last name match a person). If no person is linked, this filter shows no rows. |
| **Active Projects** | All projects with status Active. |
| **Closed Projects** | All projects with status Closed. |
| **All Projects** | Every project. |

**Sorting and URL:** Click a column header (Name, Client, Status, PMs, PGM, CAD) to sort; the URL updates with `sort` and `dir` (`asc` / `desc`). Each click toggles direction.

**Pagination:** Long lists are split into pages (default **100** projects per page). The page shows a range (e.g. “Showing 1–100 of 250”) and **Previous** / **Next** when needed. Optional query parameters: `page` (1-based) and `pageSize` (up to 200).

**Portfolio risk and recovery:** Buffer, recovery, and related portfolio views are on the **PM**, **PGM**, and **CAD** dashboards—not on the Projects list.

From the table you can:

- Click a **project name** to open the project detail page.
- Use the **Actions** column (icons) when you have edit or delete permission:
  - **Edit** (pencil) — Opens the project edit page (Settings and key details).
  - **Backfill** (refresh) — Repopulates this project’s Float scheduled hours from stored Float import data. Use this when a project is missing historical float data (e.g. the project was created after an import). A confirmation dialog appears first; it explains that existing float hours for the project may be overwritten and that this isn’t a common action—if you aren’t doing it on purpose, it’s best to cancel.
  - **Delete** (trash, Admins only) — Permanently removes the project and all its data. A confirmation modal appears: you must type the project name exactly to confirm before the delete is performed. This cannot be undone.

---

## Project detail

Each project has a detail page with several tabs. The header shows the **as-of date** (end of the previous week), which is used for all “to date” calculations and which weeks are considered completed.

### Tabs

| Tab | Purpose |
|-----|---------|
| **Overview** | Summary, key roles (PM, PGM, CAD), project notes, SOW, Estimate, Float, and Metric links, and a snapshot of budget and revenue recovery. |
| **Resourcing** | Planned hours, actual hours, and Float scheduled hours by person and week. Use this to compare plan vs actual vs Float and spot gaps. |
| **CDA** | (When enabled in Settings) Monthly planned and actuals for CDA reporting. Month-to-date actuals for each month incorporate **split-week** hours when a week crosses a month boundary (see Resourcing below). Optional **Report hours only** hides budget dollars on the Overall row in status copy and CDA reports—see [CDA tab](#cda-tab). |
| **Budget** | Budget lines (e.g. SOW, CO, Other) with low/high hours and dollars, and burn to date. |
| **Timeline** | High-level timeline with month columns and up to four rows of bars and markers. Each bar has a label, start/end dates, row (1–4), and an optional color (Blue, Green, Amber, Teal, Slate, or Violet). The same timeline (with colors) appears in status report previews and PDFs. |
| **Status Reports** | Summary table of estimated budget, $ spent, $ remaining, budgeted/actual/remaining hours, with copy-to-clipboard and a % budget used (high est.) circle chart. You can create, edit, view, and export status reports. |
| **Settings** | Edit project name, client, dates, status, single rate, notes, SOW/Estimate/Float/Metric links, resourcing thresholds, key roles, and optional CDA tab. Within Settings, sub-sections include **Details**, **Links**, **Key roles**, **Resourcing** (thresholds), **Rates** (per-role rate card or single bill rate), and **Assignments** (people assigned, their roles, bill-rate overrides, and “hidden from grid” for the Resourcing tab). |

Only users with edit permission can change data; the **Settings** tab may be read-only for some viewers.

---

## Resourcing tab

The Resourcing tab shows three grids (Planned, Actual, Float) by person and by week.

- **Weeks shown**: By default, the grid includes the **full project range** (project start → project end). You do not need to click “load more” controls to see additional weeks.
- **Horizontal navigation**: When the week columns overflow, you can scroll horizontally (trackpad, scrollbar, or **Shift + mouse wheel**). The page also shows **Scroll left / Scroll right** buttons when horizontal overflow is detected.
- **Last week visibility**: When you scroll all the way to the right, the final week column remains fully visible (including its right border).
- **Current week**: The column for the **Monday–Sunday week (UTC) that contains today** has a **subtle background tint** across the week headers, all three grids (Planned, Actual, Float), and the variance/total rows—so you can quickly see which week is in progress. (Amber variance or red mismatch highlights still take priority when they apply.)
- **Planned grid — Ready**: Each person row has a **Ready** toggle (for Float sync). People **hidden from grid** (Settings → Assignments) are excluded. When at least one visible person has **Ready** on, the **PM**, **PGM**, and **CAD** dashboard Projects tables show an **open request** in the **Request** column (see [Dashboards and Account](#dashboards-and-account)).

### Split weeks (month boundary)

Workbench weeks run **Monday–Sunday**. When a week crosses from one calendar month into the next, the **Actual** grid shows **two inputs** in that week’s cell—one for each month (small month labels indicate which is which). Enter hours in **quarter-hour increments** (e.g. 8, 8.25); the two values should add up to the total worked that week.

- **Why**: Monthly CDA reporting and dashboards need hours attributed to the correct calendar month even when a single week spans two months.
- **Planned / Float**: Those grids still show one value per week (unchanged). Only **Actual** uses the split when the week spans two months.
- **When you can edit**: Uses **UTC** calendar dates. The **first** month in the split becomes editable once that calendar month has ended (for example, after 31 December you can enter December’s share of a December–January week, even while that week is still in progress). The **second** month follows the same rule as other Actual cells: you can enter it after the week is **completed** (not the current week). Expand the cell (split icon) to see both inputs.
- **Collapsing**: When both month parts are filled, you may see a single total for the week with an option to expand and edit the two parts again (depending on layout state).

---

## CDA tab

The **CDA** tab appears when **Enable CDA tab** is turned on in **Settings** for the project. It is used for monthly planned vs actual hours, milestones, and material you paste into status reports.

### Report hours only

On the CDA tab, under **Copy for status report**, there is a toggle **Report hours only** (editors only).

| Setting | What the Overall table and copy include |
|--------|----------------------------------------|
| **Off** (default) | **Budget ($)** columns (planned, actual to date, remaining) **and** **Hours** columns (budgeted, actual, remaining)—full financial and hours view. |
| **On** | **Hours only** for the Overall row: the three **Budget ($)** columns are hidden. Use this when the client-facing report should emphasize contract hours and not show dollar amounts. |

**Where this applies**

- **Copy for status report** on the CDA tab (the HTML table and the text you copy to the clipboard).
- **Status Reports** tab — when you preview or export a **CDA** variation report, the same Overall layout is used (preview and PDF match).
- **Saved reports**: When a status report is **created**, the current value is stored in that report’s snapshot. Older reports keep the Overall layout they were saved with; new reports use the project’s current setting at save time.

The monthly CDA tables (month-by-month planned and actuals) are unchanged; only the **Overall** summary row’s budget-dollar cells are affected by this toggle.

---

## Status Reports tab

The Status Reports tab is where you create and maintain status reports and export them as PDFs.

- **Preview and PDF match**: The in-app preview and the exported PDF use the same layout and styling.
- **Bigger, presentation-friendly default size**: The preview is auto-scaled larger (while still fitting your screen), and the downloaded PDF is generated at a larger default page size so you can present at 100% zoom without squinting.
- **Typography**: Status report fonts were updated for readability; the preview and exported PDF use the same typography.

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

### What the import does

- **Assignments and hours:** For each person and project in the CSV, the import updates project assignments (and creates people/roles if needed) and writes Float scheduled hours for the weeks that appear as columns in the file.
- **Past weeks:** Only **current and future** weeks are updated from the file. Past weeks are **never** overwritten or deleted, so revenue recovery and historical Float actuals stay intact even when your Float export only covers a limited range (e.g. today through one year out).
- **Person removed from a project in Float:** If someone no longer appears on a project in the export (e.g. they were removed in Float), their **future** Float scheduled hours for that project are cleared in Workbench. Their **past** weeks and their **assignment** on the project are left as-is—they will still appear on the Resourcing tab until you remove them in **Settings → Assignments** if you want. Keeping them can serve as a check that they had prior hours.

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
| **Users** | Manage app logins (email and password) and permissions. Set **User** or **Admin**, and optionally set a **position role** (Project Manager, Program Manager, Client Account Director) so “My Projects” shows the right list. |

---

## Dashboards and Account

- **PM Dashboard** (`/pm-dashboard`): Projects where you are Project Manager.
- **PGM Dashboard** (`/pgm-dashboard`): Projects where you are Program Manager.
- **CAD Dashboard** (`/cad-dashboard`): Projects where you are Client Account Director.

Each dashboard includes **portfolio summary cards** (e.g. portfolio value, active project counts) and, when revenue recovery data exists, **portfolio revenue recovery** cards for **To date**, **This week** (most recent completed week), and **Previous 4 weeks**.

The **Projects** table lists every active project in scope for that role. Columns:

| Column | Meaning |
|--------|---------|
| **Project** | Name (link), plus a **CDA** badge when the project has the CDA tab enabled. |
| **Client** | Client name. |
| **Budget burn** | Burn % (color indicates health vs thresholds). |
| **Buffer** | Buffer %; negative values may show “(Over)”. |
| **1-wk recovery** | Revenue recovery % for the **most recent completed week** only—the same week labeled on the portfolio **This week** recovery card. |
| **4-wk recovery** | Revenue recovery % across the **rolling previous four completed weeks** (sum of actual vs forecast dollars for those weeks). |
| **Request** | Whether an **open request** is active: **Ready** is on in the project Resourcing **Planned** grid for at least one person who is **not** hidden from the grid (amber dot = open, muted = none). Sort to group projects with open requests. |
| **Actuals** | Whether weekly actuals look up to date, one week behind, or more than one week behind (traffic-light indicator). |
| **Status** | Overall RAG from the latest status report when the report is recent; a blue indicator if a report exists but is older than two weeks; gray if there is no report. |

Click any column header to **sort** (toggle ascending/descending). You can filter the table by **client** using the client dropdown when your portfolio spans multiple clients.

Use the sidebar to open these dashboards. The **Account** page (sidebar) lets you change your password (current password required).

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

Your **My Projects** list (on `/projects`) uses the **Person** link described in *Projects list* (email or name match to your user account). It shows projects where that person has a PM, PGM, or CAD key role. It does **not** filter by the optional **position role** field on your user account alone—that field is used elsewhere (e.g. which dashboard you land on).

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **Invalid email or password** | Ensure the database has been seeded and your user exists. Ask an admin to run the seed or add your account in Admin → Users. |
| **Project names must match** (Float import) | Create projects in Workbench with the exact names used in the Float CSV, or adjust the CSV to match existing project names. Add missing roles in Admin → Roles and re-import if needed. |
| **File too large** (Float import) | Maximum upload size is 10 MB. Split the export or reduce the date range. |
| **Too many import requests** | Wait and try again later; the import is rate-limited when Redis is configured. |
| **Page looks broken** (overlapping layout, wrong styles, sidebar over content) | Try a **hard refresh** (e.g. Mac: `Cmd+Shift+R`). If it persists, a **browser extension** may be injecting styles or scripts — see *Browser extensions* below. |

### Browser extensions

Some Chrome extensions can inject CSS or JavaScript into every page and break Project Workbench’s layout and styling. If the site looks correct in an **Incognito/Private** window but broken in a normal tab, the cause is likely an extension.

- **What to do:** Disable extensions one by one (or use Incognito for Workbench) until the layout is normal. Then either leave that extension disabled or restrict it so it doesn’t run on the Workbench site: right‑click the extension icon → **Manage extension** → set site access to *On specific sites* and remove your Workbench URL, or *On click*.
- **Known problematic extension:** The [Google Maps API Key Checker](https://chromewebstore.google.com/detail/google-maps-api-key-check/gjpanmpojpplcipiaigglekleicmgmel) extension has been observed to break the UI; disabling it or excluding the Workbench domain fixes the issue.

---

*For setup, deployment, and technical details, see the Technical documentation and the main README.*
