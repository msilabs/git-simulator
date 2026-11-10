# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `git commit -a` / `--all`, including `-am "message"`. Short options can be combined like in real Git.
- `git rm <file>` and `git rm --cached <file>`, with `-f`, `-r .` and real Git's safety checks. `git rm` also resolves a conflict by deleting the file.

### Fixed
- `git add .` now resolves a conflicted file that was deleted to settle the conflict.
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
