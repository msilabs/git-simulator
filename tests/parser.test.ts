import { describe, expect, it } from "vitest";
import { parseCommand, tokenize } from "../src/lib/git/parser";

describe("parser", () => {
  it("splits words on whitespace", () => {
    expect(parseCommand("  git   add  index.html ")).toEqual({ ok: true, program: "git", args: ["add", "index.html"] });
  });
  it("keeps quoted text together (double and single quotes)", () => {
    expect(tokenize('git commit -m "first commit"').tokens).toEqual(["git", "commit", "-m", "first commit"]);
    expect(tokenize("git commit -m 'hi there'").tokens).toEqual(["git", "commit", "-m", "hi there"]);
  });
  it("handles Bengali text and escaped quotes", () => {
    expect(tokenize('edit a.txt "আমার \\"ফাইল\\""').tokens).toEqual(["edit", "a.txt", 'আমার "ফাইল"']);
  });
  it("keeps an empty quoted string as an argument", () => {
    expect(tokenize('git commit -m ""').tokens).toEqual(["git", "commit", "-m", ""]);
  });
  it("reports empty input and unclosed quotes", () => {
    expect(parseCommand("   ")).toEqual({ ok: false, error: "empty" });
    expect(parseCommand('git commit -m "oops')).toEqual({ ok: false, error: "unclosed-quote" });
  });
});
