import { createContext, useContext, type ReactNode } from "react";

/** Wraps the trace tree, e.g. a session thread listing its turns around it. */
type WrapNavigation = (navigation: ReactNode) => ReactNode;

const TraceNavigationSlotContext = createContext<WrapNavigation | null>(null);

export function TraceNavigationSlotProvider({
  wrap,
  children,
}: {
  wrap: WrapNavigation;
  children: ReactNode;
}) {
  return (
    <TraceNavigationSlotContext.Provider value={wrap}>
      {children}
    </TraceNavigationSlotContext.Provider>
  );
}

export function useTraceNavigationSlot() {
  return useContext(TraceNavigationSlotContext);
}
