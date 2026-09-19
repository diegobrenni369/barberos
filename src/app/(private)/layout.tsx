import { PrivateSidebar } from "@/components/private-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentMembership, requireAuth } from "@/lib/auth";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth(); const membership = await getCurrentMembership();
  return <TooltipProvider><SidebarProvider><PrivateSidebar user={{ name: user.name, email: user.email }} barbershop={membership?.barbershop.name} /><SidebarInset><header className="flex h-14 shrink-0 items-center gap-2 border-b px-4"><SidebarTrigger /><Separator orientation="vertical" className="h-4" /><span className="text-sm font-medium text-muted-foreground">{membership?.barbershop.name ?? "BarberOS"}</span></header><main className="flex-1 p-4 sm:p-6 lg:p-8"><div className="mx-auto w-full max-w-6xl">{children}</div></main></SidebarInset></SidebarProvider></TooltipProvider>;
}
