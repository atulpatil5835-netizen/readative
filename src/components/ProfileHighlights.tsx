import { useMemo } from "react";
import { useHighlights, UserHighlight } from "../context/HighlightsContext";
import { navigateToRoute } from "../utils/routes";

export function ProfileHighlights() {
  const { highlights, removeHighlight } = useHighlights();

  const grouped = useMemo(() => {
    const groups: Record<string, {
      postId: string;
      postTitle: string;
      authorName: string;
      items: UserHighlight[];
    }> = {};

    highlights.forEach((hl) => {
      if (!groups[hl.postId]) {
        groups[hl.postId] = {
          postId: hl.postId,
          postTitle: hl.postTitle || "Untitled Post",
          authorName: hl.authorName || "Unknown Author",
          items: [],
        };
      }
      groups[hl.postId].items.push(hl);
    });

    return Object.values(groups);
  }, [highlights]);

  if (highlights.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
        No highlights yet. Start highlighting important knowledge in posts!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div
          key={group.postId}
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
        >
          <div className="mb-3 border-b border-slate-100 pb-2 flex justify-between items-start gap-4">
            <div>
              <a
                href={`/post/${group.postId}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToRoute("knowledge", { focusedEntryId: group.postId });
                }}
                className="font-black text-slate-900 hover:text-emerald-700 transition-colors text-base sm:text-lg"
              >
                {group.postTitle}
              </a>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                by @{group.authorName}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {group.items.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-xl bg-slate-50 px-4 py-3 border border-slate-100"
              >
                <p className="text-sm leading-6 text-slate-700 font-serif italic border-l-2 border-amber-300 pl-3">
                  "{item.selectedText}"
                </p>
                <div className="mt-2 flex justify-between items-center text-[10px] text-slate-400">
                  <span>
                    Highlighted on {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => {
                      if (window.confirm("Remove this highlight?")) {
                        void removeHighlight(item.id);
                      }
                    }}
                    className="text-rose-600 hover:text-rose-800 font-bold transition-colors opacity-80 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
