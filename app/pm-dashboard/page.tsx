import { redirect } from "next/navigation";

export const metadata = {
  title: "PM Dashboard",
};

/** Redirect old dashboard URL to projects (dashboard layout exists on other branches). */
export default function PMDashboardRedirect() {
  redirect("/projects");
}
