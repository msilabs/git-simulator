import { describe, expect, it } from "vitest";
import { exec, headId, repoOf, runCommand, state } from "./setup";

const BASE = ["git init", 'edit a "a"', 'edit b "b"', "git add .", 'git commit -m "first"', 'edit a "a2"', 'git commit -am "second"'];
const CONFLICTING = [...BASE, 'edit a "a3"', 'git commit -am "third"'];

const HINTS = (id: string, subject: string) =>
  [
    `error: could not revert ${id}... ${subject}`,
    "hint: After resolving the conflicts, mark them with",
    'hint: "git add/rm <pathspec>", then run',
    'hint: "git revert --continue".',
    'hint: You can instead skip this commit with "git revert --skip".',
    'hint: To abort and get back to the state before "git revert",',
    'hint: run "git revert --abort".',
  ].join("\n");

describe("git revert", () => {
  it("creates a new commit that undoes the given one", () => {
    const s = state(BASE);
    const second = headId(s);
    const r = runCommand(s, "git revert HEAD");
    expect(r.ok).toBe(true);
    const repo = repoOf(r.state);
    const c = repo.commits[headId(r.state)];
    expect(r.output).toBe(`[main ${c.id}] Revert "second"\n 1 file changed, 1 insertion(+), 1 deletion(-)`);
    expect(c.message).toBe(`Revert "second"\n\nThis reverts commit ${second}.`);
    expect(c.parents).toEqual([second]);
    expect(c.files).toEqual({ a: "a", b: "b" });
    expect(r.state.workdir).toEqual({ a: "a", b: "b" });
    expect(r.explanation).toContain("revert নিরাপদ");
  });

  it("merges line by line, keeping later changes to other lines", () => {
    const r = exec([
      "git init",
      'edit a "1\\n2\\n3\\n4\\n5"',
      "git add .",
      'git commit -m "one"',
      'edit a "1\\nTWO\\n3\\n4\\n5"',
      'git commit -am "two"',
      'edit a "1\\nTWO\\n3\\n4\\nFIVE"',
      'git commit -am "five"',
      "git revert HEAD~1",
    ]);
    expect(r.output).toMatch(/^Auto-merging a\n\[main [0-9a-f]{7}\] Revert "two"\n 1 file changed, 1 insertion\(\+\), 1 deletion\(-\)$/);
    expect(r.state.workdir.a).toBe("1\n2\n3\n4\nFIVE");
  });

  it("stops on a conflict with Git's messages and status, then --continue finishes it", () => {
    const s = state(CONFLICTING);
    const second = repoOf(s).commits[headId(s)].parents[0];
    const r = runCommand(s, "git revert HEAD~1");
    expect(r.ok).toBe(false);
    expect(r.output).toBe(`Auto-merging a\nCONFLICT (content): Merge conflict in a\n${HINTS(second, "second")}`);
    expect(r.state.workdir.a).toBe(`<<<<<<< HEAD\na3\n=======\na\n>>>>>>> parent of ${second} (second)`);
    expect(runCommand(r.state, "git status").output).toBe(
      [
        "On branch main",
        `You are currently reverting commit ${second}.`,
        '  (fix conflicts and run "git revert --continue")',
        '  (use "git revert --skip" to skip this patch)',
        '  (use "git revert --abort" to cancel the revert operation)',
        "",
        "Unmerged paths:",
        '  (use "git restore --staged <file>..." to unstage)',
        '  (use "git add <file>..." to mark resolution)',
        "\tboth modified:   a",
        "",
        'no changes added to commit (use "git add" and/or "git commit -a")',
      ].join("\n"),
    );
    expect(runCommand(r.state, "git merge --abort").output).toBe("fatal: There is no merge to abort (MERGE_HEAD missing).");
    expect(runCommand(r.state, "git switch main").output).toBe(
      'fatal: cannot switch branch while reverting\nConsider "git revert --quit" or "git worktree add".',
    );
    expect(runCommand(r.state, 'git commit -m "x"').output).toContain("U\ta");

    const done = exec(['edit a "fixed"', "git add a", "git revert --continue"], r.state);
    expect(done.ok).toBe(true);
    expect(done.output).toMatch(/^\[main [0-9a-f]{7}\] Revert "second"\n 1 file changed, 1 insertion\(\+\), 1 deletion\(-\)$/);
    const repo = repoOf(done.state);
    const c = repo.commits[headId(done.state)];
    expect(c.parents).toHaveLength(1);
    expect(c.message).toBe(`Revert "second"\n\nThis reverts commit ${second}.`);
    expect(repo.merge).toBeNull();
  });

  it("a plain git commit also finishes the revert", () => {
    const r = exec([...CONFLICTING, "git revert HEAD~1", 'edit a "fixed"', "git add a", "git commit"]);
    expect(r.ok).toBe(true);
    expect(repoOf(r.state).commits[headId(r.state)].message).toMatch(/^Revert "second"/);
  });

  it("--abort and --skip go back to before the revert", () => {
    const s = state([...CONFLICTING, "git revert HEAD~1"]);
    for (const cmd of ["git revert --abort", "git revert --skip"]) {
      const r = runCommand(s, cmd);
      expect(r.ok, cmd).toBe(true);
      expect(r.state.workdir, cmd).toEqual({ a: "a3", b: "b" });
      expect(repoOf(r.state).merge, cmd).toBeNull();
    }
    const none = runCommand(state(BASE), "git revert --continue");
    expect(none.output).toBe("error: no cherry-pick or revert in progress\nfatal: revert failed");
  });

  it("reverting the root commit can conflict on modify/delete", () => {
    const r = exec([...BASE, "git revert HEAD~1"]);
    const first = repoOf(r.state).commits[headId(r.state)].parents[0];
    expect(r.output.split("\n")[0]).toBe(
      "CONFLICT (modify/delete): a deleted in (empty tree) and modified in HEAD.  Version HEAD of a left in tree.",
    );
    expect(r.output).toContain(`error: could not revert ${first}... first`);
    expect(r.state.workdir).toEqual({ a: "a2" });
  });

  it("does nothing when the change is already undone", () => {
    const r = exec([...BASE, "git revert HEAD", "git revert HEAD~1"]);
    expect(r.ok).toBe(false);
    expect(r.output).toBe("On branch main\nnothing to commit, working tree clean");
  });

  it("refuses with staged changes or local changes in the touched files", () => {
    expect(exec([...BASE, 'edit b "q"', "git add b", "git revert HEAD"]).output).toBe(
      "error: your local changes would be overwritten by revert.\nhint: commit your changes or stash them to proceed.\nfatal: revert failed",
    );
    expect(exec([...BASE, 'edit a "q"', "git revert HEAD"]).output).toBe(
      "error: Your local changes to the following files would be overwritten by merge:\n\ta\nPlease commit your changes or stash them before you merge.\nAborting\nfatal: revert failed",
    );
    const other = exec([...BASE, 'edit b "q"', "git revert HEAD"]);
    expect(other.ok).toBe(true);
    expect(other.state.workdir.b).toBe("q");
  });

  it("refuses merge commits and unknown revisions", () => {
    const s = state([
      "git init",
      'edit a "a"',
      'edit b "b"',
      "git add .",
      'git commit -m "first"',
      "git switch -c f",
      'edit b "F"',
      'git commit -am "f"',
      "git switch main",
      'edit a "M"',
      'git commit -am "m"',
      "git merge f",
    ]);
    expect(runCommand(s, "git revert HEAD").output).toBe(
      `error: commit ${headId(s)} is a merge but no -m option was given.\nfatal: revert failed`,
    );
    expect(runCommand(s, "git revert nope").output).toBe("fatal: bad revision 'nope'");
    expect(runCommand(s, "git revert").ok).toBe(false);
  });
});
