import { describe, expect, it } from "vitest";
import { EMPTY_STATE, exec, repoOf, runCommand, state } from "./setup";
import { parseSaved } from "../src/lib/storage";

// JavaScript-এর প্রতিটা object-এ উত্তরাধিকারসূত্রে থাকা নাম। ব্যবহারকারী এগুলো লিখলে
// কমান্ড, branch বা ফাইল হিসেবে ভুল করে ধরা পড়লে সিমুলেটর ভেঙে যেত।
const NAMES = ["constructor", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf"];

const ONE = ["git init", 'edit a.txt "a"', "git add .", 'git commit -m "first"'];

describe("names that exist on Object.prototype", () => {
  it.each(NAMES)("'%s' is an unknown shell command and git subcommand", (name) => {
    const shell = runCommand(EMPTY_STATE, name);
    expect(shell.ok).toBe(false);
    expect(shell.output).toBe(`${name}: command not found`);
    expect(shell.state).toBe(EMPTY_STATE);

    const git = runCommand(state(ONE), `git ${name}`);
    expect(git.ok).toBe(false);
    expect(git.output).toBe(`git: '${name}' is not supported in this simulator yet.`);
  });

  it.each(NAMES)("'%s' is not a branch until it is created", (name) => {
    const s = state(ONE);
    expect(runCommand(s, `git switch ${name}`).output).toBe(`fatal: invalid reference: ${name}`);
    expect(runCommand(s, `git merge ${name}`).output).toBe(`merge: ${name} - not something we can merge`);
    expect(runCommand(s, `git branch -d ${name}`).output).toBe(`error: branch '${name}' not found`);
    expect(runCommand(s, `git branch -m ${name} x`).ok).toBe(false);
    expect(runCommand(s, `git diff ${name}`).ok).toBe(false);
  });

  it.each(NAMES)("'%s' is not a file until it is created", (name) => {
    const s = state(ONE);
    expect(runCommand(s, `cat ${name}`).output).toBe(`cat: ${name}: No such file or directory`);
    expect(runCommand(s, `rm ${name}`).ok).toBe(false);
    expect(runCommand(s, `git add ${name}`).output).toBe(`fatal: pathspec '${name}' did not match any files`);
    expect(runCommand(s, `git restore ${name}`).ok).toBe(false);
    expect(runCommand(s, `git checkout ${name}`).ok).toBe(false);
  });

  it.each(NAMES)("works as a normal branch name: '%s'", (name) => {
    const s = state([...ONE, `git switch -c ${name}`, 'edit a.txt "b"', "git add .", 'git commit -m "b"', "git switch main"]);
    expect(Object.keys(repoOf(s).branches).sort()).toEqual([name, "main"].sort());
    const merged = runCommand(s, `git merge ${name}`);
    expect(merged.ok).toBe(true);
    expect(merged.output).toContain("Fast-forward");
    expect(runCommand(merged.state, `git branch -d ${name}`).ok).toBe(true);
  });

  it.each(NAMES)("works as a normal file name: '%s'", (name) => {
    const s = state(["git init", `touch ${name}`, `git add ${name}`, 'git commit -m "first"']);
    expect(runCommand(s, "git status").output).toContain("nothing to commit, working tree clean");
    const edited = state([`edit ${name} "x"`], s);
    expect(runCommand(edited, "git status").output).toContain(`modified:   ${name}`);
    expect(runCommand(edited, `cat ${name}`).output).toBe("x");
    expect(runCommand(edited, `git diff ${name}`).output).toContain(`+x`);
  });

  it("a file with such a name merges and conflicts like any other", () => {
    const r = exec([
      "git init",
      'edit constructor "base"',
      "git add .",
      'git commit -m "base"',
      "git switch -c feature",
      'edit constructor "theirs"',
      "git add .",
      'git commit -m "theirs"',
      "git switch main",
      'edit constructor "ours"',
      "git add .",
      'git commit -m "ours"',
      "git merge feature",
    ]);
    expect(r.output).toContain("CONFLICT (content): Merge conflict in constructor");
    expect(Object.keys(repoOf(r.state).merge!.unmerged)).toEqual(["constructor"]);
  });

  it("__proto__ is refused as a file or branch name", () => {
    expect(runCommand(EMPTY_STATE, "touch __proto__").ok).toBe(false);
    expect(runCommand(EMPTY_STATE, 'edit __proto__ "x"').ok).toBe(false);
    const s = state(ONE);
    expect(runCommand(s, "git branch __proto__").ok).toBe(false);
    expect(runCommand(s, "git switch -c __proto__").ok).toBe(false);
    expect(runCommand(s, "git branch -m __proto__").ok).toBe(false);
  });

  it("saved data pointing at an inherited name is treated as corrupt", () => {
    const sim = state(ONE);
    const repo = repoOf(sim);
    const bad = { ...sim, repo: { ...repo, branches: { ...repo.branches, x: "constructor" } } };
    const raw = JSON.stringify({ v: 2, base: bad, log: [], lines: [], history: [], step: 0 });
    expect(parseSaved(raw).status).toBe("corrupt");
  });
});
