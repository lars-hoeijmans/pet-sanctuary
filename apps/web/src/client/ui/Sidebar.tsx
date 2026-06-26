/**
 * Single left sidebar with tabs. Consolidates what used to be two side panels
 * (agents + tasks on the left, feed + artifacts on the right) into one tabbed
 * view, freeing up width for the game stage. Tab state is local UI state.
 */
import { useState } from "react";
import { Activity, Boxes, ListChecks, Package, type LucideIcon } from "lucide-react";
import { useWorldStore } from "../state/useWorldStore";
import { AgentPanel } from "./AgentPanel";
import { TaskBoard } from "./TaskBoard";
import { EventFeed } from "./EventFeed";
import { ArtifactDrawer } from "./ArtifactDrawer";

type TabId = "agents" | "tasks" | "feed" | "artifacts";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { id: "agents", label: "Agents", icon: Boxes },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "feed", label: "Feed", icon: Activity },
  { id: "artifacts", label: "Artifacts", icon: Package },
];

export function Sidebar() {
  const [active, setActive] = useState<TabId>("agents");

  const agentCount = useWorldStore((s) => Object.keys(s.snapshot.agents).length);
  const taskCount = useWorldStore((s) => s.snapshot.tasks.length);
  const artifactCount = useWorldStore((s) => s.snapshot.artifacts.length);

  const counts: Record<TabId, number | null> = {
    agents: agentCount,
    tasks: taskCount,
    feed: null,
    artifacts: artifactCount,
  };

  return (
    <aside className="sidebar" aria-label="Workspace panels">
      <div className="sidebar__tabs" role="tablist" aria-label="Panels">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = counts[id];
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active === id}
              className={`sidebar__tab ${active === id ? "is-active" : ""}`}
              onClick={() => setActive(id)}
            >
              <Icon size={15} aria-hidden="true" />
              <span className="sidebar__tab-label">{label}</span>
              {count !== null && count > 0 && <span className="sidebar__tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="sidebar__view" role="tabpanel">
        {active === "agents" && <AgentPanel />}
        {active === "tasks" && <TaskBoard />}
        {active === "feed" && <EventFeed />}
        {active === "artifacts" && <ArtifactDrawer />}
      </div>
    </aside>
  );
}
