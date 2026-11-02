// @vitest-environment node
import { sessionMessagePreview } from "./session-message-preview";

describe("session message previews", () => {
  it("selects the latest human message and assistant answer without system prompts", () => {
    const messages = JSON.stringify([
      { role: "system", content: "Private system instruction" },
      { role: "user", content: "Old question" },
      { role: "assistant", content: "Old answer" },
      { role: "user", content: "Hello there" },
      { role: "assistant", content: "Hello, how can I help?" },
    ]);
    expect(sessionMessagePreview(messages, "user")).toBe("Hello there");
    expect(sessionMessagePreview(messages, "assistant")).toBe(
      "Hello, how can I help?",
    );
  });

  it("handles root strings and text blocks without rendering media", () => {
    expect(sessionMessagePreview(JSON.stringify("Hello\nthere"), "user")).toBe(
      "Hello there",
    );
    expect(
      sessionMessagePreview(
        JSON.stringify([
          {
            role: "user",
            content: [
              { type: "text", text: "Show products" },
              { type: "image_url", image_url: "private-media" },
            ],
          },
        ]),
        "user",
      ),
    ).toBe("Show products");
  });

  it("never substitutes system messages, tool arguments, or malformed JSON", () => {
    for (const value of [
      [{ role: "system", content: "Secret instruction" }],
      [{ role: "tool", content: "Secret tool result" }],
      [{ role: "system", type: "text", text: "Secret instruction" }],
      { type: "system", content: "Secret instruction" },
      { role: "tool", content: "Secret tool result" },
      { arguments: { password: "secret" } },
      null,
    ]) {
      expect(
        sessionMessagePreview(JSON.stringify(value), "user"),
      ).toBeUndefined();
    }
    expect(
      sessionMessagePreview('[{"role":"system","content":"cut', "user"),
    ).toBeUndefined();
  });

  it("bounds work and truncates long visible text", () => {
    expect(
      sessionMessagePreview(JSON.stringify("x".repeat(1000)), "user"),
    ).toBe(`${"x".repeat(400)}…`);
    expect(sessionMessagePreview("x".repeat(32_001), "user")).toBeUndefined();
  });
});
