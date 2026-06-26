"use client";

import { useCallback, useEffect, useState } from "react";
import type { Approval, Pet, Skill, Task } from "@pet-sanctuary/contracts";
import {
  archivePet,
  createPet,
  createTask,
  listApprovals,
  listPets,
  listSkills,
  listTasks,
  resolveApproval
} from "@/lib/manager-client";

/**
 * Deliberately bare manager console for exercising the backend (tasks, pet
 * creation, skills, approvals). The production UI is built separately.
 */
export function ManagerConsole() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [title, setTitle] = useState("Summarize the event log");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    try {
      const [t, p, s, a] = await Promise.all([listTasks(), listPets(), listSkills(), listApprovals()]);
      setTasks(t.tasks);
      setPets(p.pets);
      setSkills(s.skills);
      setApprovals(a.approvals);
      setError(undefined);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        await refresh();
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  return (
    <section style={styles.wrap}>
      <h2 style={styles.h2}>Manager Console (backend test surface)</h2>
      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.row}>
        <input
          style={styles.input}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Task title"
        />
        <button style={styles.btn} disabled={busy || !title.trim()} onClick={() => run(() => createTask({ title }))}>
          Create task
        </button>
        <button style={styles.btn} disabled={busy} onClick={() => run(() => createPet({}))}>
          Create random pet
        </button>
        <button style={styles.btn} disabled={busy} onClick={() => run(refresh)}>
          Refresh
        </button>
      </div>

      <div style={styles.grid}>
        <Panel title={`Pets (${pets.length})`}>
          {pets.map((pet) => (
            <div key={pet.id} style={styles.item}>
              <span>
                {pet.name} · karma {pet.karma} · {pet.status}
                {pet.archived ? " · archived" : ""}
              </span>
              {!pet.archived ? (
                <button style={styles.smallBtn} disabled={busy} onClick={() => run(() => archivePet(pet.id))}>
                  archive
                </button>
              ) : null}
            </div>
          ))}
        </Panel>

        <Panel title={`Tasks (${tasks.length})`}>
          {tasks.map((task) => (
            <div key={task.id} style={styles.item}>
              <span>
                {task.title} — <strong>{task.status}</strong>
                {task.assignedPetId ? ` (${task.assignedPetId})` : ""}
              </span>
            </div>
          ))}
        </Panel>

        <Panel title={`Skills (${skills.length})`}>
          {skills.map((skill) => (
            <div key={skill.id} style={styles.item}>
              <span>
                {skill.name} · {skill.source}/{skill.status}
              </span>
            </div>
          ))}
        </Panel>

        <Panel title={`Approvals (${approvals.length})`}>
          {approvals.length === 0 ? <div style={styles.item}>none</div> : null}
          {approvals.map((approval) => (
            <div key={approval.id} style={styles.item}>
              <span>
                {approval.summary} — {approval.status}
              </span>
              {approval.status === "pending" ? (
                <span>
                  <button style={styles.smallBtn} disabled={busy} onClick={() => run(() => resolveApproval(approval.id, "approve"))}>
                    approve
                  </button>
                  <button style={styles.smallBtn} disabled={busy} onClick={() => run(() => resolveApproval(approval.id, "reject"))}>
                    reject
                  </button>
                </span>
              ) : null}
            </div>
          ))}
        </Panel>
      </div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.panel}>
      <h3 style={styles.h3}>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: "16px", borderTop: "2px solid #1f2933", fontFamily: "system-ui, sans-serif", background: "#0b1015", color: "#e6edf3" },
  h2: { fontSize: "16px", margin: "0 0 12px" },
  h3: { fontSize: "13px", margin: "0 0 8px", color: "#8aa0b2" },
  row: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  panel: { background: "#11171d", border: "1px solid #1f2933", borderRadius: "8px", padding: "10px" },
  item: { display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "12px", padding: "3px 0", borderBottom: "1px solid #161d24" },
  input: { flex: "1 1 220px", padding: "6px 8px", borderRadius: "6px", border: "1px solid #2a3744", background: "#0b1015", color: "#e6edf3" },
  btn: { padding: "6px 12px", borderRadius: "6px", border: "1px solid #2a3744", background: "#1b66d6", color: "#fff", cursor: "pointer" },
  smallBtn: { padding: "2px 8px", marginLeft: "4px", borderRadius: "4px", border: "1px solid #2a3744", background: "#22303c", color: "#e6edf3", cursor: "pointer", fontSize: "11px" },
  error: { color: "#ff8080", fontSize: "12px" }
};
