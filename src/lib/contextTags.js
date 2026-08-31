import { Droplet, Activity, Utensils, Dumbbell, Plane, CalendarClock, Check } from "lucide-react";

export const CONTEXT_TAGS = [
  { id: "retencao", label: "Retenção / inchaço", Icon: Droplet },
  { id: "intestino", label: "Intestino", Icon: Activity },
  { id: "alimentacao", label: "Alimentação diferente", Icon: Utensils },
  { id: "treino", label: "Mudança no treino", Icon: Dumbbell },
  { id: "viagem", label: "Viagem / doença", Icon: Plane },
  { id: "rotina", label: "Rotina fora do normal", Icon: CalendarClock },
  { id: "nada", label: "Nada fora do normal", Icon: Check },
];

// Subconjunto oferecido no gatilho por pesagem (SignalCard).
export const SIGNAL_TAG_IDS = ["retencao", "intestino", "alimentacao", "treino", "viagem", "nada"];

// Subconjunto oferecido no gatilho por tendência (TrendCard).
export const TREND_TAG_IDS = ["retencao", "alimentacao", "treino", "rotina"];

export const CONTEXT_TAG_IDS = CONTEXT_TAGS.map((t) => t.id);

export function tagById(id) {
  return CONTEXT_TAGS.find((t) => t.id === id) || null;
}
