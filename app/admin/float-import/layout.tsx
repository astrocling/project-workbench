import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Float import",
};

export default function FloatImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
