/**
 * Cache for rendered status report PDFs in Vercel Blob.
 * Blob is invalidated on report PATCH/DELETE via deleteCachedPdf(reportId).
 */

import { get, put, del } from "@vercel/blob";

const PREFIX = "status-reports";
const CACHE_PATH = (reportId: string) => `${PREFIX}/${reportId}.pdf`;

/**
 * Returns the cached PDF buffer for a report, or null if not found.
 */
export async function getCachedPdf(reportId: string): Promise<Uint8Array | null> {
  try {
    const pathname = CACHE_PATH(reportId);
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const arrayBuffer = await new Response(result.stream).arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Stores the rendered PDF buffer for a report. Overwrites if already present.
 */
export async function setCachedPdf(
  reportId: string,
  buffer: Buffer | Uint8Array
): Promise<void> {
  const pathname = CACHE_PATH(reportId);
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await put(pathname, body, {
    access: "private",
    contentType: "application/pdf",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/**
 * Removes the cached PDF for a report. Call on report PATCH/DELETE.
 * Uses pathname for delete so we avoid listing all blobs under the prefix.
 */
export async function deleteCachedPdf(reportId: string): Promise<void> {
  try {
    const pathname = CACHE_PATH(reportId);
    await del(pathname);
  } catch {
    // Ignore: blob may not exist or store may be unavailable
  }
}
