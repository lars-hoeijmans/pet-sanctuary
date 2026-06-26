/**
 * Zustand store — the single owner of world state on the client.
 *
 * Flow on each event:
 *   1. apply the pure reducer to the local snapshot
 *   2. push the event to recentEvents (for the feed)
 *   3. forward the event to the Phaser scene via worldBus (for animation)
 *
 * The store never lets Phaser own the truth, and the UI never mutates world
 * state directly — it calls command methods that delegate to the WorldSource.
 */
import { create } from "zustand";
import {
  applyWorldEvent,
  createEmptyWorld,
  type WorldEvent,
  type WorldSnapshot,
} from "../../protocol/index";
import { createWorldSource } from "../world/createWorldSource";
import type { ConnectionStatus, WorldSource } from "../world/WorldSource";
import { worldBus } from "../game/eventBus";
import { audioManager } from "../audio/AudioManager";

const MAX_RECENT_EVENTS = 120;

interface WorldStoreState {
  // world
  snapshot: WorldSnapshot;
  recentEvents: WorldEvent[];
  connectionStatus: ConnectionStatus;
  isDemoPlaying: boolean;
  sourceKind: WorldSource["kind"] | null;

  // ui / selection
  selectedAgentId: string | null;
  followAgentId: string | null;
  feedFilterAgentId: string | null;
  commandPaletteOpen: boolean;
  muted: boolean;

  // lifecycle
  init: () => void;
  teardown: () => void;

  // selection actions
  selectAgent: (id: string | null) => void;
  toggleFollow: (id: string) => void;
  setFeedFilter: (id: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleMuted: () => void;

  // command surface (delegates to the source)
  playDemo: () => void;
  stopDemo: () => void;
  reset: () => void;
  createTask: (title: string, description: string) => void;
  spawnTestAgent: () => void;
  sendRandomMessage: () => void;
  buildRandomObject: () => void;
  emit: (event: WorldEvent) => void;
}

// The source lives outside React state — it is imperative infrastructure.
let source: WorldSource | null = null;

export const useWorldStore = create<WorldStoreState>((set, get) => ({
  snapshot: createEmptyWorld(),
  recentEvents: [],
  connectionStatus: "connecting",
  isDemoPlaying: false,
  sourceKind: null,

  selectedAgentId: null,
  followAgentId: null,
  feedFilterAgentId: null,
  commandPaletteOpen: false,
  muted: false,

  init: () => {
    if (source) return; // guard against React 18 StrictMode double-invoke
    source = createWorldSource();
    set({ sourceKind: source.kind });

    source.connect({
      onSnapshot: (snapshot) => {
        worldBus.emit("world:snapshot", snapshot);
        set({ snapshot });
      },
      onEvent: (event) => {
        set((state) => ({
          snapshot: applyWorldEvent(state.snapshot, event),
          recentEvents: [event, ...state.recentEvents].slice(0, MAX_RECENT_EVENTS),
        }));
        worldBus.emit("world:event", event);
      },
      onStatus: (connectionStatus) => set({ connectionStatus }),
      onDemoStateChange: (isDemoPlaying) => set({ isDemoPlaying }),
    });
  },

  teardown: () => {
    source?.disconnect();
    source = null;
    set({ sourceKind: null, connectionStatus: "offline" });
  },

  selectAgent: (id) => set({ selectedAgentId: id }),
  toggleFollow: (id) =>
    set((state) => ({ followAgentId: state.followAgentId === id ? null : id })),
  setFeedFilter: (id) => set({ feedFilterAgentId: id }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleMuted: () =>
    set((state) => {
      const muted = !state.muted;
      audioManager.setMuted(muted);
      return { muted };
    }),

  playDemo: () => source?.playDemo(),
  stopDemo: () => source?.stopDemo(),
  reset: () => {
    get().selectAgent(null);
    source?.reset();
  },
  createTask: (title, description) => source?.createTask(title, description),
  spawnTestAgent: () => source?.spawnTestAgent(),
  sendRandomMessage: () => source?.sendRandomMessage(),
  buildRandomObject: () => source?.buildRandomObject(),
  emit: (event) => source?.emit(event),
}));
