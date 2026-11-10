/**
 * টার্মিনাল সেশনের যুক্তি (pure function, React ছাড়া): কমান্ড চালানো, undo, সেভ থেকে ফেরানো।
 *
 * সেভের কৌশল: Git মডেল pure আর deterministic, তাই পুরো state বারবার সেভ না করে রাখি
 * একটা ভিত্তি-state (`base`) আর তার পরে চালানো কমান্ডের তালিকা (`log`)। রিলোডে
 * কমান্ডগুলো আবার চালালে হুবহু একই state ফিরে আসে। তালিকা লম্বা হলে পুরোনো অংশ
 * ভিত্তিতে ঢুকিয়ে দিই (`compact`), তাই সেভের আকার সীমার মধ্যে থাকে।
 */
import { runCommand, EMPTY_STATE } from "./git/repo";
import { has } from "./git/own";
import { msg } from "./git/messages";
import type { SimState } from "./git/types";
import { nextStep, STARTER_STEPS } from "./steps";

export type LineKind = "input" | "output" | "error" | "explain" | "explain-error" | "welcome";

export interface TerminalLine {
  readonly id: number;
  readonly kind: LineKind;
  readonly text: string;
  /** শুধু "input" লাইনে: কমান্ড দেওয়ার সময়কার prompt */
  readonly prompt?: string;
}

/** undo-র জন্য: একটা কমান্ডের ঠিক আগের অবস্থা */
export interface PastEntry {
  readonly sim: SimState;
  readonly step: number;
  readonly command: string;
}

export interface Session {
  readonly sim: SimState;
  /** সেভের ভিত্তি; `log`-এর কমান্ডগুলো এর ওপর চালালে `sim` পাওয়া যায় */
  readonly base: SimState;
  /** state বদলেছে এমন কমান্ড, ক্রমানুসারে */
  readonly log: readonly string[];
  /** `log`-এর প্রতিটা কমান্ডের আগের অবস্থা (মেমোরিতে, একই অংশ ভাগ করে রাখে বলে হালকা) */
  readonly past: readonly PastEntry[];
  readonly lines: readonly TerminalLine[];
  readonly history: readonly string[];
  readonly step: number;
  readonly nextId: number;
}

/** তালিকা এর চেয়ে লম্বা হলে ছোট করা হয় */
export const MAX_LOG = 200;
/** ছোট করার পর এতগুলো কমান্ড (অর্থাৎ এত ধাপের undo) থেকে যায় */
export const KEEP_LOG = 100;
export const MAX_LINES = 400;
export const MAX_HISTORY = 100;

export function promptFor(sim: SimState): string {
  return `~/project${sim.repo ? ` (${sim.repo.head})` : ""} $`;
}

export function freshSession(welcome: string = msg.welcome): Session {
  return {
    sim: EMPTY_STATE,
    base: EMPTY_STATE,
    log: [],
    past: [],
    lines: [{ id: 1, kind: "welcome", text: welcome }],
    history: [],
    step: 0,
    nextId: 2,
  };
}

/** পুরোনো কমান্ডগুলো ভিত্তি-state-এ মিশিয়ে তালিকা ছোট করে। */
export function compact(s: Session): Session {
  if (s.log.length <= MAX_LOG) return s;
  const drop = s.log.length - KEEP_LOG;
  return { ...s, base: s.past[drop].sim, log: s.log.slice(drop), past: s.past.slice(drop) };
}

export function applyCommand(s: Session, command: string): Session {
  let nextId = s.nextId;
  const line = (kind: LineKind, text: string, prompt?: string): TerminalLine => ({ id: nextId++, kind, text, prompt });

  const input = line("input", command, promptFor(s.sim));
  if (!command.trim()) return { ...s, lines: [...s.lines, input], nextId };

  const result = runCommand(s.sim, command);
  const history = s.history[s.history.length - 1] === command ? s.history : [...s.history, command];
  if (result.clearScreen) return { ...s, lines: [], history: history.slice(-MAX_HISTORY), nextId };

  const lines = [...s.lines, input];
  if (result.output) lines.push(line(result.ok ? "output" : "error", result.output));
  if (result.explanation) lines.push(line(result.ok ? "explain" : "explain-error", result.explanation));

  const step = nextStep(s.step, result.state, command, result.ok);
  if (step === STARTER_STEPS.length && s.step < step) lines.push(line("welcome", msg.stepsDone));

  const changed = result.state !== s.sim;
  return compact({
    ...s,
    sim: result.state,
    log: changed ? [...s.log, command] : s.log,
    past: changed ? [...s.past, { sim: s.sim, step: s.step, command }] : s.past,
    lines: lines.slice(-MAX_LINES),
    history: history.slice(-MAX_HISTORY),
    step,
    nextId,
  });
}

