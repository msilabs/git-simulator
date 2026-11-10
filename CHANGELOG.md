# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Remotes: `git clone`, `git remote`, `git push` (with `-u` and `--force`), `git fetch`, `git pull` (with Git 2.56's divergent-branch rule, `--no-rebase` and `--ff-only`), `git branch -r/-a/--set-upstream-to`, switching to a branch that only exists on the remote, `git merge origin/main`, and ahead/behind/diverged lines in `git status`. Remote-tracking branches appear in the graph and in `git log --all`. Checked against git 2.56 with a real bare repository: 100 of 102 commands match, the other two are documented simplifications.
- `teammate`, a simulator helper that pushes an imaginary colleague's commit to the remote.
- `git config` for `user.name`, `user.email` (used as the author of new commits), `pull.rebase` and `pull.ff`.
- Edit working-directory files right in the file panel. Saving runs the equivalent `edit` command in the terminal. `edit` now also understands `\\` for a literal backslash.
- A conflicting `git stash pop` / `apply` now writes conflict markers like real Git, keeps the cleanly merged changes staged and keeps the stash entry.
- `git restore --staged <file>` settles a conflicted file with our version (merge, revert or stash), like real Git.
- `git log --graph` (with `--oneline`), `--all` and `-n <N>` / `-<N>`. The graph follows real Git's drawing rules, checked line by line against git 2.56.
- `git show [<commit>]`, and simulator helpers `echo` (with `>` and `>>`) and `pwd`.
- Tab completion in the terminal, like a real shell: commands, git subcommands, files (only changed ones for `git add`), branches, stash entries and options. A second Tab lists all matches.
- `git reset` with `--soft`, `--mixed` and `--hard`, `git reset <file>`, and revisions like `HEAD~1`, `main^`, `HEAD^2` or a commit id. The explanation says how to get back to commits that were left behind.
- `git revert <commit>`, including line-level merging, conflicts, `git revert --continue`, `--abort` and `--skip`.
- `git stash`, `git stash -m`, `list`, `pop`, `apply`, `drop` and `clear`. The file panel shows how many entries are stashed.
- `git commit --amend` (with `-m`, `--no-edit` or `-a`).
- `git commit -a` / `--all`, including `-am "message"`. Short options can be combined like in real Git.
- `git rm <file>` and `git rm --cached <file>`, with `-f`, `-r .` and real Git's safety checks. `git rm` also resolves a conflict by deleting the file.

### Fixed
- `git log` decorations are now ordered like real Git (`HEAD -> main` first, then the other refs in reverse order).
- `git add .` now resolves a conflicted file that was deleted to settle the conflict.
- `git status` output now matches real Git line for line: no blank line right after "On branch", no "unstage" hints during a merge, and no closing hint once all merge conflicts are fixed.
- `git commit` with unresolved conflicts lists the files with `U`, like real Git.
- Two open tabs no longer overwrite each other's progress. Each tab picks up saves (and "start over") from the other.
- Undo after a reload restores the starter step that was saved, instead of dropping back one step.
- Typing a name that exists on every JavaScript object (`toString`, `constructor`, `git constructor`, `git switch toString` and so on) no longer crashes the page. These names now work like any other file or branch name. `__proto__` is refused as a file or branch name.
- The crash screen first offers a plain reload, which keeps saved progress. "Start over" is now the second option.

## [2.1.0] - 2026-11-04

### Fixed
- Corrupt or outdated saved data no longer leaves a blank page. Saves are validated deeply, and an error boundary offers "start over".
- Long sessions keep saving. The app stores a base state plus the command log and replays it on load (360 commands: about 334 KB instead of hitting the 5 MB limit).
- No horizontal scroll on 320px screens.
- Many branches on one commit no longer pile up. Extra labels collapse into a "+N" chip.
- `touch` on an existing file no longer creates an empty undo step.
- `git merge --abort` resets the whole index, like `git reset --merge`.

### Added
- Tap a file in the file panel to see its content.
- A warning in the header when saving fails.
- Browser tests (Playwright, desktop and phone) and a CI workflow for every pull request.
- Dependabot, and GitHub Actions pinned to commit SHAs.

### Changed
- Starter steps advance by result, so `git add .` counts too, and undo restores the step.
- Screen readers hear only the latest explanation instead of the whole terminal.
- All Bengali UI labels live in `src/lib/ui-text.ts`.
- Upgraded to Next.js 16.4.2 (production `npm audit`: 0) and Vitest 4. The `serve` package is replaced by a small Node script.
- Split `helpers.ts` into `lines.ts`, `tree.ts` and `refs.ts`.

## [2.0.0] - 2026-11-04

### Added
- Merge conflicts: line-level three-way merge (diff3), Git-style conflict markers, "Unmerged paths" in `git status`, resolving with `git add` + `git commit`, `git merge --abort` and `git merge --continue`. Modify/delete and add/add conflicts are supported.
- `git diff` and `git diff --staged` (`--cached`), with colored unified diff output.
- `git restore <file>` and `git restore --staged <file>` (also `.` and `--worktree`).
- `git branch -d` / `-D` and `git branch -m` / `-M`.
- Simulator helper `rm <file>`.
- "↶ undo" button that steps back one command at a time, saved across reloads.
- Conflict badge and "merge in progress" banner in the file panel.
- Static export and automatic GitHub Pages deployment.

### Changed
- Changing the same file on both branches no longer blocks the merge. Different lines merge automatically, and only overlapping changes cause a conflict.
- Commits that no branch can reach (after `git branch -D`) are hidden from the graph.

### Fixed
- Bengali explanations containing inline code no longer break into columns.

## [1.0.0] - 2026-11-04

### Added
- Pure TypeScript model of Git: `init`, `status`, `add`, `commit`, `log`, `branch`, `switch`, `checkout`, `merge` (fast-forward and merge commits).
- Helpers: `touch`, `edit`, `ls`, `cat`, `help`, `clear`.
- Fake terminal with history, file panel (working directory, staging area, last commit) and an SVG commit graph.
- Bengali explanation after every command, plus clickable "first 5 commands" steps.
- Progress saved in `localStorage`.

[2.1.0]: https://github.com/msilabs/git-simulator/compare/b2add6d...37e3ed9
[2.0.0]: https://github.com/msilabs/git-simulator/compare/5b5b80b...b2add6d
[1.0.0]: https://github.com/msilabs/git-simulator/commit/5b5b80b
