import type { CommandHandler, Commit } from "../types";
import { failure, get, has, isValidFileName, makeCommitId, setFile, success } from "../helpers";
import { msg } from "../messages";

/**
 * `teammate [-b <branch>] <file> "লেখা"` (সিমুলেটরের সহায়ক কমান্ড, Git নয়)
 * কল্পিত এক সহকর্মী remote-এ একটা commit push করে: ফাইলের লেখা বদলায় বা নতুন ফাইল বানায়।
 * আপনার কাছে তা আসে না যতক্ষণ না `git fetch` বা `git pull` দেন; এতে pull, fetch আর
 * "push rejected" অনুশীলন করা যায়।
 */
export const teammate: CommandHandler = (state, args) => {
  const repo = state.repo;
  if (!repo?.remote) return failure(state, "teammate: no remote yet", msg.teammateNoRemote);
  const remote = repo.remote;
  let words = [...args];
  let branch = remote.head ?? (has(remote.branches, "main") ? "main" : Object.keys(remote.branches)[0]);
  if (words[0] === "-b") {
    if (!words[1]) return failure(state, 'usage: teammate [-b <branch>] <file> "text"', msg.teammateUsage);
    branch = words[1];
    words = words.slice(2);
  }
  if (words.length < 2) return failure(state, 'usage: teammate [-b <branch>] <file> "text"', msg.teammateUsage);
  const [file, ...text] = words;
  if (!isValidFileName(file)) return failure(state, `teammate: '${file}': Invalid file name`, msg.invalidFileName(file));

  // নতুন branch হলে remote-এর ডিফল্ট branch থেকে শুরু
  const defaultTip = remote.head ? get(remote.branches, remote.head) : get(remote.branches, "main");
  const parentId = get(remote.branches, branch) ?? defaultTip;
  if (!branch || !parentId) return failure(state, "teammate: the remote has no commits yet", msg.teammateEmptyRemote);
  const parent = repo.commits[parentId];
  const existed = has(parent.files, file);
  const message = `${existed ? "Update" : "Add"} ${file}`;
  const time = state.clock + 1;
  const id = makeCommitId(repo, `${time}:teammate:${parentId}:${file}`);
  const created: Commit = {
    id,
    message,
    parents: [parentId],
    files: setFile(parent.files, file, text.join(" ").replace(/\\n/g, "\n")),
    time,
    // গ্রাফে আলাদা লেনে দেখাতে (আপনার নিজের main-এর commit থেকে আলাদা)
    branch: `${remote.name}/${branch}`,
    author: "Teammate <teammate@example.com>",
  };
  return success(
    {
      ...state,
      clock: time,
      repo: { ...repo, commits: { ...repo.commits, [id]: created }, remote: { ...remote, branches: { ...remote.branches, [branch]: id } } },
    },
    `teammate pushed ${id} to ${remote.name}/${branch}: ${message}`,
    msg.teammatePushed(remote.name, branch),
  );
};
