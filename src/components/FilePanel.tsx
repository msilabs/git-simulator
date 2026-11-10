"use client";

import { useState, type KeyboardEvent } from "react";
import type { SimState } from "@/lib/git/types";
import { allPaths, get, has, headCommit } from "@/lib/git/helpers";
import { editCommand } from "@/lib/git/commands/edit";
import { ui } from "@/lib/ui-text";
import { RichText } from "./RichText";

type Badge = "untracked" | "modified" | "staged" | "deleted" | "committed" | "conflict";

const BADGE: Record<Badge, { label: string; className: string }> = {
  untracked: { label: "untracked", className: "bg-slate text-white" },
  modified: { label: "modified", className: "bg-sun text-ink" },
  staged: { label: "staged", className: "bg-mint text-ink" },
  deleted: { label: "deleted", className: "bg-[#FDE2E2] text-[#8A1C1C]" },
  conflict: { label: "conflict", className: "bg-[#B42318] text-white" },
  committed: { label: ui.badgeCommitted, className: "bg-cloud text-slate ring-1 ring-slate/20" },
};

interface Row {
  readonly name: string;
  /** undefined মানে এই কলামে ফাইলটা নেই (মুছে গেছে) */
  readonly content?: string;
  readonly badge?: Badge;
  readonly strike?: boolean;
}

interface ColumnProps {
  id: string;
  title: string;
  hint: string;
  rows: Row[];
  empty: string;
  /** থাকলে খোলা ফাইলের নিচে "এডিট" বোতাম আসে (শুধু Working Directory-তে) */
  onEdit?: (name: string, content: string) => void;
}

/**
 * এক কলামের ফাইলের তালিকা। ফাইলে ক্লিক বা ট্যাপ করলে নিচে তার লেখা খোলে,
 * তাই মোবাইলেও (যেখানে hover নেই) লেখা দেখা যায়। Working Directory-তে সেখান থেকেই এডিট করা যায়।
 */
