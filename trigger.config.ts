import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_ztjogiyzymicyqtxmleo",
  dirs: ["./trigger"],
  /** Node 24 LTS. Omit this and Trigger.dev defaults to Node 21, which new deploys reject after 5 Oct 2026. */
  runtime: "node-24",
  /** Seconds (compute-time). Float sync can be slow on large accounts; raise if runs time out. */
  maxDuration: 900,
});
