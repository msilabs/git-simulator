import { describe, expect, it } from "vitest";
import { exec, headId, repoOf, runCommand, state } from "./setup";

const BASE = ["git init", 'edit a "a"', 'edit b "b"', "git add .", 'git commit -m "first"', 'edit a "a2"', 'git commit -am "second"'];
const DIRTY = [...BASE, 'edit a "x"', 'edit b "y"', "git add b", "touch new", "touch added", "git add added"];

describe("git stash", () => {
  it("saves tracked changes, cleans the folder and keeps untracked files", () => {
    const s = state(DIRTY);
    const r = runCommand(s, "git stash");
    expect(r.ok).toBe(true);
    expect(r.output).toBe(`Saved working directory and index state WIP on main: ${headId(s)} second`);
    expect(r.state.workdir).toEqual({ a: "a2", b: "b", new: "" });
    expect(repoOf(r.state).index).toEqual({ a: "a2", b: "b" });
    expect(repoOf(r.state).stash).toHaveLength(1);
    expect(runCommand(r.state, "git status").output).toBe(
      'On branch main\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n\tnew\n\nnothing added to commit but untracked files present (use "git add" to track)',
    );
  });

  it("says when there is nothing to save, and before the first commit", () => {
    const clean = state([...BASE, "touch untracked"]);
    const r = runCommand(clean, "git stash");
    expect(r.output).toBe("No local changes to save");
    expect(r.state).toBe(clean);
    expect(exec(["git init", "touch a", "git add a", "git stash"]).output).toBe("You do not have the initial commit yet");
  });

  it("pop brings changes back unstaged, except newly added files, and drops the entry", () => {
    const stashed = state([...DIRTY, "git stash"]);
    const id = repoOf(stashed).stash[0].id;
    const r = runCommand(stashed, "git stash pop");
    expect(r.ok).toBe(true);
    expect(r.output).toBe(
      [
        "On branch main",
        "Changes to be committed:",
        '  (use "git restore --staged <file>..." to unstage)',
        "\tnew file:   added",
        "",
        "Changes not staged for commit:",
        '  (use "git add <file>..." to update what will be committed)',
        '  (use "git restore <file>..." to discard changes in working directory)',
        "\tmodified:   a",
        "\tmodified:   b",
        "",
        "Untracked files:",
        '  (use "git add <file>..." to include in what will be committed)',
        "\tnew",
        "",
        `Dropped refs/stash@{0} (${id})`,
      ].join("\n"),
    );
    expect(r.state.workdir).toEqual({ a: "x", b: "y", new: "", added: "" });
    expect(repoOf(r.state).index).toEqual({ a: "a2", b: "b", added: "" });
    expect(repoOf(r.state).stash).toEqual([]);
  });

  it("apply keeps the entry; list, -m messages and drop work like Git", () => {
    const s = state([...BASE, 'edit a "x"', "git stash", 'edit a "z"', 'git stash -m "my msg"']);
    expect(runCommand(s, "git stash list").output).toBe(
      `stash@{0}: On main: my msg\nstash@{1}: WIP on main: ${headId(s)} second`,
    );
    const applied = runCommand(s, "git stash apply");
    expect(applied.state.workdir.a).toBe("z");
    expect(repoOf(applied.state).stash).toHaveLength(2);
    const older = runCommand(s, "git stash apply stash@{1}");
    expect(older.state.workdir.a).toBe("x");
    const dropped = runCommand(s, "git stash drop");
    expect(dropped.output).toBe(`Dropped refs/stash@{0} (${repoOf(s).stash[0].id})`);
    expect(repoOf(dropped.state).stash.map((e) => e.message)).toEqual([`WIP on main: ${headId(s)} second`]);
    expect(runCommand(s, "git stash drop stash@{5}").output).toBe("fatal: log for 'stash' only has 2 entries");
    expect(repoOf(runCommand(s, "git stash clear").state).stash).toEqual([]);
  });

  it("pop refuses to overwrite local changes and keeps the entry", () => {
    const s = state([...BASE, 'edit a "x"', "git stash", 'edit a "local"']);
    const r = runCommand(s, "git stash pop");
    expect(r.ok).toBe(false);
    expect(r.output.startsWith("error: Your local changes to the following files would be overwritten by merge:\n\ta\n")).toBe(true);
    expect(r.output.endsWith("The stash entry is kept in case you need it again.")).toBe(true);
    expect(r.state).toBe(s);
  });

  it("applies on top of new commits when the changes do not overlap", () => {
    const r = exec([...BASE, 'edit b "B"', "git stash", 'edit a "a3"', 'git commit -am "third"', "git stash pop"]);
    expect(r.ok).toBe(true);
    expect(r.state.workdir).toEqual({ a: "a3", b: "B" });
  });

  it("stops without changing anything when the stash would conflict (simplification)", () => {
    const s = state([...BASE, 'edit a "X"', "git stash", 'edit a "Y"', 'git commit -am "y"']);
    const r = runCommand(s, "git stash pop");
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
    expect(r.explanation).toContain("stash মুছে যায়নি");
  });

  it("handles an empty list and bad references", () => {
    const s = state(BASE);
    expect(runCommand(s, "git stash list").output).toBe("");
    expect(runCommand(s, "git stash pop").output).toBe("No stash entries found.");
    expect(runCommand(s, "git stash drop").output).toBe("No stash entries found.");
    expect(runCommand(s, "git stash drop stash@{5}").output).toBe("error: stash@{5} is not a valid reference");
    expect(runCommand(s, "git stash show").ok).toBe(false);
  });

  it("refuses during an unresolved conflict", () => {
    const r = exec([
      "git init",
      'edit a "a"',
      "git add .",
      'git commit -m "base"',
      "git switch -c f",
      'edit a "F"',
      'git commit -am "f"',
      "git switch main",
      'edit a "M"',
      'git commit -am "m"',
      "git merge f",
      "git stash",
    ]);
    expect(r.output).toBe("error: could not write index\na: needs merge");
  });
});
