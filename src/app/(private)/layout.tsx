import { PrivateSidebar } from "@/components/private-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentMembership, requireAuth } from "@/lib/auth";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth(); const membership = await getCurrentMembership();
  return <TooltipProvider><SidebarProvider className="has-[[data-agenda-workspace]]:h-dvh has-[[data-agenda-workspace]]:overflow-hidden"><PrivateSidebar user={{ name: user.name, email: user.email }} barbershop={membership?.barbershop.name} /><SidebarInset className="min-w-0 has-[[data-agenda-workspace]]:min-h-0"><header className="flex h-14 shrink-0 items-center gap-2 border-b px-4"><SidebarTrigger /><span className="text-sm font-medium text-muted-foreground">{membership?.barbershop.name ?? "BarberOS"}</span></header><main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 has-[[data-agenda-workspace]]:flex has-[[data-agenda-workspace]]:min-h-0 has-[[data-agenda-workspace]]:flex-col has-[[data-agenda-workspace]]:p-0"><div className="mx-auto w-full min-w-0 max-w-6xl has-[[data-agenda-workspace]]:max-w-none has-[[data-agenda-workspace]]:flex has-[[data-agenda-workspace]]:min-h-0 has-[[data-agenda-workspace]]:flex-1 has-[[data-agenda-workspace]]:flex-col">{children}</div></main></SidebarInset></SidebarProvider></TooltipProvider>;
}
