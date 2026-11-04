import { describe, expect, it } from "vitest";
import { applyCommand, freshSession } from "../src/lib/session";

const stepAfter = (cmds: string[]) => cmds.reduce(applyCommand, freshSession()).step;

describe("starter steps", () => {
  it("advances through the five suggested commands", () => {
    const cmds = ["git init", "touch index.html", "git add index.html", 'git commit -m "first commit"', "git log"];
    const s = cmds.reduce(applyCommand, freshSession());
    expect(s.step).toBe(5);
    expect(s.lines.some((l) => l.text.includes("দারুণ!"))).toBe(true);
  });

  it("accepts equivalent commands, not just the exact text", () => {
    expect(stepAfter(["git init", "touch about.html"])).toBe(2);
    expect(stepAfter(["git init", 'edit a.txt "hi"', "git add ."])).toBe(3);
    expect(stepAfter(["git init", "touch a", "git add .", 'git commit -m "x"', "git log --oneline"])).toBe(5);
  });

  it("does not advance on failed commands or out of order", () => {
    expect(stepAfter(["git status"])).toBe(0);
    expect(stepAfter(["git init", "git log"])).toBe(1);
    expect(stepAfter(["git init", "git add nope"])).toBe(1);
  });

  it("counts files created before git init", () => {
    expect(stepAfter(["touch a", "git init"])).toBe(2);
  });
});
