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
