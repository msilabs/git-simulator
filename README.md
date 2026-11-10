# Git Learning Simulator

[![Deploy to GitHub Pages](https://github.com/msilabs/git-simulator/actions/workflows/pages.yml/badge.svg)](https://github.com/msilabs/git-simulator/actions/workflows/pages.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-1ED6A8.svg)](LICENSE)

A browser-based playground for learning Git without fear. Type Git commands into a fake terminal, watch the commit graph and file states update instantly, and read a short explanation in Bengali after every command.

**Live:** https://msilabs.github.io/git-simulator/

No real Git runs here. A small, pure TypeScript model of Git lives in `src/lib/git/`. There is no server, database or login, and your progress is saved in your browser's `localStorage`.

![Screenshot of the simulator during a merge conflict](docs/screenshot.png)

## Supported commands

| Command | What it does |
|---|---|
| `git init` | Create a repository (re-running it prints "Reinitialized...") |
| `git status` | Show the branch plus staged, modified and untracked files |
| `git add <file>...` / `git add .` | Stage files |
| `git commit -m "message"` | Create a commit from the staging area |
| `git commit -a -m "message"` / `-am` | Stage every modified or deleted tracked file, then commit (untracked files are left out) |
| `git log` / `git log --oneline` | Show history reachable from the current branch |
| `git branch` / `git branch <name>` | List branches / create a branch at the current commit |
| `git switch <name>` / `git switch -c <name>` | Switch branches / create and switch |
| `git checkout <name>` / `git checkout -b <name>` | Same as above, using the older command |
| `git merge <branch>` | Fast-forward, a two-parent merge commit, or stop on a merge conflict |
| `git merge --abort` / `--continue` | Cancel a conflicted merge / finish it (same as `git commit`) |
| `git diff` / `git diff --staged` | Unified diff of unstaged / staged changes (`--cached` also works) |
| `git restore <file>` / `git restore --staged <file>` | Discard working-tree changes / unstage (`.` for everything) |
| `git branch -d` / `-D <name>` | Delete a merged branch / force-delete |
| `git branch -m` / `-M [<old>] <new>` | Rename a branch |
| `git rm <file>` / `git rm --cached <file>` | Delete a tracked file and stage the deletion / stop tracking it but keep the file (`-f` to force, `-r .` for everything) |

Simulator-only helpers: `touch <file>`, `edit <file> "text"` (use `\n` for new lines), `rm <file>`, `ls`, `cat <file>`, `help`, `clear`.

The **↶ undo** button in the top bar steps back one command at a time. Real Git has no such button; the explanation says so.

### Merge conflicts

Merges are line-based (diff3). If the two branches changed different lines, Git merges them automatically. If they changed the same lines, the merge stops, writes Git-style conflict markers into the file, and `git status` lists "Unmerged paths". You resolve it the real way: `edit` the file, then `git add` it, then `git commit`. Modify/delete and add/add conflicts are supported too. To resolve a conflict by deleting the file, use `git rm <file>`.

Other Git commands are recognised as "not in the simulator yet".

### Where the model is simpler than real Git

- Commit ids are 7-character hex ids from a small hash, not SHA-1. They are unique within a session.
- There are no folders. File names are flat, and there are no globs.
- `__proto__` cannot be used as a file or branch name (a JavaScript object cannot hold that key). Every other name, including `constructor` or `toString`, works normally.
- The line-level merge is plain diff3 with the default `merge` conflict style. Real Git (ort) has extra heuristics, so in rare cases it draws conflict hunks differently.
- While a merge is in progress, both `switch` and `checkout` refuse to change branches. Real `checkout` allows it once every conflict is resolved.
- `git diff` during a conflict shows a normal diff against our version, not Git's combined `diff --cc` format. Commit-to-commit diffs (`git diff main feature`) are not supported yet.
- The `index` line in `git diff` uses short fake blob ids (an empty file still gets the real `e69de29`).
- Commits that no branch can reach (after `git branch -D`) disappear from the graph and log, as in real Git. The simulator also never garbage-collects them.
- The merge base is the newest common ancestor. Real Git also handles multiple merge bases.
- `git log` shows no `Date` line, uses a fixed author and does not open a pager.
- `git commit` without `-m` asks for a message instead of opening an editor.
- Line counts in `insertions(+)/deletions(-)` ignore whether a file ends with a newline.
- There is no detached HEAD, and `git checkout <file>` is not supported.

Like real Git, `switch`/`checkout` carry uncommitted changes along when the file is identical on both branches. They refuse only when your changes would be overwritten.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest unit tests (Git model, session, storage)
npm run build    # static export into out/
npm start        # preview the built site from out/ (tiny Node server in scripts/serve.mjs)
npm run test:e2e # Playwright browser tests against out/ (run the build first)
```

Every pull request runs lint, type-check, unit tests, the build and the browser tests in CI (`.github/workflows/ci.yml`).

The site is a fully static export (`output: "export"`). Every push to `main` runs the tests and deploys to GitHub Pages through `.github/workflows/pages.yml`, which builds with `BASE_PATH=/git-simulator`. Vercel also works without any changes.

## Project layout

```
src/lib/git/
  types.ts        Repo, Commit, SimState, CommandResult types
  repo.ts         runCommand(state, input) => { state, output, explanation, ok }
  parser.ts       splits terminal input into words (handles quotes)
  messages.ts     every Bengali command explanation and error in one place
  merge3.ts       line-level three-way merge with conflict markers
  diffFormat.ts   unified diff output for git diff
  lines.ts        line-based LCS diff
  tree.ts         file snapshots: comparing, stats, switching trees
  refs.ts         commits, branches, ancestry, ids, name checks
  own.ts          has()/get(): safe lookups by user-typed names
  helpers.ts      result helpers, re-exports the three modules above
  commands/       one file per command + index.ts registry
src/lib/session.ts  terminal session: run, undo, replay (pure)
src/lib/storage.ts  localStorage save/load with validation
src/lib/steps.ts    "first 5 commands" progress
src/lib/ui-text.ts  every Bengali UI label in one place
src/lib/graph/    pure layout for the SVG commit graph
src/components/   Terminal, FilePanel, CommitGraph, Simulator
tests/            Vitest tests for every command
```

State is immutable: every command returns a new `SimState` (or the same object when nothing changed). Because the model is deterministic, the app saves only a base state plus the list of commands and replays them on load. The list is compacted after 200 commands, so saves stay small. After compaction you can still undo the last 100 commands.

## Adding a new command

1. Create `src/lib/git/commands/<name>.ts` and export a `CommandHandler`:
   `(state, args) => CommandResult`. Never mutate `state`; return a new object.
2. Put all Bengali text in `src/lib/git/messages.ts`.
3. Register it in `src/lib/git/commands/index.ts` (`GIT_COMMANDS` for `git <name>`, `SHELL_COMMANDS` for helpers) and add a line to `HELP_ENTRIES`.
4. Add `tests/<name>.test.ts`. When unsure, match real Git's behaviour and output. If you simplify, say so in a code comment.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Community

- [Changelog](CHANGELOG.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- Found a bug, a confusing Bengali explanation, or output that differs from real Git? [Open an issue](https://github.com/msilabs/git-simulator/issues/new/choose).

## বাংলায় সংক্ষেপে

**Git শেখার সিমুলেটর** হলো নতুন ডেভেলপারদের জন্য একটা ফ্রি, ওপেন-সোর্স অনুশীলনের জায়গা। ব্রাউজারের নকল টার্মিনালে Git কমান্ড লিখুন। পাশে commit গ্রাফ আর ফাইলের অবস্থা সাথে সাথে বদলাবে, আর প্রতিটা কমান্ডের পর বাংলায় ছোট ব্যাখ্যা আসবে: কী ঘটল আর কেন। এখানে আসল Git চলে না, তাই ভুল করলেও কিছু নষ্ট হবে না। ওপরের "নতুন করে শুরু" বোতাম চাপলেই আবার প্রথম থেকে শুরু করা যায়।

অনলাইনে চালান: https://msilabs.github.io/git-simulator/

শুরু করতে লিখুন `git init`, তারপর টার্মিনালের নিচের "প্রথম ৫টা কমান্ড" ধাপগুলো অনুসরণ করুন।

## License

[MIT](LICENSE) © msilabs
