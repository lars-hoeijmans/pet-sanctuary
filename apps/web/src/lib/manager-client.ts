import type { Approval, Pet, PetTraits, RollTraitsResult, Skill, Task } from "@pet-sanctuary/contracts";

/**
 * Minimal REST client for the Phase 2–6 manager endpoints. This exists so the
 * backend can be exercised end to end; the polished frontend is built separately.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_SANCTUARY_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function createTask(input: { title: string; description?: string; riskLevel?: "low" | "medium" | "high" }) {
  return post<{ task: Task }>("/tasks", input);
}

export function listTasks() {
  return get<{ tasks: Task[] }>("/tasks");
}

export function rollTraits(seed?: string) {
  return post<RollTraitsResult>("/pets/roll", seed ? { seed } : {});
}

export function createPet(input: { traits?: PetTraits; name?: string; seed?: string } = {}) {
  return post<{ pet: Pet }>("/pets", input);
}

export function listPets() {
  return get<{ pets: Pet[] }>("/pets");
}

export function archivePet(petId: string) {
  return post(`/pets/${encodeURIComponent(petId)}/archive`);
}

export function listSkills() {
  return get<{ skills: Skill[] }>("/skills");
}

export function listApprovals(status?: Approval["status"]) {
  return get<{ approvals: Approval[] }>(`/approvals${status ? `?status=${status}` : ""}`);
}

export function resolveApproval(id: string, decision: "approve" | "reject") {
  return post<{ approval: Approval }>(`/approvals/${encodeURIComponent(id)}/resolve`, { decision });
}
