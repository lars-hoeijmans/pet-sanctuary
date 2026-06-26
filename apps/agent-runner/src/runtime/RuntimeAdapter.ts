/**
 * RuntimeAdapter — the contract every agent runtime implements.
 *
 * The rest of Agent City must NOT know which runtime powers an agent. Today the
 * only fully-working runtime is MockRuntime. HermesRuntime and OpenClawRuntime
 * are compile-safe stubs that a colleague will flesh out — they receive the same
 * `worldClient` capabilities and mirror their actions into world events.
 *
 * NOTE: this `apps/` tree is intentionally excluded from the frontend build
 * (see tsconfig.json). It is reference scaffolding for the future backend +
 * real agents, not part of the shipped frontend.
 */
import type { AgentAvatar, AgentMessage, AgentTask } from "../../../../src/protocol/index";
import type { WorldClient } from "../worldClient";

export interface AgentRuntimeContext {
  agentId: string;
  name: string;
  role: string;
  avatar: AgentAvatar;
  color: string;
  workspaceDir: string;
  worldServerUrl: string;
  /** Pre-built client bound to this agent — call its methods to act in the world. */
  world: WorldClient;
}

export interface AgentRuntime {
  /** Boot the agent: register, heartbeat, then run its behavior loop. */
  start(ctx: AgentRuntimeContext): Promise<void>;
  /** Tear down timers / sessions. */
  stop(): Promise<void>;
  /** Optional: react to an inbound message addressed to this agent. */
  handleMessage?(message: AgentMessage): Promise<void>;
  /** Optional: react to a task offered/assigned to this agent. */
  handleTask?(task: AgentTask): Promise<void>;
}

export type RuntimeKind = "mock" | "hermes" | "openclaw";
