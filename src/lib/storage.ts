/**
 * ব্রাউজারের localStorage-এ সিমুলেটরের অবস্থা রাখা।
 * প্রাইভেট উইন্ডো বা ব্লক করা স্টোরেজে localStorage ব্যবহার করলে exception হতে পারে,
 * তাই প্রতিটা read/write try/catch-এ মোড়ানো; ব্যর্থ হলে অ্যাপ শুধু সেভ ছাড়াই চলে।
 */
import type { SimState } from "./git/types";

export type LineKind = "input" | "output" | "error" | "explain" | "explain-error" | "welcome";

export interface TerminalLine {
  readonly id: number;
  readonly kind: LineKind;
  readonly text: string;
  /** শুধু "input" লাইনে: কমান্ড দেওয়ার সময়কার prompt */
  readonly prompt?: string;
}

export interface SavedSession {
  readonly v: 1;
  readonly sim: SimState;
  readonly lines: TerminalLine[];
  readonly history: string[];
  readonly step: number;
  /** "আগের ধাপে ফেরা"-র জন্য আগের অবস্থাগুলো (v2-এ যোগ হয়েছে, তাই পুরোনো সেভে নাও থাকতে পারে) */
  readonly past?: { sim: SimState; command: string }[];
}

const KEY = "msilabs-git-simulator:v1";
const MAX_LINES = 400;
const MAX_HISTORY = 100;

export function loadSession(): SavedSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedSession;
    if (data?.v !== 1 || !data.sim || !Array.isArray(data.lines) || !Array.isArray(data.history)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(session: SavedSession): void {
  try {
    const trimmed: SavedSession = {
      ...session,
      lines: session.lines.slice(-MAX_LINES),
      history: session.history.slice(-MAX_HISTORY),
      past: session.past?.slice(-30),
    };
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // সেভ না হলেও সমস্যা নেই
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // উপেক্ষা
  }
}
