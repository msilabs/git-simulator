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

describe("missions", () => {
  // শিক্ষার্থী যেভাবে করবে, সেভাবে সব মিশন শেষ করা
  const WALKTHROUGH: readonly (readonly string[])[] = [
    ["git init", "touch index.html", "git add index.html", 'git commit -m "first commit"', "git log"],
    ['edit index.html "<h1>Hello</h1>"', "git diff", "git add .", 'git commit -m "hello"'],
    ["git switch -c feature", 'edit about.html "about"', "git add .", 'git commit -m "about"', "git switch main"],
    ["git merge feature", "git log --oneline --graph --all"],
    [
      "git switch -c clash",
      'edit index.html "<h1>Hi</h1>"',
      'git commit -am "hi"',
      "git switch main",
      'edit index.html "<h1>Hey</h1>"',
      'git commit -am "hey"',
      "git merge clash",
      'edit index.html "<h1>Hi and hey</h1>"',
      "git add index.html",
      "git commit",
    ],
    ['edit index.html "oops"', "git add index.html", "git restore --staged index.html", "git restore index.html"],
    ['edit typo.txt "tpyo"', "git add .", 'git commit -m "typo"', "git revert HEAD", "git reset --hard HEAD~1"],
    ['edit index.html "wip"', "git stash", "git stash list", "git stash pop", "git restore index.html"],
    ["git remote add origin https://github.com/you/project.git", "git push -u origin main"],
    ['teammate notes.txt "hello"', "git fetch", "git status", "git pull"],
    ['edit me.txt "mine"', "git add .", 'git commit -m "mine"', 'teammate other.txt "theirs"', "git push", "git config pull.rebase false", "git pull", "git push"],
  ];

  it("can be completed one after another with ordinary commands", async () => {
    const { MISSIONS, TOTAL_STAGES, missionAt } = await import("../src/lib/missions");
    expect(WALKTHROUGH).toHaveLength(MISSIONS.length);
    let s = freshSession();
    WALKTHROUGH.forEach((cmds, i) => {
      s = cmds.reduce(applyCommand, s);
      expect(missionAt(s.step).index, `after mission ${i + 1}: ${MISSIONS[i].title}`).toBe(i + 1);
    });
    expect(s.step).toBe(TOTAL_STAGES);
    expect(s.lines.some((l) => l.text.startsWith("অভিনন্দন! সব মিশন শেষ।"))).toBe(true);
    expect(s.lines.filter((l) => l.text.startsWith("দারুণ! মিশন শেষ")).length).toBe(MISSIONS.length - 1);
  });

  it("does not jump ahead: a rejected push or a plain status is not enough", () => {
    const start = WALKTHROUGH.slice(0, 2).flat().reduce(applyCommand, freshSession());
    const afterTwo = start.step;
    expect(["git status", "git log"].reduce(applyCommand, start).step).toBe(afterTwo);
    // মিশন ৩-এর প্রথম ধাপ: branch বদল; শুধু branch বানালে হয় না
    expect(["git branch feature"].reduce(applyCommand, start).step).toBe(afterTwo);
    expect(["git switch -c feature"].reduce(applyCommand, start).step).toBe(afterTwo + 1);
  });

  it("undo goes back to the previous stage, and reloading keeps progress", async () => {
    const { parseSaved, serializeSession } = await import("../src/lib/storage");
    const s = WALKTHROUGH.slice(0, 3).flat().reduce(applyCommand, freshSession());
    const loaded = parseSaved(serializeSession(s));
    if (loaded.status !== "ok") throw new Error("not ok");
    expect(loaded.session.step).toBe(s.step);
    const { undo } = await import("../src/lib/session");
    expect(undo(loaded.session).step).toBe(s.step - 1); // শেষ ধাপ ছিল "git switch main"
  });

  it("missionAt maps overall progress to a mission and its stages", async () => {
    const { missionAt, MISSIONS, TOTAL_STAGES } = await import("../src/lib/missions");
    expect(missionAt(0)).toEqual({ index: 0, done: 0 });
    expect(missionAt(5)).toEqual({ index: 1, done: 0 });
    expect(missionAt(6)).toEqual({ index: 1, done: 1 });
    expect(missionAt(TOTAL_STAGES)).toEqual({ index: MISSIONS.length, done: 0 });
  });
});
