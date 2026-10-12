// Keep the same meanings as Web; colors never determine business state.
export const semanticColors = {
  blue: { background: "#eff6ff", text: "#1d4ed8", border: "#d5e6fc", indicator: "#3b82f6" },
  green: { background: "#ecfdf5", text: "#047857", border: "#c7eddd", indicator: "#10b981" },
  amber: { background: "#fffbeb", text: "#92400e", border: "#f5e6bd", indicator: "#d97706" },
  red: { background: "#fef2f2", text: "#b91c1c", border: "#f5d7d7", indicator: "#ef4444" },
  neutral: { background: "#f1f5f9", text: "#475569", border: "#e2e8f0", indicator: "#94a3b8" },
};

export function paymentTone(label: string) {
  if (label === "Pagada" || label === "Pagado") return "green";
  if (label.startsWith("Parcialmente") || label.startsWith("Pendiente")) return "amber";
  if (label === "Venta anulada") return "red";
  return "neutral";
}
