// @vitest-environment node
import { getSessionMessagePreviews } from "./session-previews";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@langfuse/shared/src/server", () => ({
  queryClickhouse: query,
  TupleParam: class {
    constructor(public values: unknown[]) {}
  },
}));

describe("session preview batch reads", () => {
  const input = {
    projectId: "owned-project",
    sessions: [
      {
        id: "session-a",
        environment: "test",
        createdAt: new Date("2026-11-01T00:00:00Z"),
      },
    ],
    fromTimestamp: new Date("2026-11-01T00:00:00Z"),
    toTimestamp: new Date("2026-11-02T00:00:00Z"),
    isV4: true,
  };
  beforeEach(() => query.mockReset());

  it.each([true, false])(
    "fetches bounded root candidates before I/O (events=%s)",
    async (isV4) => {
      query.mockResolvedValueOnce([{ id: "root-a" }]).mockResolvedValueOnce([
        {
          id: "session-a",
          environment: "test",
          input: JSON.stringify([{ role: "user", content: "Hello there" }]),
          output: JSON.stringify([
            { role: "assistant", content: "Welcome back" },
          ]),
        },
      ]);
      expect(await getSessionMessagePreviews({ ...input, isV4 })).toEqual([
        {
          id: "session-a",
          environment: "test",
          inputPreview: "Hello there",
          outputPreview: "Welcome back",
        },
      ]);
      expect(query).toHaveBeenCalledTimes(2);
      const candidates = query.mock.calls[0][0];
      const io = query.mock.calls[1][0];
      expect(candidates.query).not.toMatch(
        /SELECT[^;]*(substringUTF8| AS input)/,
      );
      expect(candidates.query).toContain(isV4 ? "events_core" : "FROM traces");
      expect(candidates.query).toContain("LIMIT 1 BY session_id, environment");
      for (const read of [candidates, io]) {
        expect(read.query).toContain("project_id = {projectId: String}");
        expect(read.query).toMatch(
          /\((p\.)?session_id, (p\.)?environment\) IN/,
        );
        expect(read.query).toContain(
          "fromUnixTimestamp64Milli({fromTimestamp: Int64})",
        );
        expect(read.query).toContain(
          "fromUnixTimestamp64Milli({toTimestamp: Int64})",
        );
        expect(read.params).toMatchObject({
          projectId: "owned-project",
          limit: 1,
        });
      }
      expect(io.params.candidateIds).toEqual(["root-a"]);
      expect(io.params.ioLimit).toBe(32_000);
      expect(io.query).toContain("substringUTF8(p.input");
      expect(io.query).toContain(isV4 ? "p.span_id IN" : "p.id IN");
      if (isV4) expect(candidates.query).toContain("type != 'TOOL'");
    },
  );

  it("does not fetch I/O when no roots were captured", async () => {
    query.mockResolvedValueOnce([]);
    expect(await getSessionMessagePreviews(input)).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("does not query when the page is empty", async () => {
    expect(await getSessionMessagePreviews({ ...input, sessions: [] })).toEqual(
      [],
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("labels oversized I/O honestly instead of reporting it uncaptured", async () => {
    query.mockResolvedValueOnce([{ id: "root-a" }]).mockResolvedValueOnce([
      {
        id: "session-a",
        environment: "test",
        input: '["' + "x".repeat(31_998),
        output: "",
      },
    ]);
    expect((await getSessionMessagePreviews(input))[0]).toMatchObject({
      inputPreview: "Open session to read long input",
      outputPreview: null,
    });
  });
});
