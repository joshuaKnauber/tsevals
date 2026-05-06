import { meanOfEntries, type EvalSummary } from "../lib.js";
import { navigate } from "../router.js";

export function Sidebar({
  evals,
  selectedEval,
}: {
  evals: EvalSummary[];
  selectedEval: string | null;
}) {
  return (
    <aside className="w-[280px] bg-elevated overflow-y-auto py-5 px-2">
      <div className="px-3.5 pb-4">
        <span className="text-[13px] font-medium text-fg tracking-tight">
          tsevals
        </span>
      </div>
      <ul className="list-none m-0 p-0 flex flex-col gap-px">
        {evals.map((e) => (
          <li
            key={e.name}
            className={`px-3.5 py-2.5 rounded-md cursor-pointer transition-colors duration-75 ${
              e.name === selectedEval ? "bg-selected" : "hover:bg-hover"
            }`}
            onClick={() => navigate({ kind: "overview", evalName: e.name })}
          >
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[13px] font-normal tracking-tight">
                {e.name}
              </span>
              <span className="font-mono text-[11.5px] font-medium tabular-nums text-muted">
                {e.entries.length ? meanOfEntries(e.entries).toFixed(2) : "—"}
              </span>
            </div>
            <div className="font-mono text-[11px] text-muted mt-0.5 tabular-nums tracking-tight">
              {e.entries.length} run{e.entries.length === 1 ? "" : "s"} ·{" "}
              {e.versionCount} version{e.versionCount === 1 ? "" : "s"}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
