"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronsUpDown, LayoutDashboard, LogOut, Scissors, Settings, Sparkles, Users, Wrench, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "@/components/ui/sidebar";

const groups: { label: string; items: { title: string; url: string; icon: LucideIcon; disabled?: boolean }[] }[] = [
  { label: "Principal", items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }, { title: "Agenda", url: "/agenda", icon: CalendarDays }, { title: "Caja", url: "/cash", icon: Wallet }] },
  { label: "Gestión", items: [{ title: "Clientes", url: "/customers", icon: Users }, { title: "Barberos", url: "/barbers", icon: Scissors }, { title: "Servicios", url: "/services", icon: Wrench }] },
  { label: "Administración", items: [{ title: "Configuración", url: "/settings", icon: Settings }] },
];

export function PrivateSidebar({ user, barbershop }: { user: { name: string; email: string }; barbershop?: string }) {
  const pathname = usePathname(); const initials = user.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  return <Sidebar collapsible="icon"><SidebarHeader><SidebarMenu><SidebarMenuItem><SidebarMenuButton size="lg" render={<Link href="/dashboard" />}><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-4" /></span><span className="grid text-left leading-tight"><span className="font-semibold">BarberOS</span><span className="truncate text-xs text-muted-foreground">{barbershop ?? "Tu barbería"}</span></span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarHeader><SidebarContent>{groups.map((group) => <SidebarGroup key={group.label}><SidebarGroupLabel>{group.label}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{group.items.map((item) => <SidebarMenuItem key={item.title}><SidebarMenuButton isActive={pathname === item.url} tooltip={item.title} render={<Link href={item.url} aria-disabled={item.disabled} className={item.disabled ? "pointer-events-none opacity-50" : undefined} />}><item.icon /><span>{item.title}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup>)}</SidebarContent><SidebarFooter><SidebarMenu><SidebarMenuItem><DropdownMenu><DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}><Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg">{initials}</AvatarFallback></Avatar><span className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">{user.name}</span><span className="truncate text-xs text-muted-foreground">{user.email}</span></span><ChevronsUpDown className="ml-auto size-4" /></DropdownMenuTrigger><DropdownMenuContent side="top" align="end" className="w-56"><DropdownMenuLabel>{user.name}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} variant="destructive"><LogOut />Cerrar sesión</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarMenuItem></SidebarMenu></SidebarFooter><SidebarRail /></Sidebar>;
}
