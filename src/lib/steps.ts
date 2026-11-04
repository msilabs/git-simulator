/**
 * শুরুর "প্রথম ৫টা কমান্ড"।
 * ধাপ এগোয় হুবহু লেখা মিলিয়ে নয়, ফলাফল দেখে: যেমন `git add .` দিলেও ধাপ ৩ পূর্ণ হয়,
 * আর index.html-এর বদলে অন্য নামের ফাইল বানালেও ধাপ ২ পূর্ণ হয়।
 */
import type { SimState } from "./git/types";

export const STARTER_STEPS = [
  "git init",
  "touch index.html",
  "git add index.html",
  'git commit -m "first commit"',
  "git log",
] as const;

const commitCount = (s: SimState) => (s.repo ? Object.keys(s.repo.commits).length : 0);

/** প্রথম চারটা ধাপ state দেখেই বোঝা যায় */
const reached: ReadonlyArray<(s: SimState) => boolean> = [
  (s) => s.repo !== null,
  (s) => Object.keys(s.workdir).length > 0 || commitCount(s) > 0,
  (s) => (s.repo ? Object.keys(s.repo.index).length > 0 : false),
  (s) => commitCount(s) > 0,
];

/**
 * একটা কমান্ডের পর কততম ধাপে পৌঁছানো গেল।
 * শেষ ধাপ (`git log`) state বদলায় না, তাই সেটা কমান্ড দেখে ঠিক হয়।
 */
export function nextStep(step: number, after: SimState, command: string, ok: boolean): number {
  let s = step;
  while (s < reached.length && reached[s](after)) s++;
  if (s === reached.length && ok && /^\s*git\s+log\b/.test(command)) s++;
  return s;
}
