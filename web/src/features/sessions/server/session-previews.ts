import { queryClickhouse, TupleParam } from "@langfuse/shared/src/server";
import {
  sessionMessagePreview,
  SESSION_PREVIEW_IO_LIMIT,
} from "../session-message-preview";

export type SessionPreviewRow = {
  id: string;
  environment: string;
  createdAt: Date;
};

/** Read one latest root per visible session, never child prompts or tool I/O. */
export async function getSessionMessagePreviews(input: {
  projectId: string;
  sessions: SessionPreviewRow[];
  isV4: boolean;
  fromTimestamp: Date | null;
  toTimestamp: Date | null;
}) {
  if (input.sessions.length === 0) return [];
  const events = input.isV4;
  const params = {
    projectId: input.projectId,
    sessions: input.sessions.map(
      (session) => new TupleParam([session.id, session.environment]),
    ),
    fromTimestamp:
      input.fromTimestamp?.getTime() ??
      Math.min(...input.sessions.map((session) => session.createdAt.getTime())),
    toTimestamp: input.toTimestamp?.getTime() ?? Date.now(),
    ioLimit: SESSION_PREVIEW_IO_LIMIT,
    limit: input.sessions.length,
  };
  const candidates = await queryClickhouse<{ id: string }>({
    query: `
      SELECT ${events ? "span_id" : "id"} AS id
      FROM ${events ? "events_core" : "traces"}
      WHERE project_id = {projectId: String}
        AND (session_id, environment) IN {sessions: Array(Tuple(String, String))}
        AND ${events ? "start_time" : "timestamp"} >= fromUnixTimestamp64Milli({fromTimestamp: Int64})
        AND ${events ? "start_time" : "timestamp"} <= fromUnixTimestamp64Milli({toTimestamp: Int64})
        ${events ? "AND is_deleted = 0 AND type != 'TOOL' AND (parent_span_id = '' OR is_app_root = 1)" : ""}
      ORDER BY ${events ? "start_time DESC, event_ts DESC" : "timestamp DESC, updated_at DESC"}
      LIMIT 1 BY session_id, environment
      LIMIT {limit: UInt32}
    `,
    params,
    tags: { projectId: input.projectId },
    preferredClickhouseService: events ? "EventsReadOnly" : undefined,
    clickhouseSettings: {
      max_execution_time: 10,
      max_rows_to_read: "1000000",
      max_memory_usage: "268435456",
    },
  });
  if (!candidates.length) return [];
  const rows = await queryClickhouse<{
    id: string;
    environment: string;
    input: string;
    output: string;
  }>({
    query: `
      SELECT p.session_id AS id, p.environment AS environment,
        substringUTF8(p.input, 1, {ioLimit: UInt32}) AS input,
        substringUTF8(p.output, 1, {ioLimit: UInt32}) AS output
      FROM ${events ? "events_full" : "traces"} AS p
      WHERE p.project_id = {projectId: String}
        AND (p.session_id, p.environment) IN {sessions: Array(Tuple(String, String))}
        AND p.${events ? "span_id" : "id"} IN {candidateIds: Array(String)}
        AND ${events ? "start_time" : "timestamp"} >= fromUnixTimestamp64Milli({fromTimestamp: Int64})
        AND ${events ? "start_time" : "timestamp"} <= fromUnixTimestamp64Milli({toTimestamp: Int64})
        ${events ? "AND is_deleted = 0" : ""}
      ORDER BY ${events ? "start_time DESC, event_ts DESC" : "timestamp DESC, updated_at DESC"}
      LIMIT 1 BY session_id, environment
      LIMIT {limit: UInt32}
    `,
    params: {
      ...params,
      candidateIds: candidates.map((candidate) => candidate.id),
    },
    tags: { projectId: input.projectId },
    preferredClickhouseService: events ? "EventsReadOnly" : undefined,
    clickhouseSettings: {
      max_execution_time: 10,
      max_rows_to_read: "1000000",
      max_memory_usage: "268435456",
      max_result_bytes: "8000000",
    },
  });
  return rows.map((row) => ({
    id: row.id,
    environment: row.environment,
    inputPreview:
      sessionMessagePreview(row.input, "user") ??
      (row.input?.length >= SESSION_PREVIEW_IO_LIMIT
        ? "Open session to read long input"
        : null),
    outputPreview:
      sessionMessagePreview(row.output, "assistant") ??
      (row.output?.length >= SESSION_PREVIEW_IO_LIMIT
        ? "Open session to read long output"
        : null),
  }));
}
