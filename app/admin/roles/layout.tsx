import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roles",
};

export default function AdminRolesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
