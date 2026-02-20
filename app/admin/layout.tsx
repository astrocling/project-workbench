import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex gap-6">
          <Link href="/projects" className="text-blue-600 hover:underline">
            ← Projects
          </Link>
          <Link href="/admin/float-import" className="text-blue-600 hover:underline">
            Float Import
          </Link>
          <Link href="/admin/roles" className="text-blue-600 hover:underline">
            Roles
          </Link>
          <Link href="/admin/users" className="text-blue-600 hover:underline">
            Users
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
