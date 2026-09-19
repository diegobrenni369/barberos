import { Badge } from "@/components/ui/badge";
export function StatusBadge({ active }: { active: boolean }) { return <Badge variant={active ? "default" : "secondary"} className={active ? "bg-emerald-600 hover:bg-emerald-600" : undefined}>{active ? "Activo" : "Inactivo"}</Badge>; }
