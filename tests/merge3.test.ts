import { describe, expect, it } from "vitest";
import { merge3 } from "../src/lib/git/merge3";

const m = (base: string[], ours: string[], theirs: string[]) =>
  merge3(base.join("\n"), ours.join("\n"), theirs.join("\n"), "HEAD", "feature");

describe("merge3 (line-level three-way merge)", () => {
  it("merges changes to different lines cleanly", () => {
    const r = m(["a", "b", "c", "d", "e"], ["A", "b", "c", "d", "e"], ["a", "b", "c", "d", "E"]);
    expect(r).toEqual({ content: "A\nb\nc\nd\nE", conflict: false });
  });

  it("takes identical changes on both sides", () => {
    expect(m(["a"], ["x"], ["x"])).toEqual({ content: "x", conflict: false });
  });

  it("keeps insertions from both sides at different places", () => {
    const r = m(["a", "b", "c"], ["top", "a", "b", "c"], ["a", "b", "c", "bottom"]);
    expect(r.content).toBe("top\na\nb\nc\nbottom");
    expect(r.conflict).toBe(false);
  });

  it("writes Git-style conflict markers when the same line changed differently", () => {
    const r = m(["<h1>hello</h1>", "<p>x</p>"], ["<h1>Home</h1>", "<p>x</p>"], ["<h1>Welcome</h1>", "<p>x</p>"]);
    expect(r.conflict).toBe(true);
    expect(r.content).toBe(
      ["<<<<<<< HEAD", "<h1>Home</h1>", "=======", "<h1>Welcome</h1>", ">>>>>>> feature", "<p>x</p>"].join("\n"),
    );
  });

  it("treats two new files with different content as a conflict (empty base)", () => {
    const r = m([], ["ours"], ["theirs"]);
    expect(r.conflict).toBe(true);
    expect(r.content).toBe("<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feature");
  });

  it("handles deletions on one side", () => {
    expect(m(["a", "b", "c"], ["a", "c"], ["a", "b", "c"])).toEqual({ content: "a\nc", conflict: false });
  });
});
