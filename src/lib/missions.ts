/**
 * শেখার পথ: মিশন আর তাদের ধাপ। প্রথম মিশন আগের "প্রথম ৫টা কমান্ড"।
 *
 * ধাপ পূর্ণ হয় ফলাফল দেখে, হুবহু লেখা মিলিয়ে নয়: যেমন `git add .` দিলেও "git add" ধাপ পূর্ণ হয়।
 * অগ্রগতি একটা সংখ্যা: সব মিশনের ধাপ পরপর সাজালে কয়টা শেষ হয়েছে (সেশনের `step`)। তাই undo আর
 * সেভ আগের মতোই চলে, আর পুরোনো সেভের ০-৫ ধাপ হুবহু প্রথম মিশনের ধাপ।
 *
 * মিশনের লেখা বা ক্রম বদলাতে শুধু এই ফাইলটা বদলালেই হবে। নতুন ধাপ শুধু শেষে যোগ করুন,
 * নাহলে পুরোনো সেভের অগ্রগতি অন্য ধাপে চলে যাবে।
 */
import type { Repo, SimState } from "./git/types";
import { aheadBehind, ancestors, get } from "./git/helpers";

/** একটা কমান্ডের আগে-পরের অবস্থা: ধাপ পূর্ণ হলো কি না বুঝতে */
export interface StepContext {
  readonly prev: SimState;
  readonly next: SimState;
  readonly command: string;
  readonly ok: boolean;
  readonly output: string;
}

export interface Stage {
  /** বাংলায় কী করতে হবে (`ব্যাকটিক` অংশ কোডের মতো দেখায়) */
  readonly label: string;
  readonly check: (c: StepContext) => boolean;
  /** থাকলে ধাপটা বোতাম হিসেবে দেখায়, চাপলে এই কমান্ড চলে */
  readonly command?: string;
}

export interface Mission {
  readonly title: string;
  readonly goal: string;
  readonly stages: readonly Stage[];
}

/* ---------- ছোট সাহায্যকারী ---------- */

const repoOf = (s: SimState): Repo | null => s.repo;
const headOf = (s: SimState) => (s.repo ? get(s.repo.branches, s.repo.head) : undefined);
const commitCount = (s: SimState) => (s.repo ? Object.keys(s.repo.commits).length : 0);
/** `git <sub>` দিয়ে শুরু হয় কি না (মাঝে বাড়তি স্পেস থাকলেও) */
const isGit = (command: string, sub: string) => new RegExp(`^\\s*git\\s+${sub}\\b`).test(command);
const headMoved = (c: StepContext) => headOf(c.prev) !== headOf(c.next) && headOf(c.next) !== undefined;
const sameMap = (a: object | undefined, b: object | undefined) => JSON.stringify(a) === JSON.stringify(b);

/** main ছাড়া অন্য কোনো branch-এ এমন commit আছে যা main-এ নেই */
function branchAhead(s: SimState): boolean {
  const repo = repoOf(s);
  const main = repo ? get(repo.branches, "main") : undefined;
  if (!repo || !main) return false;
  const inMain = ancestors(repo, main);
  return Object.entries(repo.branches).some(([name, id]) => name !== "main" && !inMain.has(id));
}

/** বর্তমান branch-এর upstream (origin/...) শেষবার কোন commit-এ দেখা গিয়েছিল */
function upstreamTip(s: SimState): string | undefined {
  const repo = repoOf(s);
  const up = repo ? get(repo.upstream, repo.head) : undefined;
  return repo && up !== undefined ? get(repo.tracking, up) : undefined;
}

/** নিজের branch আর upstream একই commit-এ (push হয়ে গেছে) */
const pushed = (s: SimState) => headOf(s) !== undefined && upstreamTip(s) === headOf(s);

function behindUpstream(s: SimState): boolean {
  const local = headOf(s);
  const remote = upstreamTip(s);
  return !!s.repo && !!local && !!remote && aheadBehind(s.repo, local, remote).behind > 0;
}

/* ---------- মিশনগুলো ---------- */

