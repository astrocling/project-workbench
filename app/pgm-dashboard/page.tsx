import { redirect } from "next/navigation";

export const metadata = {
  title: "PGM Dashboard",
};

/** Redirect old dashboard URL to projects (dashboard layout exists on other branches). */
export default function PGMDashboardRedirect() {
  redirect("/projects");
}
