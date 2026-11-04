import { describe, expect, it } from "vitest";
import { applyCommand, freshSession, KEEP_LOG, MAX_LOG, replay, undo, type Session } from "../src/lib/session";
import { runAll } from "../src/lib/git/repo";

const runMany = (cmds: readonly string[], s: Session = freshSession()) => cmds.reduce(applyCommand, s);

describe("session", () => {
  it("records only state-changing commands in the log", () => {
    const s = runMany(["git init", "git status", "touch a", "ls", "git add a", "nope"]);
    expect(s.log).toEqual(["git init", "touch a", "git add a"]);
    expect(s.past).toHaveLength(3);
    expect(s.history).toHaveLength(6);
  });

  it("gives every line a unique, increasing id without side effects", () => {
    const s = runMany(["git init", "touch a", "git status"]);
    const ids = s.lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
    // একই ইনপুটে একই ফল (pure)
    expect(runMany(["git init", "touch a", "git status"])).toEqual(s);
  });

  it("undo goes back one state-changing command and restores the step", () => {
    const s = runMany(["git init", "touch index.html", "git add index.html"]);
    expect(s.step).toBe(3);
    const u = undo(s);
    expect(u.sim).toBe(s.past[2].sim);
    expect(u.log).toEqual(["git init", "touch index.html"]);
    expect(u.step).toBe(2);
    expect(u.lines[u.lines.length - 1].text).toContain("git add index.html");
    expect(undo(freshSession())).toEqual(freshSession());
  });

  it("clear empties the screen but keeps the state", () => {
    const s = runMany(["git init", "touch a", "clear"]);
    expect(s.lines).toEqual([]);
    expect(Object.keys(s.sim.workdir)).toEqual(["a"]);
  });

  it("compacts long logs into the base so saves stay small", () => {
    let s = runMany(["git init"]);
    for (let i = 0; i < MAX_LOG + 5; i++) s = applyCommand(s, `edit f.txt "${i}"`);
    expect(s.log.length).toBeLessThanOrEqual(MAX_LOG);
    expect(s.log.length).toBeGreaterThanOrEqual(KEEP_LOG);
    expect(s.past).toHaveLength(s.log.length);
    // ভিত্তি থেকে আবার চালালে হুবহু একই state
    expect(runAll(s.log, s.base)).toEqual(s.sim);
  });

  it("replay rebuilds the same state and undo history", () => {
    const s = runMany(["git init", "touch a", "git add .", 'git commit -m "a"', "git switch -c f"]);
    const r = replay(s.base, s.log);
    expect(r.sim).toEqual(s.sim);
    expect(r.log).toEqual(s.log);
    expect(r.past.map((p) => p.step)).toEqual(s.past.map((p) => p.step));
  });

  it("replay skips commands that no longer change anything", () => {
    const r = replay(runAll(["git init"]), ["touch a", "git status", "touch a"]);
    expect(r.log).toEqual(["touch a"]);
  });
});
