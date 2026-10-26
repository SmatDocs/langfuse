import { StringParam, useQueryParam } from "use-query-params";
import Page from "@/src/components/layouts/Page";
import { Button } from "@/src/components/ui/button";
import { Spinner } from "@/src/components/design-system/Spinner/Spinner";
import { headerActionClassName } from "@/src/features/traces/components/headerActionClassName";
import { type EventSessionTrace } from "@/src/features/sessions/sessionDetailPageTypes";
import { SessionThreadView } from "./SessionThreadView";

/** The default session page: the thread view, with the conversation feed one click away. */
export function SessionThreadPage({
  projectId,
  sessionId,
  turns,
}: {
  projectId: string;
  sessionId: string;
  turns: EventSessionTrace[] | undefined;
}) {
  const [, setView] = useQueryParam("view", StringParam);
  return (
    <Page
      headerProps={{
        title: sessionId,
        itemType: "SESSION",
        divider: false,
        breadcrumb: [
          { name: "Sessions", href: `/project/${projectId}/sessions` },
        ],
        actionButtonsRight: (
          <Button
            variant="ghost"
            size="sm"
            className={headerActionClassName}
            onClick={() => setView("feed", "replaceIn")}
          >
            Conversation view
          </Button>
        ),
      }}
    >
      <div className="h-full min-h-0">
        {turns ? (
          <SessionThreadView projectId={projectId} turns={turns} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Spinner size="xl" variant="muted" />
          </div>
        )}
      </div>
    </Page>
  );
}