function Column({ id, title, hint, rows, empty, onEdit }: ColumnProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const save = (name: string) => {
    onEdit?.(name, draft);
    setEditing(null);
  };
  const onEditorKey = (e: KeyboardEvent<HTMLTextAreaElement>, name: string) => {
    if (e.key === "Escape") setEditing(null);
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save(name);
    }
  };
  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-white p-3 ring-1 ring-ink/10">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mb-2 text-xs text-slate">{hint}</p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate/30 px-2 py-3 text-center text-xs text-slate">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const isOpen = open === r.name;
            const panelId = `${id}-${r.name}`;
            return (
              <li key={r.name} className="rounded-lg bg-cloud">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(isOpen ? null : r.name);
                    setEditing(null);
                  }}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  aria-label={`${ui.showContent(r.name)}${r.badge ? ` (${BADGE[r.badge].label})` : ""}`}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-teal"
                >
                  <span className={`truncate font-mono text-[13px] text-ink ${r.strike ? "line-through opacity-60" : ""}`}>
                    {r.name}
                  </span>
                  {r.badge && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[r.badge].className}`}>
                      {BADGE[r.badge].label}
                    </span>
                  )}
                </button>
                {isOpen && editing === r.name && (
                  <div id={panelId} className="border-t border-ink/10 p-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => onEditorKey(e, r.name)}
                      autoFocus
                      spellCheck={false}
                      rows={Math.min(10, Math.max(3, draft.split("\n").length + 1))}
                      aria-label={ui.editorLabel(r.name)}
                      className="w-full resize-y rounded-md bg-white p-2 font-mono text-[16px] text-ink ring-1 ring-ink/20 focus:outline-2 focus:outline-teal sm:text-xs"
                    />
                    <p className="mt-1 text-[11px] text-slate">{ui.editorHint}</p>
                    <div className="mt-1.5 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded-md px-2.5 py-1 text-xs font-semibold text-ink ring-1 ring-ink/20 hover:bg-white"
                      >
                        {ui.editorCancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => save(r.name)}
                        className="rounded-md bg-teal px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110"
                      >
                        {ui.editorSave}
                      </button>
                    </div>
                  </div>
                )}
                {isOpen && editing !== r.name && (
                  <div id={panelId} className="border-t border-ink/10">
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words px-2 py-1.5 font-mono text-xs text-ink">
                      {r.content === undefined ? ui.deletedFile : r.content === "" ? ui.emptyFile : r.content}
                    </pre>
                    {onEdit && r.content !== undefined && (
                      <div className="flex justify-end px-2 pb-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDraft(r.content ?? "");
                            setEditing(r.name);
                          }}
                          aria-label={ui.editorOpen(r.name)}
                          className="rounded-md px-2.5 py-1 text-xs font-semibold text-teal ring-1 ring-teal/30 hover:bg-teal/5"
                        >
                          {ui.editorEdit}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FilePanel({ state, onRun }: { state: SimState; onRun: (command: string) => void }) {
  const { workdir, repo } = state;
  const index = repo?.index ?? {};
  const head = repo ? headCommit(repo) : null;
  const tree = head?.files ?? {};

  const unmerged = repo?.merge?.unmerged ?? {};
  const unmergedCount = Object.keys(unmerged).length;
  const workRows: Row[] = allPaths(workdir, index, unmerged)
    .filter((p) => has(workdir, p) || (repo && has(index, p)))
    .map((p): Row => {
      const content = get(workdir, p);
      if (has(unmerged, p)) return { name: p, content, badge: "conflict", strike: content === undefined };
      if (content === undefined) return { name: p, badge: "deleted", strike: true };
      if (!repo || !has(index, p)) return { name: p, content, badge: "untracked" };
      if (content !== index[p]) return { name: p, content, badge: "modified" };
      return { name: p, content };
    });

  const stageRows: Row[] = allPaths(index, tree).map((p): Row => {
    const content = get(index, p);
    if (has(unmerged, p)) return { name: p, content, badge: "conflict" };
    if (content === undefined) return { name: p, badge: "deleted", strike: true };
    if (content !== get(tree, p)) return { name: p, content, badge: "staged" };
    return { name: p, content };
  });

  const commitRows: Row[] = Object.keys(tree)
    .sort()
    .map((p) => ({ name: p, content: tree[p], badge: "committed" }));

  const legend = repo?.merge
    ? (["untracked", "modified", "staged", "conflict"] as const)
    : (["untracked", "modified", "staged"] as const);

  return (
    <section aria-label={ui.filesTitle} className="rounded-2xl bg-white/60 p-3 ring-1 ring-ink/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="font-semibold text-ink">{ui.filesTitle}</h2>
        <ul className="flex flex-wrap gap-1.5 text-[11px]" aria-label={ui.legendLabel}>
          {legend.map((b) => (
            <li key={b} className={`rounded-full px-2 py-0.5 font-semibold ${BADGE[b].className}`}>
              {BADGE[b].label}
            </li>
          ))}
        </ul>
      </div>
      {repo?.merge && (
        <div className="mb-3 rounded-xl border border-[#B42318]/30 bg-[#FEF3F2] px-3 py-2 text-sm text-[#7A271A]">
          <strong>
            {repo.merge.kind === "stash"
              ? ui.stashConflictBannerTitle
              : !unmergedCount
                ? ui.mergeResolvedTitle
                : repo.merge.kind === "revert"
                  ? ui.revertBannerTitle
                  : ui.mergeBannerTitle}
          </strong>{" "}
          <RichText
            text={
              repo.merge.kind === "stash"
                ? ui.stashConflictBanner(unmergedCount)
                : repo.merge.kind === "revert"
                ? unmergedCount
                  ? ui.revertBanner(repo.merge.theirs, unmergedCount)
                  : ui.revertResolved
                : unmergedCount
                  ? ui.mergeBanner(repo.merge.branch, unmergedCount)
                  : ui.mergeResolved
            }
            codeClassName="font-mono"
          />
        </div>
      )}
      {repo && repo.stash.length > 0 && (
        <p className="mb-3 text-xs text-slate">
          <RichText text={ui.stashNote(repo.stash.length)} codeClassName="font-mono" />
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Column
          id="work"
          title={ui.workdirTitle}
          hint={ui.workdirHint}
          rows={workRows}
          empty={ui.workdirEmpty}
          onEdit={(name, content) => onRun(editCommand(name, content))}
        />
        <Column
          id="stage"
          title={ui.stagingTitle}
          hint={ui.stagingHint}
          rows={stageRows}
          empty={repo ? ui.stagingEmpty : ui.needInit}
        />
        <Column
          id="commit"
          title={ui.commitTitle}
          hint={head ? `HEAD → ${head.id}` : ui.commitHint}
          rows={commitRows}
          empty={repo ? ui.commitEmpty : ui.needInit}
        />
      </div>
    </section>
  );
}
