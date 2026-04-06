import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_ztjogiyzymicyqtxmleo",
  dirs: ["./trigger"],
  /** Seconds (compute-time). Float sync can be slow on large accounts; raise if runs time out. */
  maxDuration: 900,
});
