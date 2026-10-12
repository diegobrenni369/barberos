import { Badge } from "@/components/ui/badge";
import { semanticColors } from "@/lib/semantic-colors";

export function StatusBadge({ active }: { active: boolean }) {
  const palette = semanticColors[active ? "green" : "neutral"];
  return <Badge variant="outline" className={`${palette.tint} ${palette.text}`}>{active ? "Activo" : "Inactivo"}</Badge>;
}