export function undo(s: Session): Session {
  const last = s.past[s.past.length - 1];
  if (!last) return s;
  return {
    ...s,
    sim: last.sim,
    step: last.step,
    log: s.log.slice(0, -1),
    past: s.past.slice(0, -1),
    lines: [...s.lines, { id: s.nextId, kind: "welcome" as const, text: msg.undoDone(last.command) }].slice(-MAX_LINES),
    nextId: s.nextId + 1,
  };
}

/**
 * ভিত্তি থেকে কমান্ডগুলো আবার চালিয়ে state আর undo-র ইতিহাস বানায়।
 * কোনো কমান্ড state না বদলালে (যেমন মডেলের নিয়ম বদলেছে) সেটা বাদ যায়।
 */
export function replay(base: SimState, log: readonly string[]): Pick<Session, "sim" | "log" | "past"> {
  let sim = base;
  let step = 0;
  const kept: string[] = [];
  const past: PastEntry[] = [];
  for (const command of log) {
    const result = runCommand(sim, command);
    if (result.state === sim) continue;
    past.push({ sim, step, command });
    step = nextStep(step, result.state, command, result.ok);
    const next = result.state;
    kept.push(command);
    sim = next;
  }
  return { sim, log: kept, past };
}

/* ---------- সেভ করা state যাচাই ---------- */

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isFileMap = (x: unknown) => isObject(x) && Object.values(x).every((v) => typeof v === "string");
const isStringArray = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === "string");

/**
 * localStorage থেকে আসা ডেটা সত্যিই একটা ঠিকঠাক SimState কি না, ভেতর পর্যন্ত যাচাই করে।
 * নষ্ট বা পুরোনো আকারের ডেটা রেন্ডারে গিয়ে পুরো পেজ ভেঙে না দেয়, সেজন্য।
 */
export function isValidSimState(x: unknown): x is SimState {
  if (!isObject(x) || !isFileMap(x.workdir) || typeof x.clock !== "number") return false;
  if (x.repo === null) return true;
  const repo = x.repo;
  if (!isObject(repo) || !isObject(repo.commits) || !isObject(repo.branches) || !isFileMap(repo.index)) return false;
  if (typeof repo.head !== "string") return false;
  const commits = repo.commits;
  for (const [id, c] of Object.entries(commits)) {
    if (!isObject(c) || c.id !== id || typeof c.message !== "string" || typeof c.time !== "number") return false;
    if (typeof c.branch !== "string" || !isFileMap(c.files) || !isStringArray(c.parents)) return false;
    if (c.parents.length > 2 || !c.parents.every((p) => has(commits, p))) return false;
  }
  if (!Object.values(repo.branches).every((id) => typeof id === "string" && has(commits, id))) return false;
  const merge = repo.merge;
  if (merge !== undefined && merge !== null) {
    if (!isObject(merge) || typeof merge.theirs !== "string" || !has(commits, merge.theirs)) return false;
    if (typeof merge.branch !== "string" || typeof merge.message !== "string") return false;
    if (!isFileMap(merge.unmerged) || !isStringArray(merge.touched)) return false;
  }
  return true;
}

/** পুরোনো সেভে `merge` না থাকলে null বসায় (v2.0-এর আগে ঐচ্ছিক ছিল)। */
export function normalizeSimState(s: SimState): SimState {
  if (!s.repo || s.repo.merge !== undefined) return s;
  return { ...s, repo: { ...s.repo, merge: null } };
}

export function isValidLines(x: unknown): x is TerminalLine[] {
  return (
    Array.isArray(x) &&
    x.every((l) => isObject(l) && typeof l.id === "number" && typeof l.kind === "string" && typeof l.text === "string")
  );
}

export { isStringArray };
