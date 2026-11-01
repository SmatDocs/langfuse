const PREVIEW_LENGTH = 400;
export const SESSION_PREVIEW_IO_LIMIT = 32_000;

/** Extract visible conversation text, excluding system messages and media. */
export function sessionMessagePreview(
  raw: string | null | undefined,
  role: "user" | "assistant",
): string | undefined {
  if (!raw || raw.length > SESSION_PREVIEW_IO_LIMIT) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    // A cut JSON payload must not expose serialized prompts as visible text.
    if (/^[\s]*[\[{\"]/.test(raw)) return undefined;
    value = raw;
  }

  const text = messageText(value, role, 0);
  if (!text) return undefined;
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > PREVIEW_LENGTH
    ? `${normalized.slice(0, PREVIEW_LENGTH)}…`
    : normalized || undefined;
}

function messageText(
  value: unknown,
  role: "user" | "assistant",
  depth: number,
): string | undefined {
  if (depth > 4) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const messages = value
      .slice(-64)
      .filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && !Array.isArray(item),
      );
    const matching = messages.filter((item) =>
      [role, role === "user" ? "human" : "ai"].includes(
        String(item.role ?? item.type),
      ),
    );
    if (matching.length) {
      return messageText(matching.at(-1)?.content, role, depth + 1);
    }
    // Content blocks contain text, while images and tool calls are omitted.
    const blocks = messages.filter(
      (item) =>
        !item.role &&
        ["text", "input_text", "output_text"].includes(String(item.type)),
    );
    return (
      blocks
        .map((item) => item.text)
        .filter((text) => typeof text === "string")
        .join(" ") || undefined
    );
  }
  if (!value || typeof value !== "object") return undefined;
  const object = value as Record<string, unknown>;
  const messageRole = object.role ?? object.type;
  if (
    typeof messageRole === "string" &&
    [
      "user",
      "human",
      "assistant",
      "ai",
      "system",
      "developer",
      "tool",
      "function",
    ].includes(messageRole) &&
    ![role, role === "user" ? "human" : "ai"].includes(messageRole)
  )
    return undefined;
  for (const key of [
    "messages",
    "content",
    ...(role === "user" ? ["query", "request"] : ["response", "answer"]),
  ]) {
    if (object[key] !== undefined) {
      const text = messageText(object[key], role, depth + 1);
      if (text) return text;
    }
  }
  return undefined;
}
