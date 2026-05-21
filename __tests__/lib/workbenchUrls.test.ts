import { afterEach, describe, expect, it } from "vitest";
import {
  getWorkbenchBaseUrl,
  projectResourcingUrl,
  projectStatusReportsUrl,
  projectTabUrl,
} from "@/lib/workbenchUrls";

describe("workbenchUrls", () => {
  const originalBaseUrl = process.env.WORKBENCH_BASE_URL;

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.WORKBENCH_BASE_URL;
    } else {
      process.env.WORKBENCH_BASE_URL = originalBaseUrl;
    }
  });

  describe("getWorkbenchBaseUrl", () => {
    it("defaults when WORKBENCH_BASE_URL is unset", () => {
      delete process.env.WORKBENCH_BASE_URL;
      expect(getWorkbenchBaseUrl()).toBe("https://pw.theclingans.com");
    });

    it("strips trailing slash", () => {
      process.env.WORKBENCH_BASE_URL = "https://staging.example.com/";
      expect(getWorkbenchBaseUrl()).toBe("https://staging.example.com");
    });
  });

  describe("projectTabUrl", () => {
    it("builds tab deep links", () => {
      process.env.WORKBENCH_BASE_URL = "https://pw.example.com";
      expect(projectTabUrl("acme-campaign", "resourcing")).toBe(
        "https://pw.example.com/projects/acme-campaign?tab=resourcing"
      );
    });
  });

  describe("projectResourcingUrl", () => {
    it("builds resourcing tab deep links", () => {
      process.env.WORKBENCH_BASE_URL = "https://pw.example.com";
      expect(projectResourcingUrl("acme-campaign")).toBe(
        "https://pw.example.com/projects/acme-campaign?tab=resourcing"
      );
    });
  });

  describe("projectStatusReportsUrl", () => {
    it("builds status-reports tab deep links", () => {
      process.env.WORKBENCH_BASE_URL = "https://pw.example.com";
      expect(projectStatusReportsUrl("acme-campaign")).toBe(
        "https://pw.example.com/projects/acme-campaign?tab=status-reports"
      );
    });
  });
});
