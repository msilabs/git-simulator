import { describe, expect, it } from "vitest";
import { EMPTY_STATE, exec, headId, repoOf, runCommand, state } from "./setup";
import { complete } from "../src/lib/git/complete";
import { layoutGraph } from "../src/lib/graph/layout";
import { parseSaved } from "../src/lib/storage";

const URL = "https://github.com/learner/project.git";
const BASE = ["git init", 'edit a "a"', "git add .", 'git commit -m "first"'];
const PUSHED = [...BASE, `git remote add origin ${URL}`, "git push -u origin main"];
const id7 = /[0-9a-f]{7}/g;
const strip = (out: string) => out.replace(id7, "ID");

describe("git remote", () => {
  it("adds one remote, lists it and removes it", () => {
    const s = state([...BASE, `git remote add origin ${URL}`]);
    expect(runCommand(s, "git remote").output).toBe("origin");
    expect(runCommand(s, "git remote -v").output).toBe(`origin\t${URL} (fetch)\norigin\t${URL} (push)`);
    expect(runCommand(s, `git remote add origin ${URL}`).output).toBe("error: remote origin already exists.");
    expect(runCommand(s, "git remote add backup x").ok).toBe(false);
    const removed = runCommand(s, "git remote remove origin");
    expect(repoOf(removed.state).remote).toBeNull();
    expect(runCommand(state(BASE), "git remote").output).toBe("");
  });
});

describe("git push", () => {
  it("explains what is missing before the first push", () => {
    expect(exec([...BASE, "git push"]).output.split("\n")[0]).toBe("fatal: No configured push destination.");
    expect(exec([...BASE, `git remote add origin ${URL}`, "git push"]).output).toBe(
      "fatal: The current branch main has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin main\n\nTo have this happen automatically for branches without a tracking\nupstream, see 'push.autoSetupRemote' in 'git help config'.",
    );
    expect(exec([...PUSHED, "git push origin nope"]).output).toBe(
      `error: src refspec nope does not match any\nerror: failed to push some refs to '${URL}'`,
    );
  });

  it("-u pushes a new branch and sets the upstream, then pushes updates", () => {
    const first = exec(PUSHED);
    expect(first.output).toBe(`To ${URL}\n * [new branch]      main -> main\nbranch 'main' set up to track 'origin/main'.`);
    expect(runCommand(first.state, "git status").output).toBe(
      "On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean",
    );
    expect(runCommand(first.state, "git push").output).toBe("Everything up-to-date");

    const ahead = state(['edit a "b"', 'git commit -am "second"'], first.state);
    expect(runCommand(ahead, "git status").output.split("\n").slice(1, 3)).toEqual([
      "Your branch is ahead of 'origin/main' by 1 commit.",
      '  (use "git push" to publish your local commits)',
    ]);
    const old = headId(first.state);
    const pushed = runCommand(ahead, "git push");
    expect(pushed.output).toBe(`To ${URL}\n   ${old}..${headId(ahead)}  main -> main`);
    expect(repoOf(pushed.state).remote!.branches.main).toBe(headId(ahead));
  });

  it("is rejected when the remote has work we do not have, and --force overwrites it", () => {
    const s = state([...PUSHED, 'teammate c "c"', 'edit l "l"', "git add .", 'git commit -m "local"']);
    const r = runCommand(s, "git push");
    expect(r.ok).toBe(false);
    expect(r.output.split("\n").slice(0, 3)).toEqual([
      `To ${URL}`,
      " ! [rejected]        main -> main (fetch first)",
      `error: failed to push some refs to '${URL}'`,
    ]);
    const fetched = state(["git fetch"], s);
    expect(runCommand(fetched, "git push").output.split("\n")[1]).toBe(" ! [rejected]        main -> main (non-fast-forward)");
    const forced = runCommand(s, "git push --force");
    expect(forced.ok).toBe(true);
    expect(forced.output.split("\n")[1]).toMatch(/^ \+ [0-9a-f]{7}\.\.\.[0-9a-f]{7} main -> main \(forced update\)$/);
    expect(forced.explanation).toContain("সাবধান");
  });
});

