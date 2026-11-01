import { Children, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "@langfuse/icons";
import { IconButton } from "@/src/components/design-system/IconButton/IconButton";
import { type JsonFoldRange } from "@/src/utils/jsonFoldRanges";

/** Keep the existing highlighted source tokens; folding only hides line ranges. */
export function JsonCodeLines({
  content,
  text,
  ranges,
  collapsed,
  onToggle,
}: {
  content: ReactNode;
  text: string;
  ranges: ReadonlyMap<number, JsonFoldRange>;
  collapsed: ReadonlySet<number>;
  onToggle: (line: number) => void;
}) {
  const sourceLines = text.split("\n");
  const lines = Children.toArray(content);
  const visible: ReactNode[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = index;
    const range = ranges.get(line);
    const folded = range !== undefined && collapsed.has(line);
    visible.push(
      <div key={line} className="flex items-start">
        <span className="inline-flex w-5 shrink-0 select-none">
          {range ? (
            <IconButton
              icon={folded ? ChevronRight : ChevronDown}
              label={`${folded ? "Expand" : "Collapse"} JSON section ${range.label}`}
              aria-expanded={!folded}
              size="xs"
              onClick={() => onToggle(line)}
            />
          ) : null}
        </span>
        <span className="min-w-0">{lines[line]}</span>
        {folded ? (
          <span className="text-muted-foreground">
            {` … ${sourceLines[range.end].trimStart()}`}
          </span>
        ) : null}
      </div>,
    );
    if (folded) index = range.end;
  }
  return visible;
}
