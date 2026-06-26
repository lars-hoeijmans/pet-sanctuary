/** Left panel: task board grouped into Open / Claimed / Completed columns. */
import { useMemo } from "react";
import type { AgentTask, TaskStatus } from "../../protocol/index";
import { useWorldStore } from "../state/useWorldStore";

const COLUMNS: Array<{ status: TaskStatus; label: string }> = [
  { status: "open", label: "Open" },
  { status: "claimed", label: "Claimed" },
  { status: "completed", label: "Completed" },
];

export function TaskBoard() {
  const tasks = useWorldStore((s) => s.snapshot.tasks);
  const agents = useWorldStore((s) => s.snapshot.agents);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, AgentTask[]> = { open: [], claimed: [], completed: [], failed: [] };
    for (const task of tasks) map[task.status].push(task);
    return map;
  }, [tasks]);

  const nameOf = (id?: string): string | undefined => (id ? agents[id]?.name ?? id : undefined);

  return (
    <section className="section" aria-label="Task board">
      <header className="section__head">
        <h2 className="section__title">Tasks</h2>
        <span className="section__count">{tasks.length}</span>
      </header>

      {tasks.length === 0 ? (
        <p className="empty">No tasks yet. Play the demo or create one.</p>
      ) : (
        <div className="taskboard">
          {COLUMNS.map(({ status, label }) => (
            <div key={status} className={`taskcol taskcol--${status}`}>
              <div className="taskcol__head">
                {label} <span className="taskcol__count">{grouped[status].length}</span>
              </div>
              <ul className="taskcol__list">
                {grouped[status].map((task) => (
                  <li key={task.id} className="task-chip">
                    <span className="task-chip__title">{task.title}</span>
                    {nameOf(task.assignedAgentId) && (
                      <span className="task-chip__assignee">{nameOf(task.assignedAgentId)}</span>
                    )}
                  </li>
                ))}
                {grouped[status].length === 0 && <li className="taskcol__empty">—</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
