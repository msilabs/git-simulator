import { describe, expect, it } from "vitest";
import { complete } from "../src/lib/git/complete";
import { EMPTY_STATE, state } from "./setup";
import { applyCommand, freshSession, showCompletions } from "../src/lib/session";

const REPO = state([
  "git init",
  'edit index.html "a"',
  'edit index.css "b"',
  'edit notes.txt "n"',
  "git add index.html index.css",
  'git commit -m "first"',
  "git branch feature",
  "git branch fix",
  'edit index.html "changed"',
  "touch new.js",
]);

describe("Tab completion", () => {
  it("completes a unique file name and adds a space", () => {
    const s = state(['edit index.html "x"', 'edit notes.txt "n"']);
    expect(complete(s, "edit ind")).toEqual({ text: "edit index.html ", candidates: ["index.html"] });
    expect(complete(s, "cat no")?.text).toBe("cat notes.txt ");
  });

  it("completes only the common part when several match", () => {
    const r = complete(REPO, "cat ind");
    expect(r).toEqual({ text: "cat index.", candidates: ["index.css", "index.html"] });
    expect(complete(REPO, "cat index.")?.text).toBe("cat index.");
  });

  it("completes command names and git subcommands", () => {
    expect(complete(EMPTY_STATE, "gi")?.text).toBe("git ");
    expect(complete(EMPTY_STATE, "e")?.candidates).toEqual(["echo", "edit"]);
    expect(complete(EMPTY_STATE, "ed")?.text).toBe("edit ");
    expect(complete(REPO, "git sw")?.text).toBe("git switch ");
    expect(complete(REPO, "git st")?.candidates).toEqual(["stash", "status"]);
    expect(complete(REPO, "git re")?.candidates).toEqual(["reset", "restore", "revert"]);
  });

  it("suggests the right kind of name for each command", () => {
    expect(complete(REPO, "git switch f")?.candidates).toEqual(["feature", "fix"]);
    expect(complete(REPO, "git merge ")?.candidates).toEqual(["feature", "fix"]);
    expect(complete(REPO, "git branch -d fe")?.text).toBe("git branch -d feature ");
    expect(complete(REPO, "git branch fe")).toBeNull(); // নতুন branch-এর নাম, সাজেস্ট নয়
    expect(complete(REPO, "git switch -c fe")).toBeNull();
    // add: শুধু বদলানো বা untracked ফাইল
    expect(complete(REPO, "git add ")?.candidates).toEqual(["index.html", "new.js", "notes.txt"]);
    expect(complete(REPO, "git restore ")?.candidates).toEqual(["index.html"]);
    expect(complete(REPO, "git rm ")?.candidates).toEqual(["index.css", "index.html"]);
    expect(complete(REPO, "git reset ")?.candidates).toEqual(["HEAD", "feature", "fix", "main"]);
  });

  it("suggests staged files after --staged", () => {
    const s = state(["git add index.html"], REPO);
    expect(complete(s, "git restore --staged ")?.candidates).toEqual(["index.html"]);
    expect(complete(s, "git diff --staged ")?.candidates).toEqual(["index.html"]);
  });

  it("completes options and stash entries", () => {
    expect(complete(REPO, "git reset --h")?.text).toBe("git reset --hard ");
    expect(complete(REPO, "git commit --a")?.candidates).toEqual(["--all", "--amend"]);
    const stashed = state(["git stash", 'edit index.css "c"', "git stash"], REPO);
    expect(complete(stashed, "git stash p")?.candidates).toEqual(["pop", "push"]);
    expect(complete(stashed, "git stash pop ")?.candidates).toEqual(["stash@{0}", "stash@{1}"]);
  });

  it("keeps text after the cursor out of it and gives up inside quotes or with no match", () => {
    expect(complete(REPO, 'git commit -m "ind')).toBeNull();
    expect(complete(REPO, "cat zzz")).toBeNull();
    expect(complete(REPO, "ls ")).toBeNull();
    expect(complete(EMPTY_STATE, "git add ")).toBeNull(); // git init-এর আগে
  });

  it("is safe with names that exist on every JavaScript object", () => {
    expect(complete(EMPTY_STATE, "constructor")).toBeNull();
    expect(complete(REPO, "git constructor ")).toBeNull();
    expect(complete(REPO, "git toString -")).toBeNull();
  });

  it("listing candidates adds the typed line and the list, without running anything", () => {
    const s = applyCommand(freshSession(), "git init");
    const listed = showCompletions(s, "cat ind", ["index.css", "index.html"]);
    expect(listed.lines.slice(-2).map((l) => [l.kind, l.text])).toEqual([
      ["input", "cat ind"],
      ["output", "index.css  index.html"],
    ]);
    expect(listed.sim).toBe(s.sim);
    expect(listed.history).toBe(s.history);
    expect(listed.log).toBe(s.log);
  });
});
