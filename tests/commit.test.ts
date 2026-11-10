import { describe, expect, it } from "vitest";
import { exec, headId, repoOf, state, ONE_COMMIT } from "./setup";

describe("git commit", () => {
  it("creates a root commit and moves the branch to it", () => {
    const r = exec(ONE_COMMIT);
    expect(r.ok).toBe(true);
    const repo = repoOf(r.state);
    const id = repo.branches.main;
    expect(id).toMatch(/^[0-9a-f]{7}$/);
    const c = repo.commits[id];
    expect(c.parents).toEqual([]);
    expect(c.message).toBe("first commit");
    expect(c.files).toEqual({ "index.html": "hello" });
    expect(r.output).toBe(
      `[main (root-commit) ${id}] first commit\n 1 file changed, 1 insertion(+)\n create mode 100644 index.html`,
    );
    expect(r.explanation).toContain(`নতুন commit ${id} তৈরি হলো। main এখন এটাকে দেখাচ্ছে।`);
  });

  it("reports 0 insertions for an empty file", () => {
    const r = exec(["git init", "touch index.html", "git add index.html", 'git commit -m "first commit"']);
    expect(r.output).toContain(" 1 file changed, 0 insertions(+), 0 deletions(-)");
  });

  it("links the second commit to the first as its parent", () => {
    const first = state(ONE_COMMIT);
    // সরলীকরণ: ফাইলের শেষে newline আছে কি না সিমুলেটর দেখে না, তাই "hello" লাইনটা অপরিবর্তিত ধরা হয়।
    const r = exec(['edit index.html "hello\\nworld"', "git add .", 'git commit -m "second"'], first);
    const repo = repoOf(r.state);
    const second = repo.commits[repo.branches.main];
    expect(second.parents).toEqual([headId(first)]);
    expect(second.time).toBeGreaterThan(repo.commits[headId(first)].time);
    expect(r.output).toBe(`[main ${second.id}] second\n 1 file changed, 1 insertion(+)`);
  });

  it("only moves the current branch", () => {
    const r = exec([...ONE_COMMIT, "git branch feature", 'edit index.html "x"', "git add .", 'git commit -m "on main"']);
    const repo = repoOf(r.state);
    expect(repo.branches.main).not.toBe(repo.branches.feature);
    expect(repo.commits[repo.branches.main].parents).toEqual([repo.branches.feature]);
  });

  it("commits only what is staged", () => {
    const r = exec(["git init", 'edit a.txt "1"', 'edit b.txt "2"', "git add a.txt", 'git commit -m "only a"']);
    const repo = repoOf(r.state);
    expect(repo.commits[repo.branches.main].files).toEqual({ "a.txt": "1" });
  });

  it("says nothing to commit when nothing is staged", () => {
    const fresh = exec(["git init", 'git commit -m "x"']);
    expect(fresh.ok).toBe(false);
    expect(fresh.output).toContain("nothing to commit");

    const clean = exec([...ONE_COMMIT, 'git commit -m "again"']);
    expect(clean.ok).toBe(false);
    expect(clean.output).toBe("On branch main\nnothing to commit, working tree clean");

    const unstaged = exec([...ONE_COMMIT, 'edit index.html "changed"', 'git commit -m "x"']);
    expect(unstaged.ok).toBe(false);
    expect(unstaged.output).toContain("no changes added to commit");
    expect(unstaged.explanation).toContain("git add");
  });

  it("asks for a message in Bengali when -m is missing", () => {
    const before = state(["git init", "touch a", "git add a"]);
    const r = exec(["git commit"], before);
    expect(r.ok).toBe(false);
    expect(r.explanation).toContain("মেসেজ দিতে হবে");
    expect(r.state).toBe(before);
  });

  it("rejects -m without a value and empty messages", () => {
    const base = ["git init", "touch a", "git add a"];
    expect(exec([...base, "git commit -m"]).output).toBe("error: switch `m' requires a value");
    expect(exec([...base, 'git commit -m ""']).output).toBe("Aborting commit due to empty commit message.");
  });

  it("joins several -m values into paragraphs", () => {
    const r = exec(["git init", "touch a", "git add a", 'git commit -m "title" -m "body"']);
    const repo = repoOf(r.state);
    expect(repo.commits[repo.branches.main].message).toBe("title\n\nbody");
  });

  it("-a stages modified and deleted tracked files, but not untracked ones", () => {
    const base = ["git init", 'edit a "a"', 'edit b "b"', "git add .", 'git commit -m "first"'];
    const r = exec([...base, 'edit a "changed"', "rm b", "touch new", 'git commit -a -m "second"']);
    expect(r.ok).toBe(true);
    const repo = repoOf(r.state);
    expect(repo.commits[repo.branches.main].files).toEqual({ a: "changed" });
    expect(repo.index).toEqual({ a: "changed" });
    expect(r.output).toContain(" 2 files changed, 1 insertion(+), 2 deletions(-)");
    expect(r.explanation).toContain("`-a` দিয়ে a, b-এর বদল নিজে থেকেই staged হলো");
    expect(r.explanation).toContain("নতুন untracked ফাইল (new)");
    expect(exec(["git status"], r.state).output).toContain("Untracked files:");
  });

  it("accepts -am, -am with the message attached, and --all", () => {
    const base = state(["git init", 'edit a "a"', "git add .", 'git commit -m "first"', 'edit a "b"']);
    for (const cmd of ['git commit -am "msg"', 'git commit -am"msg"', 'git commit --all -m "msg"', 'git commit -a --message "msg"']) {
      const r = exec([cmd], base);
      expect(r.ok, cmd).toBe(true);
      const repo = repoOf(r.state);
      expect(repo.commits[repo.branches.main].message, cmd).toBe("msg");
    }
    // -ma মানে মেসেজ "a", আসল Git-এর মতো
    const ma = exec(["git add .", "git commit -ma"], base);
    expect(repoOf(ma.state).commits[repoOf(ma.state).branches.main].message).toBe("a");
  });

  it("-a with nothing changed or without a message leaves the index alone", () => {
    const clean = state(["git init", 'edit a "a"', "git add .", 'git commit -m "first"']);
    expect(exec(['git commit -am "x"'], clean).output).toContain("nothing to commit, working tree clean");
    const dirty = state(['edit a "b"'], clean);
    const r = exec(["git commit -a"], dirty);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(dirty);
    expect(exec(["git commit -am"], dirty).output).toBe("error: switch `m' requires a value");
    expect(exec(['git commit -x -m "m"'], dirty).output).toBe("error: unsupported in simulator: -x");
  });

  it("-a stages conflicted files too and commits them, markers included, like real Git", () => {
    const r = exec([
      "git init",
      'edit f "base"',
      "git commit -am base",
    ]);
    expect(r.ok).toBe(false); // প্রথম commit-এর আগে f untracked, -a তাকে নেয় না
    const s = state([
      "git init",
      'edit f "base"',
      "git add .",
      'git commit -m "base"',
      "git switch -c feature",
      'edit f "theirs"',
      "git commit -am theirs",
      "git switch main",
      'edit f "ours"',
      "git commit -am ours",
      "git merge feature",
    ]);
    expect(exec(["git commit -m done"], s).output).toContain("error: Committing is not possible because you have unmerged files.");
    const careless = exec(["git commit -am done"], s);
    expect(careless.ok).toBe(true);
    const merged = repoOf(careless.state);
    expect(merged.merge).toBeNull();
    expect(merged.commits[merged.branches.main].files.f).toContain("<<<<<<< HEAD");
    expect(merged.commits[merged.branches.main].parents).toHaveLength(2);
    expect(careless.explanation).toContain("চিহ্নসহ commit করে ফেলল");
    const finished = exec(['edit f "fixed"', "git add f", 'edit f "fixed again"', "git commit -a"], s);
    expect(finished.ok).toBe(true);
    const repo = repoOf(finished.state);
    const head = repo.commits[repo.branches.main];
    expect(head.parents).toHaveLength(2);
    expect(head.files).toEqual({ f: "fixed again" });
  });

  it("--amend replaces the last commit, keeping its parent", () => {
    const base = state(["git init", 'edit a "a"', 'edit b "b"', "git add .", 'git commit -m "first"', 'edit a "a2"', 'git commit -am "second"']);
    const oldId = headId(base);
    const first = repoOf(base).commits[oldId].parents[0];
    const r = exec(['git commit --amend -m "second fixed"'], base);
    expect(r.ok).toBe(true);
    const repo = repoOf(r.state);
    const c = repo.commits[headId(r.state)];
    expect(c.id).not.toBe(oldId);
    expect(c.parents).toEqual([first]);
    expect(c.message).toBe("second fixed");
    expect(r.output).toBe(`[main ${c.id}] second fixed\n 1 file changed, 1 insertion(+), 1 deletion(-)`);
    expect(exec(["git log --oneline"], r.state).output).not.toContain(oldId);
    expect(r.explanation).toContain(`শেষ commit ${oldId}-এর জায়গায় নতুন commit ${c.id} বসল`);

    const withFile = exec(['edit c "c"', "git add c", "git commit --amend --no-edit"], r.state);
    expect(withFile.output).toMatch(/^\[main [0-9a-f]{7}\] second fixed\n 2 files changed, 2 insertions\(\+\), 1 deletion\(-\)\n create mode 100644 c$/);
    const all = exec(['edit a "a9"', 'git commit -a --amend -m "x"'], withFile.state);
    expect(repoOf(all.state).commits[headId(all.state)].files).toEqual({ a: "a9", b: "b", c: "c" });
  });

  it("--amend on the root commit, with nothing to amend, and during a merge", () => {
    const root = exec(["git init", "touch a", "git add a", 'git commit -m "one"', 'git commit --amend -m "uno"']);
    expect(root.output).toMatch(/^\[main [0-9a-f]{7}\] uno\n 1 file changed, 0 insertions\(\+\), 0 deletions\(-\)\n create mode 100644 a$/);
    expect(repoOf(root.state).commits[headId(root.state)].parents).toEqual([]);
    expect(exec(["git init", 'git commit --amend -m "x"']).output).toBe("fatal: You have nothing to amend.");
    const merging = exec([
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
      'edit a "R"',
      "git add a",
      'git commit --amend -m "x"',
    ]);
    expect(merging.output).toBe("fatal: You are in the middle of a merge -- cannot amend.");
  });

  it("gives unique ids even for identical commits", () => {
    let s = state(["git init"]);
    const ids = new Set<string>();
    for (let i = 0; i < 40; i++) {
      s = state([`edit f.txt "${i % 2}"`, "git add .", 'git commit -m "same"'], s);
      ids.add(headId(s));
    }
    expect(ids.size).toBe(40);
  });
});
