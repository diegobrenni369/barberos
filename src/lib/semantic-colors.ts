// Presentation only: shared meanings for appointment and financial states.
export const semanticColors = {
  blue: { text: "text-blue-700 dark:text-blue-300", tint: "border-blue-200/70 bg-blue-50/60 dark:border-blue-800/50 dark:bg-blue-950/20", indicator: "bg-blue-500 dark:bg-blue-400" },
  green: { text: "text-emerald-700 dark:text-emerald-300", tint: "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/20", indicator: "bg-emerald-500 dark:bg-emerald-400" },
  amber: { text: "text-[#92400e] dark:text-[#fcd34d]", tint: "border-amber-200/70 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20", indicator: "bg-amber-500 dark:bg-amber-400" },
  red: { text: "text-red-700 dark:text-red-300", tint: "border-red-200/70 bg-red-50/60 dark:border-red-800/50 dark:bg-red-950/20", indicator: "bg-red-500 dark:bg-red-400" },
  neutral: { text: "text-muted-foreground", tint: "border-border bg-muted/50", indicator: "bg-slate-400 dark:bg-slate-500" },
};

export function paymentTone(label: string) {
  if (label === "Pagada" || label === "Pagado") return "green";
  if (label.startsWith("Parcialmente") || label.startsWith("Pendiente")) return "amber";
  if (label === "Venta anulada") return "red";
  return "neutral";
}