export const MISSIONS: readonly Mission[] = [
  {
    title: "প্রথম commit",
    goal: "একটা রিপো বানিয়ে প্রথম ফাইলটা commit করুন। বোতামে ক্লিক করলেও চলবে।",
    stages: [
      { label: "git init", command: "git init", check: ({ next }) => next.repo !== null },
      {
        label: "touch index.html",
        command: "touch index.html",
        check: ({ next }) => Object.keys(next.workdir).length > 0 || commitCount(next) > 0,
      },
      {
        label: "git add index.html",
        command: "git add index.html",
        check: ({ next }) => (next.repo ? Object.keys(next.repo.index).length > 0 : false),
      },
      { label: 'git commit -m "first commit"', command: 'git commit -m "first commit"', check: ({ next }) => commitCount(next) > 0 },
      // state বদলায় না, তাই কমান্ড দেখে
      { label: "git log", command: "git log", check: ({ command, ok }) => ok && isGit(command, "log") },
    ],
  },
  {
    title: "বদল দেখে আবার commit",
    goal: "ফাইলের লেখা বদলান, ঠিক কী বদলাল দেখুন, তারপর দ্বিতীয় commit করুন।",
    stages: [
      {
        label: 'commit করা একটা ফাইল বদলান, যেমন `edit index.html "<h1>Hello</h1>"` (বা ফাইল প্যানেলে এডিট)',
        check: ({ next }) => !!next.repo && Object.keys(next.repo.index).some((p) => get(next.workdir, p) !== next.repo!.index[p]),
      },
      { label: "`git diff` দিয়ে দেখুন কোন লাইন বদলেছে", check: ({ command, ok, output }) => ok && isGit(command, "diff") && output !== "" },
      { label: "`git add` আর `git commit` দিয়ে দ্বিতীয় commit করুন", check: (c) => c.ok && isGit(c.command, "commit") && headMoved(c) },
    ],
  },
  {
    title: "নিজের branch-এ কাজ",
    goal: "নতুন branch-এ আলাদা করে কাজ করুন, যাতে main-এর কাজ নিরাপদ থাকে।",
    stages: [
      { label: "`git switch -c feature` দিয়ে নতুন branch বানিয়ে সেখানে যান", check: ({ next }) => !!next.repo && next.repo.head !== "main" },
      {
        label: "ওই branch-এ কিছু বদলে একটা commit করুন",
        check: (c) => c.ok && isGit(c.command, "commit") && headMoved(c) && c.next.repo!.head !== "main",
      },
      {
        label: "`git switch main` দিয়ে ফিরুন; দেখুন main-এর ফাইল আগের মতোই আছে",
        check: ({ next }) => next.repo?.head === "main" && branchAhead(next),
      },
    ],
  },
  {
    title: "merge",
    goal: "branch-এর কাজ main-এ নিয়ে আসুন, তারপর ইতিহাসের ছবি দেখুন।",
    stages: [
      { label: "`git merge feature` দিন", check: (c) => c.ok && isGit(c.command, "merge") && headMoved(c) },
      { label: "`git log --oneline --graph --all` দিয়ে শাখাগুলো দেখুন", check: ({ command, ok }) => ok && isGit(command, "log") && /--graph/.test(command) },
    ],
  },
  {
    title: "merge conflict মেটানো",
    goal: "দুই branch-এ একই ফাইলের একই লাইন আলাদাভাবে বদলালে conflict হয়। একটা বানিয়ে নিজে মেটান।",
    stages: [
      {
        label: "conflict বানান: নতুন branch-এ একটা লাইন বদলে commit, main-এ সেই লাইনই অন্যভাবে বদলে commit, তারপর `git merge`",
        check: ({ next }) => next.repo?.merge?.kind === "merge" && Object.keys(next.repo.merge.unmerged).length > 0,
      },
      {
        label: "চিহ্নগুলো মুছে ফাইল ঠিক করুন (ফাইল প্যানেলে এডিট বা `edit`), তারপর `git add <file>`",
        check: ({ next }) => next.repo?.merge?.kind === "merge" && Object.keys(next.repo.merge.unmerged).length === 0,
      },
      {
        label: "`git commit` দিয়ে merge শেষ করুন",
        check: ({ prev, next }) => prev.repo?.merge?.kind === "merge" && next.repo?.merge === null && headOf(prev) !== headOf(next),
      },
    ],
  },
  {
    title: "ফাইলের ভুল ফেরানো",
    goal: "staging-এ ভুল ফাইল গেলে বা ফাইলে ভুল বদল হলে কীভাবে ফেরাবেন।",
    stages: [
      {
        label: "একটা ফাইল বদলে `git add` দিন, তারপর `git restore --staged <file>` দিয়ে staging থেকে নামান",
        check: ({ prev, next, command, ok }) => ok && (isGit(command, "restore") || isGit(command, "reset")) && !sameMap(prev.repo?.index, next.repo?.index),
      },
      {
        label: "`git restore <file>` দিয়ে ফাইলের বদলটাই বাদ দিন",
        check: ({ prev, next, command, ok }) => ok && isGit(command, "restore") && !/--staged|-S\b/.test(command) && !sameMap(prev.workdir, next.workdir),
      },
    ],
  },
  {
    title: "commit ফেরানো",
    goal: "ভুল commit ফেরানোর দুই উপায়: revert (নতুন commit, ইতিহাস থাকে) আর reset (ইতিহাস থেকে সরায়)।",
    stages: [
      {
        label: "একটা ছোট commit করুন, তারপর `git revert HEAD` দিয়ে সেটার বদল উল্টান (merge commit সরাসরি revert করা যায় না)",
        check: (c) => c.ok && isGit(c.command, "revert") && headMoved(c),
      },
      {
        label: "`git reset --hard HEAD~1` দিয়ে revert commit-টাই সরিয়ে দিন (শুধু push না করা commit-এ এমন করবেন)",
        check: (c) => {
          const before = headOf(c.prev);
          const after = headOf(c.next);
          return c.ok && isGit(c.command, "reset") && !!before && !!after && before !== after && ancestors(c.next.repo!, before).has(after);
        },
      },
    ],
  },
  {
    title: "stash: অর্ধেক কাজ সরিয়ে রাখা",
    goal: "কাজের মাঝে অন্য কাজ এলে commit না করেই বদল সরিয়ে রাখুন, পরে ফিরিয়ে আনুন।",
    stages: [
      { label: "একটা ফাইল বদলে `git stash` দিন", check: ({ prev, next }) => (next.repo?.stash.length ?? 0) > (prev.repo?.stash.length ?? 0) },
      { label: "`git stash list` দিয়ে দেখুন কী রাখা আছে", check: ({ command, ok }) => ok && isGit(command, "stash\\s+list") },
      {
        label: "`git stash pop` দিয়ে বদল ফিরিয়ে আনুন",
        check: ({ prev, next, command }) => isGit(command, "stash\\s+(pop|apply)") && !sameMap(prev.workdir, next.workdir),
      },
    ],
  },
  {
    title: "remote-এ পাঠানো",
    goal: "নিজের রিপো GitHub-এর মতো একটা remote-এ পাঠান, যাতে অন্যরা পায়।",
    stages: [
      { label: "`git remote add origin https://github.com/you/project.git`", check: ({ next }) => !!next.repo?.remote },
      {
        label: "`git push -u origin main` দিয়ে প্রথমবার পাঠান",
        check: ({ next }) => pushed(next),
      },
    ],
  },
  {
    title: "সহকর্মীর কাজ আনা",
    goal: "অন্য কেউ remote-এ push করলে আপনার কাছে আপনা-আপনি আসে না। fetch আর pull দিয়ে আনুন।",
    stages: [
      { label: '`teammate notes.txt "hello"` দিয়ে কল্পিত সহকর্মীকে একটা push করান', check: ({ command, ok }) => ok && /^\s*teammate\b/.test(command) },
      { label: "`git fetch` দিন, তারপর `git status`-এ দেখুন কতটা পিছিয়ে আছেন", check: ({ next, command, ok }) => ok && isGit(command, "status") && behindUpstream(next) },
      { label: "`git pull` দিয়ে সহকর্মীর commit নিজের branch-এ আনুন", check: (c) => c.ok && isGit(c.command, "pull") && headMoved(c) },
    ],
  },
  {
    title: "push আটকে গেলে",
    goal: "দুজনেই একসাথে কাজ করলে push আটকায়। আগে মেলান, তারপর পাঠান।",
    stages: [
      {
        label: "নিজে একটা commit করুন, `teammate ...` দিয়ে সহকর্মীকেও করান, তারপর `git push` দিয়ে দেখুন আটকে যায়",
        check: ({ command, ok, output }) => !ok && isGit(command, "push") && output.includes("[rejected]"),
      },
      { label: "`git config pull.rebase false` আর `git pull` দিয়ে মেলান", check: (c) => c.ok && isGit(c.command, "pull") && headMoved(c) },
      {
        label: "আবার `git push` দিন",
        check: ({ next, command, ok }) => ok && isGit(command, "push") && pushed(next),
      },
    ],
  },
];

/** সব মিশনের ধাপ পরপর */
const STAGES: readonly Stage[] = MISSIONS.flatMap((m) => m.stages);
export const TOTAL_STAGES = STAGES.length;
/** প্রথম মিশনের ধাপের সংখ্যা (আগের "প্রথম ৫টা কমান্ড") */
export const STARTER_STAGES = MISSIONS[0].stages.length;

/** কততম ধাপ পর্যন্ত শেষ হলে কোন মিশন চলছে, আর তার ভেতরে কয়টা ধাপ শেষ */
export function missionAt(step: number): { index: number; done: number } {
  let start = 0;
  for (let index = 0; index < MISSIONS.length; index++) {
    const n = MISSIONS[index].stages.length;
    if (step < start + n) return { index, done: step - start };
    start += n;
  }
  return { index: MISSIONS.length, done: 0 };
}

/**
 * একটা কমান্ডের পর কততম ধাপে পৌঁছানো গেল। একই কমান্ডে পরপর কয়েকটা ধাপ পূর্ণ হতে পারে
 * (যেমন git init-এর আগে ফাইল বানালে)।
 */
export function nextStep(step: number, c: StepContext): number {
  let s = step;
  while (s < STAGES.length && STAGES[s].check(c)) s++;
  return s;
}
