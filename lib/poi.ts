import type { PoiCategory } from "@/lib/types";

export const POI_CATEGORIES: {
  value: PoiCategory;
  label: string;
  emoji: string;
  defaultColor: string;
}[] = [
  { value: "depot", label: "Depot", emoji: "🏭", defaultColor: "#0ea5e9" },
  { value: "customer", label: "Customer site", emoji: "📍", defaultColor: "#a855f7" },
  { value: "fuel", label: "Fuel station", emoji: "⛽", defaultColor: "#f59e0b" },
  { value: "service", label: "Service / repair", emoji: "🔧", defaultColor: "#6366f1" },
  { value: "hospital", label: "Hospital", emoji: "🏥", defaultColor: "#ef4444" },
  { value: "police", label: "Police", emoji: "🚓", defaultColor: "#1e40af" },
  { value: "landmark", label: "Landmark", emoji: "🗺️", defaultColor: "#10b981" },
  { value: "other", label: "Other", emoji: "📌", defaultColor: "#64748b" },
];

export function categoryMeta(c: PoiCategory) {
  return POI_CATEGORIES.find((x) => x.value === c) || POI_CATEGORIES[7];
}
