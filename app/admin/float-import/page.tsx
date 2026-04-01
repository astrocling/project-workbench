import { redirect } from "next/navigation";

/** @deprecated Use `/admin/float-sync`. */
export default function FloatImportRedirectPage() {
  redirect("/admin/float-sync");
}
