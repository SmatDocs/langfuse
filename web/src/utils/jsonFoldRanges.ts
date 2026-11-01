export type JsonFoldRange = { end: number; label: string };

/** Index structural lines of already validated/formatted JSON, never its values. */
export function jsonFoldRanges(
  text: string,
): Map<number, JsonFoldRange> | null {
  if (text.length > 100_000) return null;
  const lines = text.split("\n");
  if (lines.length > 2_000) return null;
  const ranges = new Map<number, JsonFoldRange>();
  const stack: { start: number; label: string }[] = [];

  for (const [index, line] of lines.entries()) {
    // Removing quoted tokens keeps braces/escaped quotes inside strings inert.
    const structure = line.replace(/"(?:\\.|[^"\\])*"/g, "");
    if (/^\s*[}\]]/.test(structure)) {
      const open = stack.pop();
      if (open) ranges.set(open.start, { end: index, label: open.label });
    }
    if (/[{\[]\s*$/.test(structure)) {
      const key = /^\s*("(?:\\.|[^"\\])*")\s*:/.exec(line);
      const kind = structure.trimEnd().endsWith("[") ? "array" : "object";
      let label = index === 0 ? "root" : `${kind} at line ${index + 1}`;
      if (key) label = String(JSON.parse(key[1]));
      stack.push({ start: index, label });
      if (ranges.size + stack.length > 500) return null;
    }
  }
  return ranges;
}
