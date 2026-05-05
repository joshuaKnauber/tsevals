import { useEffect, useState } from "react";
import type { RunArtifact } from "../../../src/core/types.js";
import { isVersion } from "../lib.js";

export function NoteEditor({
  run,
  onChange,
  placeholder = "+ note to mark as version",
  className = "",
}: {
  run: RunArtifact;
  onChange: () => void;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(run.note ?? "");
  const [saving, setSaving] = useState(false);
  const tagged = isVersion(run);

  useEffect(() => {
    setValue(run.note ?? "");
  }, [run.note]);

  const persist = async (next: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(run.runId)}/note`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: next }),
      });
      if (!res.ok) throw new Error("failed");
      onChange();
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="text"
      className={`bg-transparent border-0 font-sans text-[12.5px] px-2 py-1 rounded outline-none flex-1 min-w-0 transition-colors duration-75 hover:bg-elevated focus:bg-elevated placeholder:text-faint placeholder:italic ${
        tagged ? "text-fg" : "text-muted italic focus:text-fg"
      } ${className}`}
      placeholder={placeholder}
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => {
        if (value !== (run.note ?? "")) persist(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setValue(run.note ?? "");
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
