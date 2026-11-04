# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

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

[2.0.0]: https://github.com/msilabs/git-simulator/compare/5b5b80b...b2add6d
[1.0.0]: https://github.com/msilabs/git-simulator/commit/5b5b80b
