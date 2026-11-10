"use client";

import { useState } from "react";
import type { SimState } from "@/lib/git/types";
import { allPaths, get, has, headCommit } from "@/lib/git/helpers";
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

/**
 * এক কলামের ফাইলের তালিকা। ফাইলে ক্লিক বা ট্যাপ করলে নিচে তার লেখা খোলে,
 * তাই মোবাইলেও (যেখানে hover নেই) লেখা দেখা যায়।
 */
function Column({ id, title, hint, rows, empty }: { id: string; title: string; hint: string; rows: Row[]; empty: string }) {
  const [open, setOpen] = useState<string | null>(null);
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
                  onClick={() => setOpen(isOpen ? null : r.name)}
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
                {isOpen && (
                  <pre
                    id={panelId}
                    className="max-h-40 overflow-auto whitespace-pre-wrap break-words border-t border-ink/10 px-2 py-1.5 font-mono text-xs text-ink"
                  >
                    {r.content === undefined ? ui.deletedFile : r.content === "" ? ui.emptyFile : r.content}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FilePanel({ state }: { state: SimState }) {
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
            {!unmergedCount ? ui.mergeResolvedTitle : repo.merge.kind === "revert" ? ui.revertBannerTitle : ui.mergeBannerTitle}
          </strong>{" "}
          <RichText
            text={
              repo.merge.kind === "revert"
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
        <Column id="work" title={ui.workdirTitle} hint={ui.workdirHint} rows={workRows} empty={ui.workdirEmpty} />
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
