import { redirect } from "next/navigation";

export const metadata = {
  title: "CAD Dashboard",
};

/** Redirect old dashboard URL to projects (dashboard layout exists on other branches). */
export default function CADDashboardRedirect() {
  redirect("/projects");
}
