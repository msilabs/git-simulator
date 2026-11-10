import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand, freshSession, MAX_LOG, undo } from "../src/lib/session";
import { loadSession, parseSaved, saveSession, serializeSession, watchSession, type LoadResult } from "../src/lib/storage";
import { runAll } from "../src/lib/git/repo";

const sample = () =>
  ["git init", "touch a", "git add .", 'git commit -m "a"', "git switch -c f", 'edit a "x"'].reduce(applyCommand, freshSession());

function fakeWindow(store: Record<string, string>, opts: { throwOnSet?: boolean } = {}) {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        if (opts.throwOnSet) throw new Error("QuotaExceededError");
        store[k] = v;
      },
      removeItem: (k: string) => delete store[k],
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("storage", () => {
  it("round-trips a session through save and load", () => {
    const s = sample();
    const r = parseSaved(serializeSession(s));
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.session.sim).toEqual(s.sim);
    expect(r.session.log).toEqual(s.log);
    expect(r.session.past).toHaveLength(s.past.length); // রিলোডের পরও undo চলে
    expect(r.session.lines).toEqual(s.lines);
    expect(r.session.nextId).toBeGreaterThan(Math.max(...s.lines.map((l) => l.id)));
  });

  it("undo after a reload restores the starter step that was saved", () => {
    const steps = ["git init", "touch index.html", "git add index.html", 'git commit -m "first"', "git log", "touch b"];
    const s = steps.reduce(applyCommand, freshSession());
    expect(s.step).toBe(5);
    const r = parseSaved(serializeSession(s));
    if (r.status !== "ok") throw new Error("not ok");
    // `git log` state বদলায় না বলে replay একা বুঝতে পারে না যে ধাপ ৫ আগেই শেষ হয়েছিল
    expect(undo(r.session).step).toBe(5);
    expect(undo(undo(r.session)).step).toBe(3);
  });

  it("falls back to replayed steps for saves without them", () => {
    const s = ["git init", "touch a"].reduce(applyCommand, freshSession());
    const saved = JSON.parse(serializeSession(s));
    delete saved.steps;
    const r = parseSaved(JSON.stringify(saved));
    if (r.status !== "ok") throw new Error("not ok");
    expect(r.session.past.map((p) => p.step)).toEqual([0, 1]);
  });

  it("reports empty storage and corrupt data instead of crashing", () => {
    expect(parseSaved(null).status).toBe("empty");
    for (const raw of [
      "not json",
      "42",
      JSON.stringify({ v: 1, sim: { repo: null }, lines: [], history: [], step: 0 }),
      JSON.stringify({ v: 2, base: { workdir: {}, repo: null, clock: 0 }, log: [1], lines: [], history: [] }),
      JSON.stringify({ v: 2, base: { workdir: { a: 5 }, repo: null, clock: 0 }, log: [], lines: [], history: [] }),
      JSON.stringify({
        v: 2,
        base: {
          workdir: {},
          clock: 1,
          repo: { commits: {}, branches: { main: "abc1234" }, head: "main", index: {} },
        },
        log: [],
        lines: [],
        history: [],
      }),
      JSON.stringify({ v: 3, lines: [], history: [] }),
    ]) {
      expect(parseSaved(raw).status, raw).toBe("corrupt");
    }
  });

  it("still reads saves from version 1 (full state)", () => {
    const sim = runAll(["git init", "touch a"]);
    const r = parseSaved(JSON.stringify({ v: 1, sim, lines: [{ id: 3, kind: "input", text: "ls" }], history: ["ls"], step: 2 }));
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.session.sim).toEqual(sim);
      expect(r.session.step).toBe(2);
      expect(r.session.past).toEqual([]);
    }
  });

  it("fills in stash and merge kind for saves made before they existed", () => {
    const sim = runAll(["git init", 'edit a "a"', "git add .", 'git commit -m "a"']);
    const { stash: _stash, ...oldRepo } = sim.repo!;
    void _stash;
    const raw = JSON.stringify({ v: 2, base: { ...sim, repo: oldRepo }, log: ["git stash list"], lines: [], history: [], step: 0 });
    const r = parseSaved(raw);
    if (r.status !== "ok") throw new Error("not ok");
    expect(r.session.sim.repo!.stash).toEqual([]);

    const conflicted = runAll(
      ["git switch -c f", 'edit a "F"', 'git commit -am "f"', "git switch main", 'edit a "M"', 'git commit -am "m"', "git merge f"],
      sim,
    );
    const { kind: _kind, ...oldMerge } = conflicted.repo!.merge!;
    void _kind;
    const raw2 = JSON.stringify({ v: 2, base: { ...conflicted, repo: { ...conflicted.repo, merge: oldMerge } }, log: [], lines: [], history: [], step: 0 });
    const r2 = parseSaved(raw2);
    if (r2.status !== "ok") throw new Error("not ok");
    expect(r2.session.sim.repo!.merge!.kind).toBe("merge");
  });

  it("treats a stash pointing at a missing commit as corrupt", () => {
    const sim = runAll(["git init", 'edit a "a"', "git add .", 'git commit -m "a"', 'edit a "b"', "git stash"]);
    const repo = sim.repo!;
    const bad = { ...sim, repo: { ...repo, stash: [{ ...repo.stash[0], base: "fffffff" }] } };
    expect(parseSaved(JSON.stringify({ v: 2, base: bad, log: [], lines: [], history: [], step: 0 })).status).toBe("corrupt");
  });

  it("fills in merge: null for saves made before it was required", () => {
    const sim = runAll(["git init", "touch a"]);
    const old = { ...sim, repo: { ...sim.repo!, merge: undefined } };
    const r = parseSaved(JSON.stringify({ v: 1, sim: old, lines: [], history: [], step: 0 }));
    expect(r.status === "ok" && r.session.sim.repo?.merge).toBeNull();
  });

  it("keeps the save small even after many commands", () => {
    let s = applyCommand(freshSession(), "git init");
    const big = "<p>content </p>".repeat(40);
    for (let i = 0; i < 400; i++) {
      s = applyCommand(s, `edit f${i % 5}.html "${big}${i}"`);
      s = applyCommand(s, "git add .");
      s = applyCommand(s, `git commit -m "c${i}"`);
    }
    expect(s.log.length).toBeLessThanOrEqual(MAX_LOG);
    const kb = serializeSession(s).length / 1024;
    // পুরোনো পদ্ধতিতে ১৮০ কমান্ডেই ~৫MB হতো
    expect(kb).toBeLessThan(1500);
  });

  it("reports saves and resets from other tabs, and ignores other keys", () => {
    let listener: ((e: { key: string | null; newValue: string | null }) => void) | null = null;
    vi.stubGlobal("window", {
      addEventListener: (_: string, fn: typeof listener) => (listener = fn),
      removeEventListener: () => (listener = null),
    });
    const seen: LoadResult["status"][] = [];
    const stop = watchSession((r) => seen.push(r.status));
    const fire = (key: string | null, newValue: string | null) => listener?.({ key, newValue });

    fire("msilabs-git-simulator:v1", serializeSession(sample()));
    fire("msilabs-git-simulator:v1", null); // অন্য tab-এ "নতুন করে শুরু"
    fire(null, null); // পুরো localStorage মোছা
    fire("another-app", "x");
    expect(seen).toEqual(["ok", "empty", "empty"]);
    stop();
    expect(listener).toBeNull();
  });

  it("returns false when saving fails and true otherwise", () => {
    const store: Record<string, string> = {};
    fakeWindow(store);
    expect(saveSession(sample())).toBe(true);
    expect(loadSession().status).toBe("ok");
    fakeWindow(store, { throwOnSet: true });
    expect(saveSession(sample())).toBe(false);
  });
});
