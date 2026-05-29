import { atom, map } from "nanostores";

export type FilterType = "all" | "owned" | "missing";

export const $owned = map<Record<string, boolean>>({});
export const $repeats = map<Record<string, number>>({});
export const $activeFilter = atom<FilterType>("all");
export const $activeSection = atom<string>("");
export const $hydrated = atom<boolean>(false);

export function incrementSticker(number: string) {
  const isOwned = $owned.get()[number] ?? false;
  if (!isOwned) {
    $owned.setKey(number, true);
  } else {
    const currentRepeats = $repeats.get()[number] ?? 0;
    $repeats.setKey(number, currentRepeats + 1);
  }
}

export function decrementSticker(number: string) {
  const currentRepeats = $repeats.get()[number] ?? 0;
  if (currentRepeats > 0) {
    $repeats.setKey(number, currentRepeats - 1);
  } else {
    $owned.setKey(number, false);
  }
}

export function setRepeat(number: string, count: number) {
  const next = Math.max(0, count);
  if (next === 0) {
    const { [number]: _, ...rest } = $repeats.get();
    $repeats.set(rest);
  } else {
    $repeats.setKey(number, next);
  }
}

export function incrementRepeat(number: string) {
  setRepeat(number, ($repeats.get()[number] ?? 0) + 1);
}

export function decrementRepeat(number: string) {
  setRepeat(number, ($repeats.get()[number] ?? 0) - 1);
}
