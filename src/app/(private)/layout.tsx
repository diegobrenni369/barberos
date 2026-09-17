import { PrivateSidebar } from "@/components/private-sidebar";
import { requireAuth } from "@/lib/auth";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <div className="min-h-screen bg-slate-50 md:flex"><PrivateSidebar /><main className="w-full p-6 md:p-10">{children}</main></div>;
}