describe("git fetch and git pull", () => {
  it("fetch updates origin/main and status, without touching files", () => {
    const s = state([...PUSHED, 'teammate c "c"']);
    expect(runCommand(s, "git status").output).toContain("Your branch is up to date with 'origin/main'.");
    const f = runCommand(s, "git fetch");
    expect(strip(f.output)).toBe(`From ${URL}\n   ID..ID  main       -> origin/main`);
    expect(f.state.workdir).toEqual(s.workdir);
    expect(runCommand(f.state, "git status").output.split("\n").slice(1, 3)).toEqual([
      "Your branch is behind 'origin/main' by 1 commit, and can be fast-forwarded.",
      '  (use "git pull" to update your local branch)',
    ]);
    expect(runCommand(f.state, "git fetch").output).toBe("");
    expect(repoOf(f.state).remote!.head).toBe("main"); // Git 2.48+: fetch বানায় origin/HEAD
  });

  it("pull fast-forwards, then says already up to date", () => {
    const r = exec([...PUSHED, 'teammate c "c"', "git pull"]);
    expect(strip(r.output)).toBe(
      `From ${URL}\n   ID..ID  main       -> origin/main\nUpdating ID..ID\nFast-forward\n c | 1 +\n 1 file changed, 1 insertion(+)\n create mode 100644 c`,
    );
    expect(r.state.workdir.c).toBe("c");
    expect(runCommand(r.state, "git pull").output).toBe("Already up to date.");
  });

  it("refuses divergent branches until told how, like Git 2.56", () => {
    const s = state([...PUSHED, 'teammate c "c"', 'edit l "l"', "git add .", 'git commit -m "local"']);
    const r = runCommand(s, "git pull");
    expect(r.ok).toBe(false);
    expect(r.output.split("\n").pop()).toBe("fatal: Need to specify how to reconcile divergent branches.");
    expect(repoOf(r.state).tracking.main).toBe(repoOf(s).remote!.branches.main); // fetch হয়ে গেছে
    const status = runCommand(r.state, "git status");
    expect(status.output).toContain("have diverged,\nand have 1 and 1 different commits each");
    expect(status.explanation).toContain("দুই দিকেই নতুন commit আছে");
    expect(runCommand(s, "git pull --ff-only").output.split("\n").pop()).toBe("fatal: Not possible to fast-forward, aborting.");

    const merged = exec(["git config pull.rebase false", "git pull"], s);
    expect(merged.ok).toBe(true);
    expect(merged.output).toContain("Merge made by the 'ort' strategy.");
    const head = repoOf(merged.state).commits[headId(merged.state)];
    expect(head.message).toBe(`Merge branch 'main' of ${URL}`);
    expect(head.parents).toHaveLength(2);
    expect(runCommand(merged.state, "git status").output).toContain("Your branch is ahead of 'origin/main' by 2 commits.");
    expect(exec(["git pull --no-rebase"], s).ok).toBe(true);
  });

  it("pull with a conflict stops with markers labelled by the fetched commit", () => {
    const s = state([...PUSHED, 'teammate a "X"', 'edit a "Y"', 'git commit -am "mine"']);
    const r = runCommand(s, "git pull --no-rebase origin main");
    expect(r.output.split("\n")[1]).toBe(" * branch            main       -> FETCH_HEAD");
    expect(r.output).toContain("CONFLICT (content): Merge conflict in a");
    const theirs = repoOf(r.state).tracking.main;
    expect(r.state.workdir.a).toBe(`<<<<<<< HEAD\nY\n=======\nX\n>>>>>>> ${theirs}`);
    expect(runCommand(r.state, "git pull").output).toContain("error: Pulling is not possible because you have unmerged files.");
  });

  it("explains a branch without upstream and lets you set one", () => {
    const s = state([...PUSHED, "git switch -c topic"]);
    expect(runCommand(s, "git pull").output.split("\n")[0]).toBe("There is no tracking information for the current branch.");
    const set = runCommand(s, "git branch --set-upstream-to=origin/main");
    expect(set.output).toBe("branch 'topic' set up to track 'origin/main'.");
    expect(runCommand(set.state, "git status").output).toContain("Your branch is up to date with 'origin/main'.");
    expect(runCommand(s, "git branch -u origin/nope").ok).toBe(false);
  });
});

