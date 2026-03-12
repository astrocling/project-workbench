# Status report view and PDF export — implementation plan

Use this doc in a fresh context: implement in the order below. All paths are relative to the project root.

---

## Current behavior

- **Preview**: Fetches `GET /api/projects/[id]/status-reports/[reportId]/pdf/data` (JSON), then uses `PDFViewer` from `@react-pdf/renderer` to render `StatusReportDocument` in the browser. The client runs the full PDF layout on every preview.
- **Download**: Server runs `app/api/projects/[id]/status-reports/[reportId]/pdf/route.ts` — `buildStatusReportPdfData`, `registerStatusReportFonts`, `renderToBuffer` — on every "Download PDF". No caching of the rendered PDF.

**Key files**

- `app/api/projects/[id]/status-reports/[reportId]/pdf/route.ts` — PDF generation (GET)
- `app/api/projects/[id]/status-reports/[reportId]/pdf/data/route.ts` — JSON data for preview
- `lib/statusReportPdfData.ts` — `buildStatusReportPdfData(projectId, reportId)`
- `lib/statusReportFonts.ts` — `registerStatusReportFonts(baseUrl)`
- `components/pdf/StatusReportDocument.tsx` — React-PDF document (uses `StatusReportPDFData`)
- `components/StatusReportPreview.tsx` — Modal that fetches pdf/data and uses PDFViewer + StatusReportDocument
- `app/api/projects/[id]/status-reports/[reportId]/route.ts` — GET/PATCH/DELETE report; call blob invalidation and revalidateTag here on PATCH/DELETE

---

## 1. View report as HTML page; export PDF only when sharing

**Goal**: View = HTML page that looks like the PDF. PDF generation only when user clicks "Download PDF".

**Steps**

1. Reuse `StatusReportPDFData` from `buildStatusReportPdfData` (same type as in `components/pdf/StatusReportDocument.tsx`).
2. Add an HTML view that mirrors the PDF layout (same sections, RAG blocks, timeline, budget donut, footer). Options:
   - New route: `app/(app)/projects/[id]/status-reports/[reportId]/view/page.tsx` — server component that loads data (e.g. via `buildStatusReportPdfData` or cached) and renders an HTML component.
   - New component: e.g. `components/StatusReportView.tsx` — receives `StatusReportPDFData`, renders divs/CSS to match the PDF (reuse colors/spacing from `lib/brandColors.ts` and the PDF component where possible).
3. Change preview UX so it no longer uses PDFViewer:
   - Option A: Preview opens the view route in an iframe (or new tab).
   - Option B: Preview modal renders the HTML view component inline (fetch pdf/data and pass to the HTML component).
4. Keep "Download PDF" as a link/button to the existing PDF route: `/api/projects/${projectId}/status-reports/${reportId}/pdf?download=1`.
5. Optional: Add print-friendly CSS (`@media print`) so browser Print matches the PDF.

**Data**: View page can call `buildStatusReportPdfData` (or use cached data — see Section 4). Ensure auth: only allow viewing if user can access the project/report.

---

## 2. Cache rendered PDF in blob storage (export path)

**Where**: `app/api/projects/[id]/status-reports/[reportId]/pdf/route.ts`.

**Steps**

1. Add `@vercel/blob` (or chosen storage). Create `lib/statusReportPdfCache.ts` with:
   - `getCachedPdf(reportId): Promise<Uint8Array | null>`
   - `setCachedPdf(reportId, buffer: Buffer | Uint8Array): Promise<void>`
   - `deleteCachedPdf(reportId): Promise<void>`
2. In the PDF route GET: try `getCachedPdf(reportId)`. If hit, return that buffer with appropriate `Content-Type` and `Content-Disposition` (from query e.g. `download=1`). If miss: run existing logic (build data, register fonts, renderToBuffer), then `setCachedPdf(reportId, buffer)` and return.
3. In `app/api/projects/[id]/status-reports/[reportId]/route.ts`: in PATCH and DELETE handlers, after updating/deleting the report, call `deleteCachedPdf(reportId)` so the cached PDF is invalidated.

**Freshness**: Blob is invalidated on report PATCH/DELETE.

---

## 3. Register fonts once per invocation

**Where**: `lib/statusReportFonts.ts` and the PDF route.

**Steps**

1. In `lib/statusReportFonts.ts`, add a module-level guard (e.g. `let fontsRegisteredForBase: string | null = null`). At the start of `registerStatusReportFonts(baseUrl)`, if `fontsRegisteredForBase === baseUrl` (or same path), return without calling `Font.register`. Otherwise call `Font.register` and set `fontsRegisteredForBase = baseUrl`.
2. No change required in the PDF route if it always passes the same server path; the guard avoids duplicate work when the same serverless instance serves multiple PDF requests.

---

## 4. PDF data route cache (for view or legacy preview)

**Where**: `app/api/projects/[id]/status-reports/[reportId]/pdf/data/route.ts`.

**Steps**

1. Wrap the data fetch in `unstable_cache`:
   - Key: `["status-report-pdf-data", reportId]`
   - Revalidate: 30 or 60 seconds
   - Tag: e.g. `status-report-${reportId}` (or a tag that can be invalidated per report).
2. In `app/api/projects/[id]/status-reports/[reportId]/route.ts`, in PATCH and DELETE, call `revalidateTag(`status-report-${reportId}`)` (or the tag you chose) so the cached data is invalidated when the report changes.

**Freshness**: Cache invalidated on report PATCH/DELETE via revalidateTag.

---

## Data freshness summary

| Area     | How freshness is kept              |
| -------- | ----------------------------------- |
| PDF blob | Delete blob on report PATCH/DELETE |
| PDF data | revalidateTag on report PATCH/DELETE |

---

## Implementation order

1. **View as HTML (Section 1)** — Add view route + HTML component; switch preview to use it; keep "Download PDF" for export only.
2. **PDF blob cache (Section 2)** — Add cache helper and use in PDF route; invalidate on report PATCH/DELETE.
3. **Font guard (Section 3)** — Skip re-registering when already done in `lib/statusReportFonts.ts`.
4. **PDF data cache (Section 4)** — unstable_cache + tag in pdf/data route; revalidateTag in report PATCH/DELETE.
