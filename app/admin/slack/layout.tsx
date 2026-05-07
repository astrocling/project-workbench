import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Slack",
};

export default function AdminSlackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
