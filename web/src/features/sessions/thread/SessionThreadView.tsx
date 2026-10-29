/**
 * SessionThreadView - a session read as a LangSmith-style thread.
 *
 * Left: a Summary row, then one row per turn (trace). The active turn opens in
 * place into the trace's own tree; every other turn stays a single row.
 * Right: the standard observation detail panel for whatever is selected.
 *
 * Only the active turn's observations are fetched; the turn rows come from the
 * session's existing per-trace aggregates, so opening a session stays one query
 * plus one per turn the user actually opens.
 */

import { useCallback, useMemo, type ReactNode } from "react";
import { StringParam, useQueryParams } from "use-query-params";
import { ChevronDown, ListTree } from "@langfuse/icons";
import { TraceDetailBody } from "@/src/features/traces/components/TraceDetailBody";
import { TraceNavigationSlotProvider } from "@/src/features/traces/contexts/TraceNavigationSlotProvider";
import { useTraceDetailData } from "@/src/features/traces/hooks/useTraceDetailData";
import { type EventSessionTrace } from "@/src/features/sessions/sessionDetailPageTypes";
import { compactNumberFormatter, usdFormatter } from "@/src/utils/numbers";
import { formatIntervalSeconds } from "@/src/utils/dates";
import { cn } from "@/src/utils/tailwind";

type ThreadTurn = EventSessionTrace;

/** LangSmith's latency colours: green, then amber, then red. */
function latencyToneClassName(latencyMs: number | null | undefined) {
  if (latencyMs === null || latencyMs === undefined) return "text-muted-foreground";
  if (latencyMs < 4000) return "bg-light-green text-dark-green";
  if (latencyMs < 8000) return "bg-light-yellow text-dark-yellow";
  return "bg-light-red text-dark-red";
}

export function SessionThreadView({
  projectId,
  turns,
}: {
  projectId: string;
  turns: ThreadTurn[];
}) {
  const [query, setQuery] = useQueryParams({
    turn: StringParam,
    observation: StringParam,
  });
  const activeTurn =
    turns.find((turn) => turn.id === query.turn) ?? turns[turns.length - 1];

  const trace = useTraceDetailData({
    projectId,
    traceId: activeTurn?.id,
    timestamp: activeTurn?.timestamp,
    enabled: Boolean(activeTurn),
  });

  const selectTurn = useCallback(
    (turnId: string) =>
      // A selected observation belongs to the previous turn's tree.
      setQuery({ turn: turnId, observation: undefined }, "replaceIn"),
    [setQuery],
  );

  const wrapNavigation = useCallback(
    (navigation: ReactNode) => (
      <ThreadTurns
        turns={turns}
        activeTurnId={activeTurn?.id}
        onSelectTurn={selectTurn}
      >
        {navigation}
      </ThreadTurns>
    ),
    [turns, activeTurn?.id, selectTurn],
  );

  if (!activeTurn) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        This session has no turns yet.
      </div>
    );
  }

  return (
    <TraceNavigationSlotProvider wrap={wrapNavigation}>
      <TraceDetailBody
        trace={trace.data}
        context="peek"
        isPlaceholderData={trace.isPlaceholderData}
      />
    </TraceNavigationSlotProvider>
  );
}

function ThreadTurns({
  turns,
  activeTurnId,
  onSelectTurn,
  children,
}: {
  turns: ThreadTurn[];
  activeTurnId: string | undefined;
  onSelectTurn: (turnId: string) => void;
  children: ReactNode;
}) {
  const activeIndex = turns.findIndex((turn) => turn.id === activeTurnId);
  const before = turns.slice(0, Math.max(activeIndex, 0));
  const after = activeIndex >= 0 ? turns.slice(activeIndex + 1) : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ThreadSummary turns={turns} />
      {before.length > 0 && (
        <div className="max-h-[35%] shrink-0 overflow-y-auto">
          {before.map((turn, index) => (
            <TurnRow
              key={turn.id}
              turn={turn}
              number={index + 1}
              onSelect={onSelectTurn}
            />
          ))}
        </div>
      )}
      {activeIndex >= 0 && (
        <TurnRow
          turn={turns[activeIndex]}
          number={activeIndex + 1}
          isActive
          onSelect={onSelectTurn}
        />
      )}
      <div className="border-observation-chain-line/40 ml-4 min-h-0 flex-1 border-l">
        {children}
      </div>
      {after.length > 0 && (
        <div className="max-h-[35%] shrink-0 overflow-y-auto border-t">
          {after.map((turn, index) => (
            <TurnRow
              key={turn.id}
              turn={turn}
              number={activeIndex + index + 2}
              onSelect={onSelectTurn}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadSummary({ turns }: { turns: ThreadTurn[] }) {
  const totals = useMemo(
    () =>
      turns.reduce(
        (sum, turn) => ({
          tokens: sum.tokens + (turn.totalTokens ?? 0),
          cost: sum.cost + (turn.totalCost ?? 0),
          errors: sum.errors + (turn.errorCount ?? 0),
        }),
        { tokens: 0, cost: 0, errors: 0 },
      ),
    [turns],
  );
  return (
    <div className="shrink-0 border-b px-3 py-2">
      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="bg-observation-chain-fill inline-flex size-5 items-center justify-center rounded-sm">
          <ListTree size="sm" __rawClassName="text-white" />
        </span>
        Summary
      </div>
      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 pl-7 font-mono text-xs">
        <span title="Turns">{turns.length} turns</span>
        <span>/</span>
        <span title={`${totals.tokens} tokens`}>
          {compactNumberFormatter(totals.tokens)} tokens
        </span>
        <span>/</span>
        <span>{usdFormatter(totals.cost)}</span>
        {totals.errors > 0 && (
          <span className="bg-light-red text-dark-red rounded px-1">
            {totals.errors} error{totals.errors === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function TurnRow({
  turn,
  number,
  isActive = false,
  onSelect,
}: {
  turn: ThreadTurn;
  number: number;
  isActive?: boolean;
  onSelect: (turnId: string) => void;
}) {
  const hasErrors = (turn.errorCount ?? 0) > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(turn.id)}
      aria-expanded={isActive}
      className={cn(
        "hover:bg-muted/60 flex w-full shrink-0 flex-col gap-1 px-3 py-2 text-left",
        isActive && "bg-muted/40",
      )}
    >
      <div className="flex w-full items-center gap-2 text-sm">
        <span
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-sm font-mono text-xs text-white",
            hasErrors ? "bg-dark-red" : "bg-observation-chain-fill",
          )}
        >
          {number}
        </span>
        <span className="font-bold">Turn {number}</span>
        <span className="text-muted-foreground text-xs">
          {turn.timestamp.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <ChevronDown
          size="sm"
          __rawClassName={cn(
            "text-muted-foreground ml-auto transition-transform duration-150",
            isActive ? "rotate-0" : "-rotate-90",
          )}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-7 font-mono text-xs">
        {turn.latencyMs !== null && (
          <span
            className={cn(
              "rounded px-1",
              latencyToneClassName(turn.latencyMs),
            )}
          >
            {formatIntervalSeconds(turn.latencyMs / 1000)}
          </span>
        )}
        <span className="text-muted-foreground bg-muted rounded px-1">
          {compactNumberFormatter(turn.totalTokens ?? 0)} /{" "}
          {usdFormatter(turn.totalCost ?? 0)}
        </span>
        {hasErrors && (
          <span className="bg-light-red text-dark-red rounded px-1">
            {turn.errorCount} error{turn.errorCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </button>
  );
}
