import { describe, expect, it } from "vitest";
import { exec, repoOf, state, ONE_COMMIT } from "./setup";

describe("git add", () => {
  it("stages one file", () => {
    const r = exec(["git init", 'edit index.html "hi"', "git add index.html"]);
    expect(r.ok).toBe(true);
    expect(r.output).toBe("");
    expect(repoOf(r.state).index).toEqual({ "index.html": "hi" });
    expect(r.explanation).toBe("index.html এখন staging area-তে। পরের commit-এ এটা যাবে।");
  });

  it("stages a snapshot: later edits are not staged automatically", () => {
    const s = state(["git init", 'edit a.txt "one"', "git add a.txt", 'edit a.txt "two"']);
    expect(repoOf(s).index["a.txt"]).toBe("one");
    expect(s.workdir["a.txt"]).toBe("two");
  });

  it("stages everything with git add .", () => {
    const r = exec(["git init", "touch a.txt", "touch b.txt", "git add ."]);
    expect(Object.keys(repoOf(r.state).index)).toEqual(["a.txt", "b.txt"]);
    expect(r.explanation).toContain("a.txt, b.txt");
  });

  it("accepts several file names", () => {
    const r = exec(["git init", "touch a.txt", "touch b.txt", "touch c.txt", "git add a.txt c.txt"]);
    expect(Object.keys(repoOf(r.state).index)).toEqual(["a.txt", "c.txt"]);
  });

  it("errors on a missing file and stages nothing", () => {
    const before = state(["git init", "touch a.txt"]);
    const r = exec(["git add a.txt nope.txt"], before);
    expect(r.ok).toBe(false);
    expect(r.output).toBe("fatal: pathspec 'nope.txt' did not match any files");
    expect(r.state).toBe(before);
  });

  it("errors when no file is given", () => {
    const r = exec(["git init", "git add"]);
    expect(r.ok).toBe(false);
    expect(r.output).toContain("Nothing specified, nothing added.");
  });

  it("rejects unsupported options", () => {
    const r = exec(["git init", "touch a", "git add -p"]);
    expect(r.ok).toBe(false);
  });

  it("is a quiet no-op when nothing changed", () => {
    const r = exec([...ONE_COMMIT, "git add ."]);
    expect(r.ok).toBe(true);
    expect(r.explanation).toContain("নতুন কিছু staging-এ যায়নি");
  });
});
