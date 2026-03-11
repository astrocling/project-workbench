import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "People",
};

export default function AdminPeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
