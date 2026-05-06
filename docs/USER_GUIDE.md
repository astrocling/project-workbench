# Project Workbench — User Guide

This guide explains how to use Project Workbench for project budget and resourcing. It reflects **release 1.0.7** and later **1.x** behavior unless a section notes otherwise. The content is written in standard Markdown so you can copy it into Confluence (paste as Markdown or use Confluence’s Markdown macro).

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
  - **Backfill** (refresh) — Repopulates this project’s Float scheduled hours from stored Float import data. Use this when a project is missing historical float data (e.g. the project was created after an import). A confirmation dialog appears first; it explains that existing float hours for the project may be overwritten and that this isn’t a common action—if you aren’t doing it on purpose, it’s best to cancel. Admins can run the same style of restore for **all** projects at once from **Admin → Float sync** (*Restore hours from import history (all projects)*).
  - **Delete** (trash, Admins only) — Permanently removes the project and all its data. A confirmation modal appears: you must type the project name exactly to confirm before the delete is performed. This cannot be undone.

---

## Project detail

Each project has a detail page with several tabs. The header shows the **as-of date** (end of the previous week), which is used for all “to date” calculations and which weeks are considered completed.

### Tabs

| Tab | Purpose |
|-----|---------|
| **Overview** | Summary, key roles (PM, PGM, CAD), project notes, SOW, Estimate, Float, and Metric links, and a snapshot of budget and revenue recovery. When teammates have Float **time off** or a **regional holiday** in the rolling two-week window, small absence pills summarize who is out (see [PTO tab](#pto-tab)). |
| **Resourcing** | Planned hours, actual hours, and Float scheduled hours by person and week. Use this to compare plan vs actual vs Float and spot gaps. You can **collapse Weekly Actuals** (chevron on that section) to bring Planned and Float closer on screen. The **Float** grid can show **PTO** and **holiday** indicators per week when Float sync has populated time off and holidays (see [Resourcing tab](#resourcing-tab)). |
| **PTO** | PTO and regional holidays for **project members** visible on the Resourcing grid across the project date range. Filter by week range and person; see who is on PTO or a holiday and whether a PTO day is full or partial. Data comes from Float sync (`PTOHolidayImpact`). See [PTO tab](#pto-tab). |
| **CDA** | (When enabled in Settings) Monthly planned and actuals for CDA reporting. Month-to-date actuals for each month incorporate **split-week** hours when a week crosses a month boundary (see Resourcing below). Optional **Report hours only** hides budget dollars on the Overall row in status copy and CDA reports—see [CDA tab](#cda-tab). |
| **Budget** | Budget lines (e.g. SOW, CO, Other) with low/high hours and dollars, and burn to date. |
| **Timeline** | High-level timeline with month columns and up to four rows of bars and markers. Each bar has a label, start/end dates, row (1–4), and an optional color (Blue, Green, Amber, Teal, Slate, or Violet). The same timeline (with colors) appears in status report previews and PDFs. Each saved report stores its **own** copy of the timeline when the report is created; if you change bars or markers later, use **Refresh timeline** while **editing** that report (Standard or Milestones) on the Status Reports tab to update that copy—see [Status Reports tab](#status-reports-tab). |
| **Status Reports** | Summary table of estimated budget, $ spent, $ remaining, budgeted/actual/remaining hours, with copy-to-clipboard and a % budget used (high est.) circle chart. Create, edit, view, and export status reports. Standard and Milestones reports can **refresh the stored timeline** from the project after the Timeline tab changes—see [Status Reports tab](#status-reports-tab). |
| **Settings** | Edit project name, client, dates, status, single rate, notes, SOW/Estimate/Float/Metric links, resourcing thresholds, key roles, and optional CDA tab. Within Settings, sub-sections include **Details**, **Links**, **Key roles**, **Resourcing** (thresholds), **Rates** (per-role rate card or single bill rate), and **Assignments** (people assigned, their roles, bill-rate overrides, and “hidden from grid” for the Resourcing tab). |

Only users with edit permission can change data; the **Settings** tab may be read-only for some viewers.

### Settings tab (editors)

Open **Settings** from the project detail page. Edits in **Details**, **Links**, **Key roles**, and other sections **save automatically** a short time after you stop changing fields (you may see a brief saved indicator).

- **Renaming the project**: When you change the **project name**, Workbench may **update the page URL** to match the new slug (your tab stays on **Settings**). You do not need a full refresh for further edits or link saves to apply.

---

## Resourcing tab

The Resourcing tab shows three grids (Planned, Actual, Float) by person and by week.

- **Weeks shown**: By default, the grid includes the **full project range** (project start → project end). You do not need to click “load more” controls to see additional weeks.
- **Horizontal navigation**: When the week columns overflow, you can scroll horizontally (trackpad, scrollbar, or **Shift + mouse wheel**). The page also shows **Scroll left / Scroll right** buttons when horizontal overflow is detected.
- **Last week visibility**: When you scroll all the way to the right, the final week column remains fully visible (including its right border).
- **Current week**: The column for the **Monday–Sunday week (UTC) that contains today** has a **subtle background tint** across the week headers, all three grids (Planned, Actual, Float), and the variance/total rows—so you can quickly see which week is in progress. (Amber variance or red mismatch highlights still take priority when they apply.)
- **Collapsing Weekly Actuals**: In the **Weekly Actuals** grid title row, the small **chevron** on the right collapses or expands that grid (**Hide weekly actuals** / **Show weekly actuals**—also in the hover tooltip and for assistive technologies). When collapsed, only the title row remains and the vertical gap between **Planned** and **Float** tightens so you can compare those two grids with less scrolling. Expand again when you need to view or edit actual hours.
- **Planned grid — Ready**: Each person row has a **Ready** toggle (for Float sync). People **hidden from grid** (Settings → Assignments) are excluded. When at least one visible person has **Ready** on, the **PM**, **PGM**, and **CAD** dashboard Projects tables show an **open request** in the **Request** column (see [Dashboards and Account](#dashboards-and-account)).
- **Float grid — PTO and holidays**: When **Admin → Float sync** has run, the **Float** column can show small labels for **PTO** (Float time off) and **holiday** (regional public or team holiday matching the person’s Float region). This helps explain differences between scheduled hours and working time. Tooltip text summarizes the week (e.g. who is out, partial vs full day).

### Split weeks (month boundary)

Workbench weeks run **Monday–Sunday**. When a week crosses from one calendar month into the next, the **Actual** grid shows **two inputs** in that week’s cell—one for each month (small month labels indicate which is which). Enter hours in **quarter-hour increments** (e.g. 8, 8.25); the two values should add up to the total worked that week.

- **Why**: Monthly CDA reporting and dashboards need hours attributed to the correct calendar month even when a single week spans two months.
- **Planned / Float**: Those grids still show one value per week (unchanged). Only **Actual** uses the split when the week spans two months.
- **When you can edit**: Uses **UTC** calendar dates. The **first** month in the split becomes editable once that calendar month has ended (for example, after 31 December you can enter December’s share of a December–January week, even while that week is still in progress). The **second** month follows the same rule as other Actual cells: you can enter it after the week is **completed** (not the current week). Expand the cell (split icon) to see both inputs.
- **Clearing a month-half**: If you **clear** one of the inputs (leave it empty and move focus away), that month’s entry is **removed**—it is not saved as **0** hours. Use **0** only when you intentionally mean zero hours for that month. The week’s rolled-up total updates from whatever month parts remain.
- **Collapsing**: When both month parts are filled, you may see a single total for the week with an option to expand and edit the two parts again (depending on layout state).

---

## PTO tab

The **PTO** tab lists **PTO** (Float time off) and **regional holidays** for people assigned to the project who are **visible on the Resourcing grid** (not hidden under Settings → Assignments). You can narrow the **week range** and filter by **person**. Entries reflect data stored after **Float sync**; regional holidays apply when the person’s **Float region** matches the holiday region (same rules as scheduled hours—see [Float sync](#float-sync-admin-only)).

---

## Company PTO & Holidays

The sidebar link **PTO & Holidays** opens **`/pto-holidays`**, a company-wide view of PTO and holidays across **active people**. Use the **month** control and optional **person** / **region** filters to see who is out and how many people are on PTO in a given month. This page uses the same Float-backed data as the project **PTO** tab, aggregated for planning and visibility (not a substitute for HR systems of record).

---

## CDA tab

The **CDA** tab appears when **Enable CDA tab** is turned on in **Settings** for the project. It is used for monthly planned vs actual hours, milestones, and material you paste into status reports.

### Projected hours (Budget sub-tab)

On the **Budget** sub-tab, the card next to the monthly table shows two **forward-looking** figures (they use the same **budget high hours** as the Overall row when the Budget tab has hours; otherwise the sum of CDA planned hours). They differ from the **Overall** table’s **Remaining** hours, which is “as of today” using all month-to-date actuals including the current month.

| Label | Meaning |
|--------|---------|
| **Projected surplus at contract end** | Compares the contract hours budget to a **projected total burn** through the last CDA month: **past months** use recorded MTD actuals; the **current month** uses **planned** hours (so mid-month partial actuals do not skew the forecast); **future months** use each month’s **planned** hours. A positive value means you are projected to finish under budget; a negative value means a projected deficit. |
| **Avg hours per future month (after current plan)** | Takes hours left after **prior months’ actuals** (`budget − burned so far`), subtracts the **current month’s planned** hours as “reserved,” then divides by the number of **strictly future** contract months. If you are already in the last month of the contract, this shows “—” (nothing to spread across future months). |

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

### Saving a report

When you click **Save** (new report) or **Update** (while editing), Workbench saves the report, **closes the form**, refreshes the list, and **scrolls** the page so the **Status Reports** heading and table are in view. That makes it obvious the save succeeded and reduces the chance of clicking save again and creating a duplicate. For a **new** report, the list jumps to **page 1** (reports are ordered with the newest dates first, so your new row is usually there). Use **Preview** (eye icon) on a row when you want to open the report after saving.

### Snapshot (what stays fixed on a saved report)

When you **save a new** status report, Workbench stores a **snapshot** with the reporting period, budget (or CDA) figures, and—for Standard and Milestones variations—the **timeline** (bars and markers) as they were **at that moment**. Preview, the HTML view, and PDF export all read from that snapshot so later changes to resourcing, budget, or the **Timeline** tab do not change older reports.

- **What you can still edit** on an existing report: narrative fields (completed / upcoming / risks / meeting notes), RAG values and explanations, and **variation** where the form allows it.
- **Meeting notes with formatting**: If you paste content that includes **HTML** from another tool, the preview, HTML view, and PDF keep **allowed** formatting (paragraphs, lists, links, basic styles) and drop unsafe markup automatically.
- **What stays locked** unless you use **Refresh timeline** (below): **report date**, **reporting period**, **previous months on timeline** (the 1–4 month window chosen at create time), budget/CDA snapshot, and—by default—the **timeline** bars and markers.

### Refresh timeline (Standard and Milestones, editors only)

If you updated the project **Timeline** tab **after** a report was saved, the report still shows the **old** timeline until you refresh it:

1. Open **Edit report** for that row (pencil).
2. Under **Previous months on timeline** (read-only on edit), click **Refresh timeline**.
3. Read the confirmation dialog: it explains that the **timeline stored on this report** will be **replaced** with your project’s **current** bars and markers. Your **report date** and **how many previous months** are shown do **not** change; other snapshot data (for example budget) is **not** affected.
4. Confirm to apply, or cancel to keep the existing stored timeline.

If the project has **no** timeline the app can render (for example **no end date** so the status report timeline cannot be built), the action may fail with an error message—set the project end date and add timeline content on the **Timeline** tab first.

Very old reports **without** a stored snapshot cannot use this action; create a new report if you need a current snapshot.

If the **preview** modal is open for that same report when you refresh, the preview **reloads** so you see the updated timeline without closing it.

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

**Float data on create:** If **Admin → Float sync** has run at least once, creating a project whose **name** matches a Float project in **stored import history** (`FloatImportRun`) automatically **creates `ProjectAssignment` rows** (using Float role names and each person’s Float **job title** when roles are resolved) and **writes `FloatScheduledHours`** from the merged history—Workbench creates **`Person`** rows for any names that do not exist yet. The API response can include **`backfillFromImport`** with counts (and sometimes a note if assignments were created but no float hours were found in history; run **Float sync** again and use **Backfill** on the project if needed). Use the same **project name** as Float, or on **New project** choose a **Float project** from the dropdown when available so **`floatProjectName`** is sent—either way the lookup matches merged import history.

If you use **Float sync** first, project names in Workbench should match Float (or you can create projects and run a **backfill** after sync to apply stored Float data).

---

## Float sync (Admin only)

Admins pull scheduled hours from the **Float API** (no file upload). The app reads Float people, projects, clients, roles, tasks, **time off**, **public holidays**, and **team holidays** for the same date window and updates Workbench to match. Scheduled hours use **UTC weekdays** in that window, minus **per-person** non-working days: Float **time off** (always), plus **public** and **team** holidays **only when** the person’s **Float region** matches the holiday’s region (see Admin People **Region** below). People **without** a Float region still get **time-off** exclusions but **not** regional holiday exclusions—set regions in Float if holiday weeks should line up. Time off is matched to people the same way for **scheduled-hour totals** and for **PTO** features (Float may attach time off to **`people_ids`** rather than a single **`people_id`** field).

### Where to go

**Admin → Float sync** (`/admin/float-sync`; older bookmarks to Float Import redirect here).

### Configuration

- **`FLOAT_API_TOKEN`** — Required on the server for sync to run. Get a token from Float (Account → Integrations / API).
- **`FLOAT_API_USER_AGENT_EMAIL`** (optional) — Contact email included in the API `User-Agent` string, as Float recommends.

If the token is missing, the sync action shows an error (API returns **503**).

### Matching rules

- **Projects** — Matched by Float project id once stored on the project (`floatExternalId`), or by project **name** (normalized). Use the same names in Workbench as in Float, or run sync after creating a project so the link is stored.
- **People** — Pulled from Float; Workbench creates or updates `Person` rows (including Float id, **job title** from Float, and **Float region** id + display name when Float or holiday payloads provide them).
- **Roles** — Workbench matches Float scheduling roles and **job titles** to **Admin → Roles** names (with normalization). Unknown Float role labels appear on the sync page under **Last sync** so you can add or alias roles and run sync again. **Assignment role** resolution (when Float is allowed to set the role—see below): prefers the person’s **job title** in **Admin → People** (from Float `job_title`) when it maps to a Workbench role; otherwise uses the role name from Float tasks. If a label still does not map: **existing** assignment rows **keep** their current Workbench role; **new** rows use a stable preferred fallback (typically **Solutions Consultant**, not merely “first alphabetically”) so people are not skipped. You can always set or correct a role under **Settings → Assignments**; saving there tells Workbench **not** to overwrite that assignment’s role on future Float syncs until you turn that behavior back on (see *Assignment roles and Float sync* below).

### Holidays and sync failures

- **Admin → Holidays** (`/admin/holidays`) lists raw **public** and **team** holiday rows from Float (same default date window as sync). Use **Reload** to refetch; nothing is stored in Workbench for this page in v1.
- If Float **time off** or **holiday** API calls fail during sync, the sync **errors** (so totals are not silently wrong). Fix token/network issues and run sync again.

### What sync does

- **Assignments:** Updates **project assignments** for everyone on a Float **task** in the window—including people who end up with **no** weekly Float hours (for example **zero hours per day** on the task, or the week’s working days all excluded by PTO/holidays). Those people still get an assignment so they show on the project; the **Float** column may be empty for weeks with no scheduled time.
- **Float scheduled hours (Admin API sync):** Writes **Float scheduled hours** for the **Float** grid by **upserting** incomplete weeks (current and future through the sync window) that appear in the merged Float snapshot. **Admin → Float sync** does **not** bulk-delete all future `FloatScheduledHours` for every in-sync pair before writing—doing so would wipe weeks that exist in Workbench from **backfill** or prior runs but are **outside** the current API task window. Instead, weeks present in this run are written with **`INSERT … ON CONFLICT`**, and **future** rows are cleared only for **(project, person)** pairs that **no longer appear** on the project in Float (see below). **Completed** past weeks are **not** overwritten. If you rely on a full refresh of every future week from Float alone, run **Admin → Float sync** on a window that includes those weeks, or use **Backfill** / **Restore hours from import history** when you need to realign from stored snapshots.
- **Removed in Float:** If someone no longer appears on a project in Float for the synced snapshot, their **future** Float scheduled hours for that project are cleared in Workbench. Past weeks and the **assignment** row are left until you change them under **Settings → Assignments**.

### What sync does **not** change

- **Planned** hours — Float sync never writes to the **Planned** grid (`PlannedHours`). Use **Settings → Sync plan from Float** on the project to copy stored Float scheduled hours into Planned for every week that has Float data (past, current, future), or edit Planned in the Resourcing grid for **current and future** weeks only (past Planned is read-only in the grid).
- **Actual** hours — not touched by Float sync.

### When Planned and Float still disagree

- **You didn’t copy Float → Planned:** The **Float** column updates from Admin Float sync; **Planned** does not, until you sync the plan (Settings) or edit Planned / use **Sync plan from Float** on the Resourcing tab (future/current weeks).
- **Past week in Float product ≠ Workbench Float column:** Admin Float sync **does not overwrite past** `FloatScheduledHours` rows. Workbench can keep an older snapshot; Planned (after **Sync plan from Float**) will match that snapshot, not necessarily today’s historical view in Float. **Backfill** reapplies stored import JSON and can refresh hours for past weeks when the import data is newer.

### Limits

- **Rate limiting:** In production, if Redis is configured, sync is rate-limited (e.g. 20 requests per 15 minutes per user).

### Restore hours from import history (all projects)

On **Admin → Float sync**, **Restore hours from import history (all projects)** repopulates **Float scheduled hours** for **every** project from stored Float sync snapshots (`FloatImportRun`), using the **same merge rules** as **Backfill** on a single project (Projects list or project settings). Use it after a problematic sync or when many projects need historical float rows restored at once—only works if **Float sync** has run before so import history exists. Confirm the dialog before the operation runs.

### Assignment roles and Float sync

- By default, Float sync **updates** each project assignment’s **role** when it can resolve Float’s job title or scheduling role to a Workbench role.
- If you **change a person’s role** in **Settings → Assignments** and save, Workbench **stops** applying Float’s role for that person on that project on future syncs, so your choice sticks (see Technical Reference: `ProjectAssignment.syncRoleFromFloat`). To let Float drive the role again for that row, **remove the assignment and add the person again** (new assignments default to following Float), or have a developer set `syncRoleFromFloat` back to true in the database.
- Keep **Admin → People** **job titles** accurate (they come from Float) so assignment roles align with how your org titles map to Workbench roles.

---

## Admin: Roles, People, and Users (Admin only)

Available from the **Admin** entry in the **sidebar** (admins only).

| Page | Purpose |
|------|---------|
| **Roles** | Create and manage roles (e.g. Project Manager, FE Developer). Role names must match the ones used on assignments and in Float. |
| **People** | Manage people (name, email, active). These are the resources that appear on project assignments and Float sync. The **Region** column shows each person’s **Float region** by name when the last sync could resolve one (from people and/or holiday API data); otherwise **Region (id)** if only the numeric id is known, or **—** if unset—used for regional public/team holiday handling in Float scheduled hours. |
| **Holidays** | Read-only view of Float **public** and **team** holidays (API JSON) for troubleshooting schedules and regions. |
| **Users** | Manage app logins (email and password) and permissions. Set **User** or **Admin**, and optionally set a **position role** (Project Manager, Program Manager, Client Account Director) so “My Projects” shows the right list. Use **Edit** on a row to open the edit dialog (see below)—including **New password** to reset someone’s password without changing their email. |

### Admin → Users

Open **Admin → Users** (`/admin/users`). At the top you can **create** a user (email, password, names, permissions, optional position role). Below, a **table** lists existing users.

- **Edit** — In the **Actions** column on the right, click **Edit** to change names, permissions, position role, and optionally set a **new password** (leave blank to keep the current password). **Save** applies changes; **Cancel** closes the dialog.
- **Narrow layouts** — If your browser window is small, the user table can scroll **horizontally** inside its card so **Edit** stays available. Long emails or names may show truncated with an ellipsis; hover the cell (or use your browser’s tooltip behavior) to see the full value when a native `title` tooltip is shown.

---

## Dashboards and Account

- **PM Dashboard** (`/pm-dashboard`): Projects where you are Project Manager.
- **PGM Dashboard** (`/pgm-dashboard`): Projects where you are Program Manager.
- **CAD Dashboard** (`/cad-dashboard`): Projects where you are Client Account Director.

Each dashboard includes **portfolio summary cards** (e.g. portfolio value, active project counts) and, when revenue recovery data exists, **portfolio revenue recovery** cards for **To date**, **This week** (most recent completed week), and **Previous 4 weeks**.

Below the portfolio cards, an **Upcoming PTO & holidays** section lists the **current and next ISO weeks** (Monday start) and, for each of your scoped projects, who is on **PTO** or a **holiday** among visible assignees. Use it as a quick visibility aid alongside the project tables.

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
| **Actuals** | Whether weekly actuals look up to date, one week behind, or more than one week behind (traffic-light), based on **rolled-up weekly totals** vs planned for completed weeks. For **split-month** weeks, totals come from the sum of the two month parts once saved. The **Resourcing** Actual grid uses stricter per-month rules for **cell** highlighting on those weeks. |
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
| **Float** | Scheduled hours imported from Float via **Float sync** (API). |

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
| **Project names must match** (Float) | Create projects in Workbench with names that match Float, or run sync so `floatExternalId` is set. Add missing roles in Admin → Roles and sync again if needed. |
| **Float API not configured** | Set `FLOAT_API_TOKEN` in the server environment. |
| **Too many sync requests** | Wait and try again later; sync is rate-limited when Redis is configured. |
| **Page looks broken** (overlapping layout, wrong styles, sidebar over content) | Try a **hard refresh** (e.g. Mac: `Cmd+Shift+R`). If it persists, a **browser extension** may be injecting styles or scripts — see *Browser extensions* below. |

### Browser extensions

Some Chrome extensions can inject CSS or JavaScript into every page and break Project Workbench’s layout and styling. If the site looks correct in an **Incognito/Private** window but broken in a normal tab, the cause is likely an extension.

- **What to do:** Disable extensions one by one (or use Incognito for Workbench) until the layout is normal. Then either leave that extension disabled or restrict it so it doesn’t run on the Workbench site: right‑click the extension icon → **Manage extension** → set site access to *On specific sites* and remove your Workbench URL, or *On click*.
- **Known problematic extension:** The [Google Maps API Key Checker](https://chromewebstore.google.com/detail/google-maps-api-key-check/gjpanmpojpplcipiaigglekleicmgmel) extension has been observed to break the UI; disabling it or excluding the Workbench domain fixes the issue.

---

*For setup, deployment, and technical details, see the Technical documentation and the main README.*
