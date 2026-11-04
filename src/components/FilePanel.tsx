"use client";

import type { SimState } from "@/lib/git/types";
import { allPaths, headCommit } from "@/lib/git/helpers";
import { bn } from "@/lib/git/messages";

type Badge = "untracked" | "modified" | "staged" | "deleted" | "committed" | "conflict";

const BADGE: Record<Badge, { label: string; className: string }> = {
  untracked: { label: "untracked", className: "bg-slate text-white" },
  modified: { label: "modified", className: "bg-sun text-ink" },
  staged: { label: "staged", className: "bg-mint text-ink" },
  deleted: { label: "deleted", className: "bg-[#FDE2E2] text-[#8A1C1C]" },
  conflict: { label: "conflict", className: "bg-[#B42318] text-white" },
  committed: { label: "commit করা", className: "bg-cloud text-slate ring-1 ring-slate/20" },
};

interface Row {
  readonly name: string;
  readonly content?: string;
  readonly badge?: Badge;
  readonly strike?: boolean;
}

function Column({ title, hint, rows, empty }: { title: string; hint: string; rows: Row[]; empty: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-white p-3 ring-1 ring-ink/10">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mb-2 text-xs text-slate">{hint}</p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate/30 px-2 py-3 text-center text-xs text-slate">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.name}
              title={r.content === undefined ? undefined : r.content === "" ? "(খালি ফাইল)" : r.content}
              className="flex items-center justify-between gap-2 rounded-lg bg-cloud px-2 py-1.5"
            >
              <span className={`truncate font-mono text-[13px] text-ink ${r.strike ? "line-through opacity-60" : ""}`}>
                {r.name}
              </span>
              {r.badge && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[r.badge].className}`}>
                  {BADGE[r.badge].label}
                </span>
              )}
            </li>
          ))}
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
  const workRows: Row[] = allPaths(workdir, index, unmerged)
    .filter((p) => p in workdir || (repo && p in index))
    .map((p): Row => {
      if (p in unmerged) return { name: p, content: workdir[p], badge: "conflict", strike: !(p in workdir) };
      if (!(p in workdir)) return { name: p, badge: "deleted", strike: true };
      if (!repo || !(p in index)) return { name: p, content: workdir[p], badge: "untracked" };
      if (workdir[p] !== index[p]) return { name: p, content: workdir[p], badge: "modified" };
      return { name: p, content: workdir[p] };
    });

  const stageRows: Row[] = allPaths(index, tree).map((p): Row => {
    if (p in unmerged) return { name: p, badge: "conflict" };
    if (!(p in index)) return { name: p, badge: "deleted", strike: true };
    if (index[p] !== tree[p]) return { name: p, content: index[p], badge: "staged" };
    return { name: p, content: index[p] };
  });

  const commitRows: Row[] = Object.keys(tree)
    .sort()
    .map((p) => ({ name: p, content: tree[p], badge: "committed" }));

  return (
    <section aria-label="ফাইলের অবস্থা" className="rounded-2xl bg-white/60 p-3 ring-1 ring-ink/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="font-semibold text-ink">ফাইলের অবস্থা</h2>
        <ul className="flex flex-wrap gap-1.5 text-[11px]" aria-label="রঙের মানে">
          {(repo?.merge ? (["untracked", "modified", "staged", "conflict"] as const) : (["untracked", "modified", "staged"] as const)).map((b) => (
            <li key={b} className={`rounded-full px-2 py-0.5 font-semibold ${BADGE[b].className}`}>
              {BADGE[b].label}
            </li>
          ))}
        </ul>
      </div>
      {repo?.merge && (
        <div role="status" className="mb-3 rounded-xl border border-[#B42318]/30 bg-[#FEF3F2] px-3 py-2 text-sm text-[#7A271A]">
          {Object.keys(unmerged).length ? (
            <>
              <strong>merge চলছে:</strong> {repo.merge.branch} আনতে গিয়ে{" "}
              {bn(Object.keys(unmerged).length)}টা ফাইলে conflict। ফাইল ঠিক করে <code className="font-mono">git add</code>, তারপর{" "}
              <code className="font-mono">git commit</code>। বাতিল: <code className="font-mono">git merge --abort</code>
            </>
          ) : (
            <>
              <strong>সব conflict মেটানো শেষ।</strong> merge শেষ করতে <code className="font-mono">git commit</code> দিন।
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Column title="Working Directory" hint="আপনার ফোল্ডারের ফাইল" rows={workRows} empty="ফোল্ডার খালি। লিখুন: touch index.html" />
        <Column
          title="Staging Area"
          hint="পরের commit-এ যা যাবে"
          rows={stageRows}
          empty={repo ? "কিছু নেই। git add দিয়ে এখানে আনুন" : "আগে git init দিন"}
        />
        <Column
          title="শেষ Commit"
          hint={head ? `HEAD → ${head.id}` : "সবশেষ সেভ করা অবস্থা"}
          rows={commitRows}
          empty={repo ? "এখনো কোনো commit নেই" : "আগে git init দিন"}
        />
      </div>
    </section>
  );
}
