import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand, freshSession, MAX_LOG } from "../src/lib/session";
import { loadSession, parseSaved, saveSession, serializeSession } from "../src/lib/storage";
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

  it("returns false when saving fails and true otherwise", () => {
    const store: Record<string, string> = {};
    fakeWindow(store);
    expect(saveSession(sample())).toBe(true);
    expect(loadSession().status).toBe("ok");
    fakeWindow(store, { throwOnSet: true });
    expect(saveSession(sample())).toBe(false);
  });
});
