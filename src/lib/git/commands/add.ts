import type { CommandHandler, ConflictKind, FileMap } from "../types";
import { allPaths, failure, get, has, sameFiles, setFile, success } from "../helpers";
import { msg } from "../messages";

/**
 * `git add <file>...`, `git add .`, `git add -A`
 * index-এ ফাইলের বর্তমান লেখা রাখে। tracked ফাইল working directory থেকে মুছে
 * গেলে (যেমন branch বদলের পর) সেই মুছে ফেলাটাও staged হয়, আসল Git-এর মতো।
 * সরলীকরণ: glob (*.html), ফোল্ডার, `-p` ইত্যাদি নেই।
 */
export const add: CommandHandler = (state, args) => {
  const repo = state.repo!;
  const option = args.find((a) => a.startsWith("-") && a !== "-A" && a !== "--all");
  if (option) return failure(state, `error: unknown option '${option.replace(/^-+/, "")}'`, msg.unsupportedOption(option));

  const all = args.some((a) => a === "." || a === "-A" || a === "--all");
  const paths = args.filter((a) => !a.startsWith("-"));
  if (!all && paths.length === 0) {
    return failure(
      state,
      "Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?",
      msg.addMissingArg,
    );
  }

  const targets = all ? allPaths(state.workdir, repo.index) : paths;
  // আসল Git একটাও pathspec না মিললে কিছুই stage না করে থেমে যায়।
  if (!all) {
    for (const p of paths) {
      if (!has(state.workdir, p) && !has(repo.index, p) && !has(repo.merge?.unmerged ?? {}, p)) {
        return failure(state, `fatal: pathspec '${p}' did not match any files`, msg.addNoMatch(p));
      }
    }
  }

  let index: FileMap = repo.index;
  const added: string[] = [];
  const removed: string[] = [];
  // conflict চলা ফাইল add করা মানে "মেটানো হলো", লেখা একই থাকলেও
  const unmerged: Record<string, ConflictKind> = { ...(repo.merge?.unmerged ?? {}) };
  const resolved: string[] = [];
  for (const p of targets) {
    const content = get(state.workdir, p);
    if (has(unmerged, p)) {
      delete unmerged[p];
      resolved.push(p);
    }
    if (get(index, p) === content) continue;
    index = setFile(index, p, content);
    (content === undefined ? removed : added).push(p);
  }

  if (resolved.length) {
    const markers = resolved.filter((p) => /^(<{7}|>{7}) /m.test(get(state.workdir, p) ?? ""));
    const explanation = [
      msg.addResolved(resolved),
      markers.length ? msg.addStillMarkers(markers) : "",
      Object.keys(unmerged).length === 0 ? msg.addResolvedAll : "",
    ]
      .filter(Boolean)
      .join("\n");
    return success(
      { ...state, repo: { ...repo, index, merge: { ...repo.merge!, unmerged } } },
      "",
      explanation,
    );
  }

  if (sameFiles(index, repo.index)) {
    // আসল Git চুপচাপ কিছু না বলে শেষ করে।
    return success(state, "", msg.addNothingNew);
  }
  const explanation = [added.length ? msg.addFiles(added) : "", removed.length ? msg.addRemoved(removed) : ""]
    .filter(Boolean)
    .join("\n");
  return success({ ...state, repo: { ...repo, index } }, "", explanation);
};
