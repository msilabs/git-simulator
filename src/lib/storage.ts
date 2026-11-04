/**
 * ব্রাউজারের localStorage-এ সেশন রাখা।
 * প্রাইভেট উইন্ডো, ব্লক করা বা ভরা স্টোরেজে localStorage exception দিতে পারে, তাই প্রতিটা
 * read/write try/catch-এ মোড়ানো। সেভ ব্যর্থ হলে `saveSession` false ফেরত দেয়, যাতে UI জানাতে পারে।
 *
 * ভার্সন ২: পুরো state-এর বদলে ভিত্তি-state + কমান্ডের তালিকা (দেখুন session.ts)।
 * ভার্সন ১ (পুরোনো): পুরো state; পড়ার সময় ভিত্তি হিসেবে নেওয়া হয়, undo-র ইতিহাস থাকে না।
 */
import type { SimState } from "./git/types";
import {
  freshSession,
  isStringArray,
  isValidLines,
  isValidSimState,
  normalizeSimState,
  MAX_HISTORY,
  MAX_LINES,
  replay,
  type Session,
  type TerminalLine,
} from "./session";

export type { TerminalLine };

const KEY = "msilabs-git-simulator:v1";

interface SavedV2 {
  readonly v: 2;
  readonly base: SimState;
  readonly log: readonly string[];
  readonly lines: readonly TerminalLine[];
  readonly history: readonly string[];
  readonly step: number;
}

export type LoadResult =
  | { readonly status: "empty" }
  | { readonly status: "ok"; readonly session: Session }
  | { readonly status: "corrupt" };

/** সেভ করা ডেটাকে পূর্ণ যাচাই করে Session বানায়; নষ্ট হলে "corrupt"। */
export function parseSaved(raw: string | null): LoadResult {
  if (!raw) return { status: "empty" };
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return { status: "corrupt" };
    const d = data as Record<string, unknown>;
    const lines = isValidLines(d.lines) ? d.lines.slice(-MAX_LINES) : null;
    const history = isStringArray(d.history) ? d.history.slice(-MAX_HISTORY) : null;
    const step = typeof d.step === "number" && d.step >= 0 ? d.step : 0;
    if (!lines || !history) return { status: "corrupt" };

    let base: SimState;
    let log: readonly string[] = [];
    if (d.v === 2 && isValidSimState(d.base) && isStringArray(d.log)) {
      base = d.base;
      log = d.log;
    } else if (d.v === 1 && isValidSimState(d.sim)) {
      base = d.sim; // পুরোনো সেভ: undo-র ইতিহাস ছাড়া
    } else {
      return { status: "corrupt" };
    }
    base = normalizeSimState(base);
    const replayed = replay(base, log);
    const nextId = Math.max(0, ...lines.map((l) => l.id)) + 1;
    return { status: "ok", session: { ...freshSession(), ...replayed, base, lines, history, step, nextId } };
  } catch {
    return { status: "corrupt" };
  }
}

export function loadSession(): LoadResult {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return { status: "empty" };
  }
  return parseSaved(raw);
}

export function serializeSession(s: Session): string {
  const saved: SavedV2 = { v: 2, base: s.base, log: s.log, lines: s.lines, history: s.history, step: s.step };
  return JSON.stringify(saved);
}

/** সফল হলে true; স্টোরেজ বন্ধ বা ভরা হলে false। */
export function saveSession(s: Session): boolean {
  try {
    window.localStorage.setItem(KEY, serializeSession(s));
    return true;
  } catch {
    return false;
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // উপেক্ষা
  }
}
