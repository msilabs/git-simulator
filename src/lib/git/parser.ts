/**
 * টার্মিনালের এক লাইন লেখাকে শব্দে (token) ভাঙে।
 * শেলের মতো "ডাবল" বা 'সিঙ্গেল' কোটের ভেতরের স্পেস একসাথে থাকে।
 * ডাবল কোটের ভেতরে \" আর \\ escape কাজ করে।
 *
 * সরলীকরণ: আসল শেলের মতো $VAR, glob (*), পাইপ ইত্যাদি নেই।
 */

export type ParseResult =
  | { readonly ok: true; readonly program: string; readonly args: readonly string[] }
  | { readonly ok: false; readonly error: "empty" | "unclosed-quote" };

export function tokenize(input: string): { tokens: string[]; unclosed: boolean } {
  const tokens: string[] = [];
  let current = "";
  let inToken = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (quote === '"' && ch === "\\" && (input[i + 1] === '"' || input[i + 1] === "\\")) {
        current += input[i + 1];
        i++;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inToken = true;
    } else if (/\s/.test(ch)) {
      if (inToken) {
        tokens.push(current);
        current = "";
        inToken = false;
      }
    } else {
      current += ch;
      inToken = true;
    }
  }
  if (inToken) tokens.push(current);
  return { tokens, unclosed: quote !== null };
}

export function parseCommand(input: string): ParseResult {
  const { tokens, unclosed } = tokenize(input);
  if (unclosed) return { ok: false, error: "unclosed-quote" };
  if (tokens.length === 0) return { ok: false, error: "empty" };
  return { ok: true, program: tokens[0], args: tokens.slice(1) };
}
