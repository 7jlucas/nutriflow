import type { DiaryEntry } from "../types";

/**
 * Estado otimista do diário. Toda mutação é endereçada por id,
 * editar substitui o item (nunca duplica), remover tira exatamente um item.
 */
export type DiaryAction =
  | { type: "set"; entries: DiaryEntry[] }
  | { type: "add"; entry: DiaryEntry }
  | { type: "confirm"; tempId: string; entry: DiaryEntry }
  | { type: "update"; entry: DiaryEntry }
  | { type: "remove"; id: string }
  | { type: "addMany"; entries: DiaryEntry[] };

export function diaryReducer(state: DiaryEntry[], action: DiaryAction): DiaryEntry[] {
  switch (action.type) {
    case "set":
      return dedupe(action.entries);
    case "add":
      return dedupe([...state, action.entry]);
    case "addMany":
      return dedupe([...state, ...action.entries]);
    case "confirm": {
      const replaced = state.map((e) => (e.id === action.tempId ? action.entry : e));
      return dedupe(replaced);
    }
    case "update":
      return state.map((e) => (e.id === action.entry.id ? action.entry : e));
    case "remove":
      return state.filter((e) => e.id !== action.id);
  }
}

function dedupe(list: DiaryEntry[]): DiaryEntry[] {
  const seen = new Map<string, DiaryEntry>();
  for (const e of list) seen.set(e.id, e);
  return [...seen.values()].sort(
    (a, b) => (a.logged_time ?? "").localeCompare(b.logged_time ?? "") || a.created_at.localeCompare(b.created_at),
  );
}

export const tempId = () => `temp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
export const isTemp = (id: string) => id.startsWith("temp-");
