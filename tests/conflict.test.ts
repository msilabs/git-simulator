import { describe, expect, it } from "vitest";
import { exec, headId, repoOf, state, ONE_COMMIT } from "./setup";

/** main আর feature দুই দিকেই index.html-এর একই লাইন বদলেছে; feature-এ নতুন ফাইলও আছে */
const CONFLICTING = [
  ...ONE_COMMIT,
  "git switch -c feature",
  'edit index.html "feature version"',
  'edit login.html "login"',
  "git add .",
  'git commit -m "feature edit"',
  "git switch main",
  'edit index.html "main version"',
  "git add .",
  'git commit -m "main edit"',
];

const MARKERS = "<<<<<<< HEAD\nmain version\n=======\nfeature version\n>>>>>>> feature";

describe("merge conflicts", () => {
  it("stops with conflict markers and the real Git messages", () => {
    const before = state(CONFLICTING);
    const r = exec(["git merge feature"], before);
    expect(r.ok).toBe(false);
    expect(r.output).toBe(
      "Auto-merging index.html\nCONFLICT (content): Merge conflict in index.html\nAutomatic merge failed; fix conflicts and then commit the result.",
    );
    expect(r.state.workdir["index.html"]).toBe(MARKERS);
    expect(r.state.workdir["login.html"]).toBe("login"); // সমস্যাহীন ফাইল চলে এসেছে
    const repo = repoOf(r.state);
    expect(repo.branches.main).toBe(headId(before)); // এখনো কোনো commit হয়নি
    expect(repo.merge?.unmerged).toEqual({ "index.html": "both modified" });
    expect(repo.index["login.html"]).toBe("login"); // staged
    expect(repo.index["index.html"]).toBe("main version"); // index-এ আমাদের সংস্করণ
    expect(r.explanation).toContain("merge conflict");
    expect(r.explanation).toContain("git merge --abort");
  });

  it("shows unmerged paths in git status", () => {
    const r = exec([...CONFLICTING, "git merge feature", "git status"]);
    expect(r.output).toBe(
      [
        "On branch main",
        "You have unmerged paths.",
        '  (fix conflicts and run "git commit")',
        '  (use "git merge --abort" to abort the merge)',
        "",
        "Changes to be committed:",
        '  (use "git restore --staged <file>..." to unstage)',
        "\tnew file:   login.html",
        "",
        "Unmerged paths:",
        '  (use "git add <file>..." to mark resolution)',
        "\tboth modified:   index.html",
      ].join("\n"),
    );
    expect(r.explanation).toContain("১টা ফাইলে conflict");
  });

  it("blocks commit, switch, merge and restore until resolved", () => {
    const s = state([...CONFLICTING, "git merge feature"]);
    const commit = exec(['git commit -m "x"'], s);
    expect(commit.ok).toBe(false);
    expect(commit.output).toMatch(/^error: Committing is not possible because you have unmerged files\./);
    expect(exec(["git switch feature"], s).output).toContain("cannot switch branch while merging");
    expect(exec(["git checkout feature"], s).output).toBe(
      "error: you need to resolve your current index first\nindex.html: needs merge",
    );
    expect(exec(["git switch -c other"], s).ok).toBe(false);
    expect(exec(["git merge feature"], s).output).toMatch(/^error: Merging is not possible/);
    expect(exec(["git restore index.html"], s).output).toBe("error: path 'index.html' is unmerged");
  });

  it("resolves with edit + add + commit into a two-parent merge commit", () => {
    const before = state([...CONFLICTING, "git merge feature"]);
    const added = exec(['edit index.html "both versions"', "git add index.html"], before);
    expect(added.explanation).toContain("সব conflict মেটানো শেষ");
    expect(repoOf(added.state).merge?.unmerged).toEqual({});
    expect(exec(["git status"], added.state).output).toContain("All conflicts fixed but you are still merging.");

    const done = exec(["git commit"], added.state); // -m ছাড়া: MERGE_MSG
    expect(done.ok).toBe(true);
    const repo = repoOf(done.state);
    const c = repo.commits[repo.branches.main];
    expect(done.output).toBe(`[main ${c.id}] Merge branch 'feature'`);
    expect(c.parents).toEqual([headId(before), repo.branches.feature]);
    expect(c.files).toEqual({ "index.html": "both versions", "login.html": "login" });
    expect(repo.merge).toBeNull();
    expect(exec(["git status"], done.state).output).toBe("On branch main\nnothing to commit, working tree clean");
  });

  it("accepts a custom message and git merge --continue", () => {
    const s = state([...CONFLICTING, "git merge feature", "git add ."]);
    const custom = exec(['git commit -m "merge feature into main"'], s);
    const repo = repoOf(custom.state);
    expect(repo.commits[repo.branches.main].message).toBe("merge feature into main");
    expect(exec(["git merge --continue"], s).ok).toBe(true);
    expect(exec(["git merge --continue"], state(ONE_COMMIT)).ok).toBe(false);
  });

  it("warns when markers are still in the file after git add", () => {
    const r = exec([...CONFLICTING, "git merge feature", "git add index.html"]);
    expect(r.explanation).toContain("<<<<<<<");
  });

  it("allows resolving by keeping our version unchanged", () => {
    const r = exec([...CONFLICTING, "git merge feature", 'edit index.html "main version"', "git add index.html", "git commit"]);
    expect(r.ok).toBe(true);
  });

  it("aborts back to the exact pre-merge state", () => {
    const before = state(CONFLICTING);
    const r = exec(["git merge feature", "git merge --abort"], before);
    expect(r.ok).toBe(true);
    expect(r.output).toBe("");
    expect(r.state.workdir).toEqual(before.workdir);
    expect(repoOf(r.state).index).toEqual(repoOf(before).index);
    expect(repoOf(r.state).merge).toBeNull();
    expect(exec(["git merge --abort"], before).output).toBe("fatal: There is no merge to abort (MERGE_HEAD missing).");
  });

  it("auto-merges changes on different lines of the same file", () => {
    const r = exec([
      ...ONE_COMMIT.slice(0, 1),
      'edit page.html "<h1>title</h1>\\n<p>a</p>\\n<p>b</p>\\n<footer>f</footer>"',
      "git add .",
      'git commit -m "page"',
      "git switch -c feature",
      'edit page.html "<h1>title</h1>\\n<p>a</p>\\n<p>b</p>\\n<footer>NEW</footer>"',
      "git add .",
      'git commit -m "footer"',
      "git switch main",
      'edit page.html "<h1>TITLE</h1>\\n<p>a</p>\\n<p>b</p>\\n<footer>f</footer>"',
      "git add .",
      'git commit -m "title"',
      "git merge feature",
    ]);
    expect(r.ok).toBe(true);
    expect(r.output).toMatch(/^Auto-merging page.html\nMerge made by the 'ort' strategy\./);
    expect(r.state.workdir["page.html"]).toBe("<h1>TITLE</h1>\n<p>a</p>\n<p>b</p>\n<footer>NEW</footer>");
    expect(r.explanation).toContain("Git নিজেই মিলিয়ে নিল");
  });

  it("abort also unstages unrelated changes staged during the merge, like git reset --merge", () => {
    const before = state(CONFLICTING);
    const r = exec(["git merge feature", 'edit notes.txt "n"', "git add notes.txt", "git merge --abort"], before);
    expect(repoOf(r.state).index).toEqual(repoOf(before).index);
    expect(r.state.workdir["notes.txt"]).toBe("n"); // ফাইলটা থাকে, শুধু unstaged
  });

  it("handles add/add conflicts", () => {
    const r = exec([
      ...ONE_COMMIT,
      "git switch -c feature",
      'edit new.txt "theirs"',
      "git add .",
      'git commit -m "f"',
      "git switch main",
      'edit new.txt "ours"',
      "git add .",
      'git commit -m "m"',
      "git merge feature",
    ]);
    expect(r.output).toContain("CONFLICT (add/add): Merge conflict in new.txt");
    expect(repoOf(r.state).merge?.unmerged).toEqual({ "new.txt": "both added" });
    expect(exec(["git status"], r.state).output).toContain("\tboth added:      new.txt");
  });

  it("handles modify/delete conflicts and resolving by deleting", () => {
    const s = state([
      ...ONE_COMMIT,
      "git switch -c feature",
      "rm index.html",
      "git add .",
      'git commit -m "remove index"',
      "git switch main",
      'edit index.html "changed"',
      "git add .",
      'git commit -m "change index"',
    ]);
    const r = exec(["git merge feature"], s);
    expect(r.output).toContain(
      "CONFLICT (modify/delete): index.html deleted in feature and modified in HEAD.  Version HEAD of index.html left in tree.",
    );
    expect(r.state.workdir["index.html"]).toBe("changed");
    const status = exec(["git status"], r.state).output;
    expect(status).toContain('(use "git add/rm <file>..." as appropriate to mark resolution)');
    expect(status).toContain("\tdeleted by them: index.html");

    const resolved = exec(["rm index.html", "git add index.html", "git commit"], r.state);
    expect(resolved.ok).toBe(true);
    const repo = repoOf(resolved.state);
    expect(repo.commits[repo.branches.main].files).toEqual({});
  });

  it("reports deleted by us when we removed a file they changed", () => {
    const r = exec([
      ...ONE_COMMIT,
      "git switch -c feature",
      'edit index.html "changed"',
      "git add .",
      'git commit -m "change"',
      "git switch main",
      "rm index.html",
      "git add .",
      'git commit -m "remove"',
      "git merge feature",
    ]);
    expect(r.output).toContain("deleted in HEAD and modified in feature.  Version feature of index.html left in tree.");
    expect(r.state.workdir["index.html"]).toBe("changed");
    expect(repoOf(r.state).merge?.unmerged).toEqual({ "index.html": "deleted by us" });

    // মুছে ফেলেই মেটানো: ফাইল ফোল্ডার আর index দুই জায়গাতেই নেই, তবু `git add .` এটাকে ধরে
    const resolved = exec(["rm index.html", "git add ."], r.state);
    expect(repoOf(resolved.state).merge?.unmerged).toEqual({});
    expect(exec(["git commit"], resolved.state).ok).toBe(true);
  });

  it("shows the conflicted file in git diff", () => {
    const r = exec([...CONFLICTING, "git merge feature", "git diff"]);
    expect(r.output).toContain("+<<<<<<< HEAD");
  });
});