describe("remote branches, clone and teammate", () => {
  it("switching to a branch that only exists on the remote creates a tracking branch", () => {
    const s = state([...PUSHED, 'teammate -b feature f "1"', "git fetch"]);
    expect(runCommand(s, "git branch -r").output).toBe("  origin/HEAD -> origin/main\n  origin/feature\n  origin/main");
    const r = runCommand(s, "git switch feature");
    expect(r.output).toBe("Switched to a new branch 'feature'\nbranch 'feature' set up to track 'origin/feature'.");
    expect(repoOf(r.state).upstream.feature).toBe("feature");
    expect(r.state.workdir.f).toBe("1");
    expect(runCommand(r.state, "git switch main").output).toBe("Switched to branch 'main'\nYour branch is up to date with 'origin/main'.");
    const m = exec(["git merge origin/feature"], s);
    expect(repoOf(m.state).branches.main).toBe(repoOf(s).tracking.feature); // fast-forward
  });

  it("clone brings a demo project with origin, upstream and a remote feature branch", () => {
    const r = runCommand(EMPTY_STATE, "git clone https://github.com/msilabs/demo.git");
    expect(r.ok).toBe(true);
    expect(r.output).toBe("Cloning into 'demo'...");
    expect(Object.keys(r.state.workdir).sort()).toEqual(["README.md", "index.html", "style.css"]);
    expect(runCommand(r.state, "git status").output).toBe(
      "On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean",
    );
    expect(runCommand(r.state, "git branch -a").output).toBe(
      "* main\n  remotes/origin/HEAD -> origin/main\n  remotes/origin/feature/about\n  remotes/origin/main",
    );
    expect(strip(runCommand(r.state, "git log --oneline").output)).toBe(
      "ID (HEAD -> main, origin/main, origin/HEAD) Add styles\nID Add homepage\nID Initial commit",
    );
    expect(runCommand(r.state, "git log -1").output).toContain("Author: Teammate <teammate@example.com>");
    expect(runCommand(state(["git init"]), "git clone x").ok).toBe(false);
    expect(runCommand(state(["touch a"]), "git clone x").ok).toBe(false);
  });

  it("teammate pushes to the remote, not to you", () => {
    const s = state(PUSHED);
    const r = runCommand(s, 'teammate notes.txt "hello"');
    expect(r.output).toMatch(/^teammate pushed [0-9a-f]{7} to origin\/main: Add notes\.txt$/);
    expect(r.state.workdir).toEqual(s.workdir);
    expect(repoOf(r.state).tracking).toEqual(repoOf(s).tracking);
    expect(runCommand(state(BASE), 'teammate a "x"').ok).toBe(false);
  });
});

describe("git config and decorations", () => {
  it("user.name and user.email become the author of new commits", () => {
    const s = state(["git init", 'git config --global user.name "Md Saif"', 'git config user.email "saif@example.com"']);
    expect(runCommand(s, "git config user.name").output).toBe("Md Saif");
    expect(runCommand(s, "git config --list").output).toBe("user.name=Md Saif\nuser.email=saif@example.com");
    const r = exec(['edit a "a"', "git add .", 'git commit -m "mine"', "git log -1"], s);
    expect(r.output).toContain("Author: Md Saif <saif@example.com>");
    expect(runCommand(s, "git config pull.rebase maybe").ok).toBe(false);
    expect(runCommand(s, "git config core.editor vim").ok).toBe(false);
    expect(runCommand(s, "git config constructor x").ok).toBe(false);
  });

  it("orders decorations like real Git: HEAD first, then refs in reverse order", () => {
    const s = state([...BASE, "git branch f", "git branch g", "git branch zed"]);
    expect(strip(runCommand(s, "git log --oneline").output)).toBe("ID (HEAD -> main, zed, g, f) first");
    expect(strip(exec(["git switch g", "git log --oneline"], s).output)).toBe("ID (HEAD -> g, zed, main, f) first");
    expect(strip(exec(["git branch feature", "git log --oneline"], state(PUSHED)).output)).toBe("ID (HEAD -> main, origin/main, feature) first");
  });
});

describe("remote in the graph, completion and saves", () => {
  it("draws remote-tracking branches as separate labels, including fetched commits", () => {
    const s = state([...PUSHED, 'teammate c "c"', "git fetch"]);
    const layout = layoutGraph(repoOf(s));
    expect(layout.nodes).toHaveLength(2);
    const remote = layout.labels.filter((l) => l.remote).map((l) => l.branch);
    expect(remote).toEqual(["origin/main"]);
  });

  it("completes remote names, remote branches and remote-tracking refs", () => {
    const s = state([...PUSHED, 'teammate -b feature f "1"', "git fetch"]);
    expect(complete(s, "git push ")?.text).toBe("git push origin ");
    expect(complete(s, "git switch fe")?.text).toBe("git switch feature ");
    expect(complete(s, "git merge origin/f")?.text).toBe("git merge origin/feature ");
    expect(complete(s, "git pull origin ")?.candidates).toEqual(["feature", "main"]);
  });

  it("treats a remote branch pointing at a missing commit as corrupt", () => {
    const sim = state(PUSHED);
    const repo = repoOf(sim);
    const bad = { ...sim, repo: { ...repo, remote: { ...repo.remote!, branches: { main: "fffffff" } } } };
    expect(parseSaved(JSON.stringify({ v: 2, base: bad, log: [], lines: [], history: [], step: 0 })).status).toBe("corrupt");
    const ok = parseSaved(JSON.stringify({ v: 2, base: sim, log: ['teammate c "c"', "git fetch"], lines: [], history: [], step: 0 }));
    expect(ok.status).toBe("ok");
  });
});
