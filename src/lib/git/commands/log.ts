import type { CommandHandler, Commit, Repo } from "../types";
import { ancestors, failure, get, headCommit, success } from "../helpers";
import { msg } from "../messages";

/**
 * commit-এর পাশে "(HEAD -> main, origin/main, feature)" লেবেল, আসল Git-এর ক্রমে:
 * আগে HEAD, তারপর বাকি ref পুরো নামের (refs/remotes/..., refs/heads/...) উল্টো বর্ণানুক্রমে।
 */
export function decoration(repo: Repo, id: string): string {
  const refs: { full: string; short: string }[] = [];
  for (const b of Object.keys(repo.branches)) {
    if (repo.branches[b] === id && b !== repo.head) refs.push({ full: `refs/heads/${b}`, short: b });
  }
  if (repo.remote) {
    const r = repo.remote.name;
    for (const b of Object.keys(repo.tracking)) {
      if (repo.tracking[b] === id) refs.push({ full: `refs/remotes/${r}/${b}`, short: `${r}/${b}` });
    }
    if (repo.remote.head && get(repo.tracking, repo.remote.head) === id) {
      refs.push({ full: `refs/remotes/${r}/HEAD`, short: `${r}/HEAD` });
    }
  }
  const names = refs.sort((a, b) => (a.full < b.full ? 1 : -1)).map((x) => x.short);
  if (get(repo.branches, repo.head) === id) names.unshift(`HEAD -> ${repo.head}`);
  return names.length ? ` (${names.join(", ")})` : "";
}

/** commit-এর লেখক: commit-এ রাখা থাকলে সেটা, নাহলে ডিফল্ট শিক্ষার্থী */
export const authorOf = (c: Commit) => c.author ?? "Learner <learner@example.com>";

/** `git log`/`git show`-এর লম্বা রূপে একটা commit (Date লাইন ছাড়া) */
export function formatCommit(repo: Repo, c: Commit): string {
  const lines = [`commit ${c.id}${decoration(repo, c.id)}`];
  if (c.parents.length > 1) lines.push(`Merge: ${c.parents.join(" ")}`);
  lines.push(`Author: ${authorOf(c)}`, "");
  lines.push(...c.message.split("\n").map((l) => (l ? `    ${l}` : "")));
  return lines.join("\n");
}

const oneLine = (repo: Repo, c: Commit) => `${c.id}${decoration(repo, c.id)} ${c.message.split("\n")[0]}`;

/** tip-গুলো থেকে পৌঁছানো যায় এমন সব commit, নতুন থেকে পুরোনো (আসল Git-এর ডিফল্ট ক্রম) */
function byDate(repo: Repo, tips: readonly string[]): Commit[] {
  const ids = new Set<string>();
  for (const tip of tips) for (const id of ancestors(repo, tip)) ids.add(id);
  return [...ids].map((id) => repo.commits[id]).sort((a, b) => b.time - a.time);
}

/**
 * `--graph`-এর ক্রম, আসল Git-এর topo-order-এর মতো: কোনো commit তার সব child-এর আগে আসে না,
 * আর merge-এর পর দ্বিতীয় parent-এর শাখা আগে শেষ হয়, তারপর প্রথম parent-এর।
 */
function topoOrder(repo: Repo, tips: readonly string[]): Commit[] {
  const commits = byDate(repo, tips);
  const indegree = new Map(commits.map((c) => [c.id, 0]));
  for (const c of commits) for (const p of c.parents) indegree.set(p, indegree.get(p)! + 1);
  // stack: সবচেয়ে নতুন tip সবার আগে বের হয়
  const stack = commits.filter((c) => indegree.get(c.id) === 0).reverse();
  const out: Commit[] = [];
  while (stack.length) {
    const c = stack.pop()!;
    out.push(c);
    for (const p of c.parents) {
      indegree.set(p, indegree.get(p)! - 1);
      if (indegree.get(p) === 0) stack.push(repo.commits[p]);
    }
  }
  return out;
}

/**
 * `git log --graph --oneline`-এর ASCII গ্রাফ, আসল Git-এর graph.c-র মূল নিয়ম মেনে।
 * প্রতিটা কলাম একটা "অপেক্ষমাণ" commit; commit-এর লাইনে তার কলামে `*`, তারপর কলাম বদলালে
 * একটা সংযোগ-লাইন (`|\`, `|/`, `|\|`)।
 * সরলীকরণ: এক কলামের বেশি দূরে যাওয়া রেখা আসল Git কয়েক লাইনে আঁকে; এখানে এক লাইনে সরল `/` বা `\`।
 */
