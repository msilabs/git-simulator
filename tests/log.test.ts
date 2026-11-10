import { describe, expect, it } from "vitest";
import { exec, repoOf, state, ONE_COMMIT } from "./setup";

const threeCommits = [
  ...ONE_COMMIT,
  'edit index.html "2"',
  "git add .",
  'git commit -m "second"',
  'edit index.html "3"',
  "git add .",
  'git commit -m "third"',
];

describe("git log", () => {
  it("fails when there are no commits yet", () => {
    const r = exec(["git init", "git log"]);
    expect(r.ok).toBe(false);
    expect(r.output).toBe("fatal: your current branch 'main' does not have any commits yet");
  });

  it("lists commits newest first with --oneline", () => {
    const s = state(threeCommits);
    const r = exec(["git log --oneline"], s);
    const lines = r.output.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^[0-9a-f]{7} \(HEAD -> main\) third$/);
    expect(lines[1]).toMatch(/^[0-9a-f]{7} second$/);
    expect(lines[2]).toMatch(/^[0-9a-f]{7} first commit$/);
  });

  it("shows the full format", () => {
    const r = exec([...ONE_COMMIT, "git log"]);
    const id = repoOf(r.state).branches.main;
    expect(r.output).toBe(`commit ${id} (HEAD -> main)\nAuthor: Learner <learner@example.com>\n\n    first commit`);
  });

  it("only shows commits reachable from the current branch", () => {
    const r = exec([
      ...ONE_COMMIT,
      "git switch -c feature",
      'edit f.txt "f"',
      "git add .",
      'git commit -m "feature work"',
      "git switch main",
      "git log --oneline",
    ]);
    expect(r.output).not.toContain("feature work");
    expect(r.output).toMatch(/\(HEAD -> main\) first commit$/);
  });

  it("decorates other branches pointing at the same commit", () => {
    const r = exec([...ONE_COMMIT, "git branch feature", "git log --oneline"]);
    expect(r.output).toMatch(/\(HEAD -> main, feature\) first commit/);
  });

  it("includes both sides of a merge, newest first, with a Merge line", () => {
    const r = exec([
      ...ONE_COMMIT,
      "git switch -c feature",
      'edit f.txt "f"',
      "git add .",
      'git commit -m "feature work"',
      "git switch main",
      'edit m.txt "m"',
      "git add .",
      'git commit -m "main work"',
      "git merge feature",
      "git log --oneline",
    ]);
    const subjects = r.output.split("\n").map((l) => l.replace(/^[0-9a-f]{7} (\([^)]*\) )?/, ""));
    expect(subjects).toEqual(["Merge branch 'feature'", "main work", "feature work", "first commit"]);
    const full = exec(["git log"], r.state).output;
    expect(full).toMatch(/^commit [0-9a-f]{7} \(HEAD -> main\)\nMerge: [0-9a-f]{7} [0-9a-f]{7}\n/);
  });

  it("rejects unsupported options", () => {
    expect(exec([...ONE_COMMIT, "git log --graph"]).ok).toBe(false);
  });
});

describe("git log --graph, --all, -n and git show", () => {
  const MERGED = [
    "git init",
    'edit a "1"',
    "git add .",
    'git commit -m "base"',
    "git switch -c f",
    'edit b "1"',
    "git add .",
    'git commit -m "f1"',
    'edit b "2"',
    'git commit -am "f2"',
    "git switch main",
    'edit a "2"',
    'git commit -am "m1"',
    "git merge f",
  ];
  const strip = (out: string) => out.replace(/[0-9a-f]{7}/g, "ID").replace(/ \([^)]*\)/g, "");

  it("draws the graph like real Git (output checked against git 2.56)", () => {
    expect(strip(exec([...MERGED, "git log --oneline --graph"]).output)).toBe(
      ["*   ID Merge branch 'f'", "|\\", "| * ID f2", "| * ID f1", "* | ID m1", "|/", "* ID base"].join("\n"),
    );
  });

  it("draws a second merge into an existing column and a collapse that starts on the commit line", () => {
    const two = exec([...MERGED, "git switch f", 'edit b "3"', 'git commit -am "f3"', "git switch main", "git merge f", "git log --oneline --graph"]);
    expect(strip(two.output)).toBe(
      ["*   ID Merge branch 'f'", "|\\", "| * ID f3", "* | ID Merge branch 'f'", "|\\|", "| * ID f2", "| * ID f1", "* | ID m1", "|/", "* ID base"].join("\n"),
    );
    const three = exec([
      "git init",
      'edit a "1"',
      "git add .",
      'git commit -m "base"',
      "git switch -c x",
      'edit x "1"',
      "git add .",
      'git commit -m "x1"',
      "git switch main",
      "git switch -c y",
      'edit y "1"',
      "git add .",
      'git commit -m "y1"',
      "git switch main",
      'edit a "2"',
      'git commit -am "m1"',
      "git merge x",
      "git merge y",
      "git log --oneline --graph",
    ]);
    expect(strip(three.output)).toBe(
      ["*   ID Merge branch 'y'", "|\\", "| * ID y1", "* |   ID Merge branch 'x'", "|\\ \\", "| * | ID x1", "| |/", "* / ID m1", "|/", "* ID base"].join("\n"),
    );
  });

  it("--all shows every branch, and -n limits the count", () => {
    const s = state([
      "git init",
      'edit a "1"',
      "git add .",
      'git commit -m "base"',
      "git switch -c f",
      'edit b "1"',
      "git add .",
      'git commit -m "f1"',
      "git switch main",
      'edit a "2"',
      'git commit -am "m1"',
    ]);
    expect(strip(exec(["git log --oneline --graph --all"], s).output)).toBe(["* ID m1", "| * ID f1", "|/", "* ID base"].join("\n"));
    expect(strip(exec(["git log --oneline"], s).output)).toBe("ID m1\nID base");
    expect(exec(["git log --oneline --all"], s).output.split("\n")).toHaveLength(3);
    for (const cmd of ["git log --oneline -n 1", "git log --oneline -n1", "git log --oneline -1", "git log --oneline --max-count=1"]) {
      expect(strip(exec([cmd], s).output), cmd).toBe("ID m1");
    }
    expect(exec(["git log --graph"], s).ok).toBe(false);
    expect(exec(["git log -n"], s).ok).toBe(false);
  });

  it("git show prints the commit and its diff, or only the header for a merge", () => {
    const r = exec([...MERGED, "git show f"]);
    expect(strip(r.output)).toBe(
      [
        "commit ID",
        "Author: Learner <learner@example.com>",
        "",
        "    f2",
        "",
        "diff --git a/b b/b",
        "index ID..ID 100644",
        "--- a/b",
        "+++ b/b",
        "@@ -1 +1 @@",
        "-1",
        "+2",
      ].join("\n"),
    );
    const merge = exec([...MERGED, "git show"]);
    expect(strip(merge.output)).toBe("commit ID\nMerge: ID ID\nAuthor: Learner <learner@example.com>\n\n    Merge branch 'f'");
    expect(exec([...MERGED, "git show HEAD~2"]).output).toContain("new file mode 100644");
    expect(exec([...MERGED, "git show nope"]).ok).toBe(false);
    expect(exec(["git init", "git show"]).output).toBe("fatal: your current branch 'main' does not have any commits yet");
  });
});
