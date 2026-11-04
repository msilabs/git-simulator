import { describe, expect, it } from "vitest";
import { fileDiff } from "../src/lib/git/diffFormat";
import { exec, ONE_COMMIT } from "./setup";

describe("git diff", () => {
  it("shows unstaged changes in unified diff format", () => {
    const r = exec([...ONE_COMMIT, 'edit index.html "hello\\nworld"', "git diff"]);
    expect(r.ok).toBe(true);
    const lines = r.output.split("\n");
    expect(lines[0]).toBe("diff --git a/index.html b/index.html");
    expect(lines[1]).toMatch(/^index [0-9a-f]{7}\.\.[0-9a-f]{7} 100644$/);
    expect(lines.slice(2)).toEqual(["--- a/index.html", "+++ b/index.html", "@@ -1 +1,2 @@", " hello", "+world"]);
  });

  it("shows nothing for staged-only changes, and those changes with --staged / --cached", () => {
    const s = [...ONE_COMMIT, 'edit index.html "changed"', "git add ."];
    const plain = exec([...s, "git diff"]);
    expect(plain.output).toBe("");
    expect(plain.explanation).toContain("কোনো পার্থক্য নেই");
    for (const flag of ["--staged", "--cached"]) {
      const r = exec([...s, `git diff ${flag}`]);
      expect(r.output).toContain("@@ -1 +1 @@\n-hello\n+changed");
    }
  });

  it("does not show untracked files", () => {
    expect(exec([...ONE_COMMIT, 'edit new.txt "x"', "git diff"]).output).toBe("");
  });

  it("shows new and deleted files with --staged", () => {
    const r = exec([...ONE_COMMIT, 'edit new.txt "x"', "rm index.html", "git add .", "git diff --staged"]);
    expect(r.output).toContain("diff --git a/index.html b/index.html\ndeleted file mode 100644\nindex ");
    expect(r.output).toContain("--- a/index.html\n+++ /dev/null\n@@ -1 +0,0 @@\n-hello");
    expect(r.output).toContain("diff --git a/new.txt b/new.txt\nnew file mode 100644\nindex 0000000..");
    expect(r.output).toContain("--- /dev/null\n+++ b/new.txt\n@@ -0,0 +1 @@\n+x");
  });

  it("uses the real empty-blob id for empty files", () => {
    expect(fileDiff("a", undefined, "")).toBe("diff --git a/a b/a\nnew file mode 100644\nindex 0000000..e69de29");
  });

  it("filters by path and rejects unknown paths and revisions", () => {
    const s = [...ONE_COMMIT, 'edit index.html "x"', 'edit b.txt "1"', "git add b.txt", 'edit b.txt "2"'];
    const r = exec([...s, "git diff b.txt"]);
    expect(r.output).toContain("b/b.txt");
    expect(r.output).not.toContain("index.html");
    expect(exec([...s, "git diff nope"]).output).toBe(
      "fatal: ambiguous argument 'nope': unknown revision or path not in the working tree.",
    );
    expect(exec([...s, "git diff main"]).ok).toBe(false);
  });

  it("splits far-apart changes into separate hunks with 3 lines of context", () => {
    const before = Array.from({ length: 20 }, (_, i) => `l${i + 1}`).join("\n");
    const after = before.replace("l2", "L2").replace("l18", "L18");
    const out = fileDiff("f", before, after);
    expect(out).toContain("@@ -1,5 +1,5 @@\n l1\n-l2\n+L2\n l3\n l4\n l5");
    expect(out).toContain("@@ -15,6 +15,6 @@\n l15\n l16\n l17\n-l18\n+L18\n l19\n l20");
  });

  it("joins nearby changes into one hunk", () => {
    const before = Array.from({ length: 12 }, (_, i) => `l${i + 1}`).join("\n");
    const after = before.replace("l2", "L2").replace("l9", "L9");
    expect(fileDiff("f", before, after).match(/@@/g)).toHaveLength(2); // একটা hunk-এর দুই পাশের @@
  });
});