function graphLines(repo: Repo, commits: readonly Commit[]): string[] {
  const out: string[] = [];
  let cols: string[] = [];
  // আগের সংযোগ-লাইনের তথ্য: commit-এর লাইনে কয়েকটা কলাম `|`-এর বদলে `/` বা `\` হয়
  let prev: { kind: "merge" | "collapse" | null; arrivedLeft: Set<number>; edgesAdded: number; at: number } = {
    kind: null,
    arrivedLeft: new Set(),
    edgesAdded: 0,
    at: -1,
  };
  for (const c of commits) {
    let at = cols.indexOf(c.id);
    if (at < 0) {
      cols = [...cols, c.id];
      at = cols.length - 1;
    }
    const spliced = [...cols.slice(0, at), ...c.parents, ...cols.slice(at + 1)];
    const next = spliced.filter((id, i) => spliced.indexOf(id) === i);
    const width = 2 * Math.max(cols.length, next.length);
    const edgesAdded = Math.max(0, c.parents.length - 1);

    const row = cols
      .map((id, i) => {
        if (i === at) return "*";
        if (i > at && edgesAdded > 1) return "\\";
        if (i > at && edgesAdded === 1) {
          return prev.kind === "merge" && prev.edgesAdded > 0 && prev.at < i ? "\\" : "|";
        }
        // আগের লাইনে তির্যকভাবে এসেছে আর আরও বাঁয়ে যাবে: commit-এর লাইনেই বাঁকা শুরু
        if (prev.kind === "collapse" && prev.arrivedLeft.has(i) && next.indexOf(id) < i) return "/";
        return "|";
      })
      .join(" ");
    out.push(`${row.padEnd(width)}${oneLine(repo, c)}`);

    // পুরোনো কলাম থেকে নতুন কলামে রেখা: সোজা হলে `|`, ডানে গেলে `\`, বাঁয়ে গেলে `/`
    const chars = new Array<string>(width).fill(" ");
    const arrivedLeft = new Set<number>();
    let straight = true;
    const edge = (from: number, to: number) => {
      if (to === from) chars[2 * from] = "|";
      else if (to > from) chars[2 * from + 1] = "\\";
      else {
        chars[2 * from - 1] = "/";
        arrivedLeft.add(to);
      }
      if (to !== from) straight = false;
    };
    cols.forEach((id, i) => {
      if (i === at) c.parents.forEach((p) => edge(i, next.indexOf(p)));
      else edge(i, next.indexOf(id));
    });
    if (!straight) out.push(chars.join("").trimEnd());
    prev = { kind: straight ? null : c.parents.length > 1 ? "merge" : "collapse", arrivedLeft, edgesAdded, at };
    cols = next;
  }
  return out;
}

/** "-n 3", "-n3", "-3", "--max-count=3" থেকে সংখ্যা; ভুল হলে null */
function parseCount(args: readonly string[], i: number): { count: number; used: number } | null {
  const a = args[i];
  const m = /^(?:-n|--max-count=|-)(\d+)$/.exec(a);
  if (m) return { count: Number(m[1]), used: 1 };
  if ((a === "-n" || a === "--max-count") && /^\d+$/.test(args[i + 1] ?? "")) return { count: Number(args[i + 1]), used: 2 };
  return null;
}

/**
 * `git log` [--oneline] [--graph] [--all] [-n <সংখ্যা>]
 * সরলীকরণ: id ৭ অক্ষরের (আসল Git পূর্ণ ৪০ অক্ষরের hash দেখায়), Author নির্দিষ্ট,
 * আর Date লাইন নেই, কারণ সিমুলেটরে শুধু ক্রমিক সময় আছে। পেজার (less) খোলে না।
 * `--graph` শুধু `--oneline`-এর সাথে চলে।
 */
export const log: CommandHandler = (state, args) => {
  const repo = state.repo!;
  let oneline = false;
  let graph = false;
  let all = false;
  let limit = Infinity;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--oneline") oneline = true;
    else if (a === "--graph") graph = true;
    else if (a === "--all") all = true;
    else {
      const n = parseCount(args, i);
      if (!n) return failure(state, `error: unsupported in simulator: ${a}`, msg.unsupportedOption(a));
      limit = n.count;
      i += n.used - 1;
    }
  }
  if (graph && !oneline) {
    return failure(state, "error: unsupported in simulator: --graph without --oneline", msg.logGraphNeedsOneline);
  }

  const head = headCommit(repo);
  const tips = all ? [...Object.values(repo.branches), ...Object.values(repo.tracking)] : head ? [head.id] : [];
  if (tips.length === 0) {
    return failure(
      state,
      `fatal: your current branch '${repo.head}' does not have any commits yet`,
      msg.logNoCommits(repo.head),
    );
  }

  const commits = (graph ? topoOrder(repo, tips) : byDate(repo, tips)).slice(0, limit);
  const output = graph
    ? graphLines(repo, commits).join("\n")
    : oneline
      ? commits.map((c) => oneLine(repo, c)).join("\n")
      : commits.map((c) => formatCommit(repo, c)).join("\n\n");

  const explanation = [
    msg.logShown(commits.length, all ? null : repo.head),
    graph ? msg.logGraph : "",
  ]
    .filter(Boolean)
    .join("\n");
  return success(state, output, explanation);
};
