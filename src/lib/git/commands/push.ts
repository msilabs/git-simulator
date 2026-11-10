import type { CommandHandler } from "../types";
import { failure, get, isAncestor, success } from "../helpers";
import { msg } from "../messages";
import { refLine, remoteError } from "./fetch";

const NO_DESTINATION = [
  "fatal: No configured push destination.",
  "Either specify the URL from the command-line or configure a remote repository using",
  "",
  "    git remote add <name> <url>",
  "",
  "and then push using the remote name",
  "",
  "    git push <name>",
  "",
  "To push to multiple remotes at once, configure a remote group using",
  "",
  '    git config remotes.<groupname> "<remote1> <remote2>"',
  "",
  "and then push using the group name",
  "",
  "    git push <groupname>",
].join("\n");

const noUpstream = (branch: string, remote: string) =>
  [
    `fatal: The current branch ${branch} has no upstream branch.`,
    "To push the current branch and set the remote as upstream, use",
    "",
    `    git push --set-upstream ${remote} ${branch}`,
    "",
    "To have this happen automatically for branches without a tracking",
    "upstream, see 'push.autoSetupRemote' in 'git help config'.",
  ].join("\n");

const rejectedHint = (fetchFirst: boolean) =>
  (fetchFirst
    ? [
        "hint: Updates were rejected because the remote contains work that you do not",
        "hint: have locally. This is usually caused by another repository pushing to",
        "hint: the same ref. If you want to integrate the remote changes, use",
        "hint: 'git pull' before pushing again.",
      ]
    : [
        "hint: Updates were rejected because the tip of your current branch is behind",
        "hint: its remote counterpart. If you want to integrate the remote changes,",
        "hint: use 'git pull' before pushing again.",
      ]
  )
    .concat("hint: See the 'Note about fast-forwards' in 'git push --help' for details.")
    .join("\n");

/**
 * `git push [-u] [--force] [<remote> [<branch>]]`: নিজের commit remote-এ পাঠায়।
 * - remote-এ এমন commit থাকলে যা আমাদের কাছে নেই, আটকে যায় (আগে `git pull`); `--force` দিলে remote-এর কাজ মুছে যায়
 * - `-u` / `--set-upstream`: এই branch-এর upstream ঠিক করে, পরে শুধু `git push` / `git pull` দিলেই চলে
 * সরলীকরণ: একটাই remote; `<local>:<remote>` refspec, tag, `--delete` নেই।
 */
export const push: CommandHandler = (state, args) => {
  const repo = state.repo!;
  let setUpstream = false;
  let force = false;
  const words: string[] = [];
  for (const a of args) {
    if (a === "-u" || a === "--set-upstream") setUpstream = true;
    else if (a === "-f" || a === "--force") force = true;
    else if (a.startsWith("-")) return failure(state, `error: unsupported in simulator: ${a}`, msg.unsupportedOption(a));
    else words.push(a);
  }
  if (words.length > 2) return failure(state, `error: unsupported in simulator: ${words[2]}`, msg.unsupportedOption(words[2]));
  const remote = repo.remote;
  if (!remote) return failure(state, NO_DESTINATION, msg.remoteNone);
  const bad = remoteError(state, words[0]);
  if (bad) return bad;

  let branch = words[1] === "HEAD" ? repo.head : words[1];
  if (branch === undefined) {
    const upstream = get(repo.upstream, repo.head);
    // শুধু `git push` দিলে upstream লাগে; `git push origin` দিলে একই নামের branch-এ যায়
    if (words.length === 0 && upstream === undefined && !setUpstream) return failure(state, noUpstream(repo.head, remote.name), msg.pushNoUpstream(repo.head, remote.name));
    branch = upstream ?? repo.head;
  }
  const local = get(repo.branches, branch);
  if (!local) {
    return failure(state, `error: src refspec ${branch} does not match any\nerror: failed to push some refs to '${remote.url}'`, msg.pushNoBranch(branch));
  }

  const theirs = get(remote.branches, branch);
  const to = `To ${remote.url}`;
  const trackLine = setUpstream ? `branch '${branch}' set up to track '${remote.name}/${branch}'.` : "";
  const upstream = setUpstream ? { ...repo.upstream, [branch]: branch } : repo.upstream;

  if (theirs === local) {
    return success(
      { ...state, repo: { ...repo, upstream, tracking: { ...repo.tracking, [branch]: local } } },
      ["Everything up-to-date", trackLine].filter(Boolean).join("\n"),
      msg.pushUpToDate(branch),
    );
  }
  let line: string;
  let explanation: string;
  if (theirs === undefined) {
    line = refLine("*", "[new branch]", branch, branch);
    explanation = msg.pushNewBranch(branch, remote.name);
  } else if (isAncestor(repo, theirs, local)) {
    line = refLine(" ", `${theirs}..${local}`, branch, branch);
    explanation = msg.pushUpdated(branch, remote.name);
  } else if (force) {
    line = refLine("+", `${theirs}...${local}`, branch, branch, 0, " (forced update)");
    explanation = msg.pushForced(branch, remote.name);
  } else {
    // remote-এর সর্বশেষ commit আমরা fetch করে জানি কি না
    const fetchFirst = get(repo.tracking, branch) !== theirs;
    return failure(
      state,
      [to, refLine("!", "[rejected]", branch, branch, 0, fetchFirst ? " (fetch first)" : " (non-fast-forward)"), `error: failed to push some refs to '${remote.url}'`, rejectedHint(fetchFirst)].join("\n"),
      msg.pushRejected(branch, fetchFirst),
    );
  }

  return success(
    {
      ...state,
      repo: {
        ...repo,
        upstream,
        remote: { ...remote, branches: { ...remote.branches, [branch]: local } },
        tracking: { ...repo.tracking, [branch]: local },
      },
    },
    [to, line, trackLine].filter(Boolean).join("\n"),
    [explanation, setUpstream ? msg.pushTracking(branch, remote.name) : ""].filter(Boolean).join("\n"),
  );
};
