"use client";

import {
  Activity,
  CircleAlert,
  Megaphone,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Wifi,
  WifiOff
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useReducer, useState } from "react";
import type { Pet, RoomObject, WorldEvent } from "@/lib/contracts";
import {
  connectRoomSocket,
  fetchRoomSnapshot,
  resetRoomToSeed,
  setSimulationPaused,
  triggerMeaningfulRoomEvent
} from "@/lib/sanctuary-client";
import { SEED_SNAPSHOT } from "@/lib/seed";
import { createInitialState, sanctuaryReducer } from "@/lib/state";

export function LivingRoomKernel() {
  const [state, dispatch] = useReducer(sanctuaryReducer, SEED_SNAPSHOT, createInitialState);
  const [triggeringEvent, setTriggeringEvent] = useState(false);

  const selectedPet = useMemo(
    () => state.snapshot.pets.find((pet) => pet.id === state.selectedPetId) ?? state.snapshot.pets[0],
    [state.selectedPetId, state.snapshot.pets]
  );

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "load_start" });

    fetchRoomSnapshot()
      .then((snapshot) => {
        if (!cancelled) {
          dispatch({ type: "load_success", snapshot, source: "api" });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          dispatch({
            type: "load_error",
            message: `${error.message}. Showing deterministic seed fallback.`
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    dispatch({ type: "socket_status", status: "connecting" });

    const socket = connectRoomSocket({
      onConnect: () => dispatch({ type: "socket_status", status: "connected" }),
      onDisconnect: () => dispatch({ type: "socket_status", status: "disconnected" }),
      onError: (message) => dispatch({ type: "socket_status", status: "error", message }),
      onSnapshot: (snapshot) => dispatch({ type: "apply_snapshot", snapshot, source: "socket" }),
      onEvent: (event) => dispatch({ type: "apply_event", event })
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (state.source !== "seed-fallback") {
      return;
    }

    const timer = window.setInterval(() => {
      dispatch({ type: "local_tick", createdAt: new Date().toISOString() });
    }, 6000);

    return () => {
      window.clearInterval(timer);
    };
  }, [state.source]);

  async function handlePauseToggle() {
    const paused = !state.snapshot.paused;
    const createdAt = new Date().toISOString();
    dispatch({ type: "set_paused", paused, createdAt });

    try {
      const snapshot = await setSimulationPaused(paused);
      if (snapshot) {
        dispatch({ type: "apply_snapshot", snapshot, source: "api" });
      }
    } catch (error) {
      dispatch({
        type: "socket_status",
        status: state.socket,
        message: `${readErrorMessage(error)}. Local control applied.`
      });
    }
  }

  async function handleReset() {
    dispatch({ type: "reset_seed" });

    try {
      const snapshot = await resetRoomToSeed();
      dispatch({ type: "apply_snapshot", snapshot, source: "api" });
    } catch (error) {
      dispatch({
        type: "socket_status",
        status: state.socket,
        message: `${readErrorMessage(error)}. Seed fallback restored.`
      });
    }
  }

  async function handleTriggerRoomEvent() {
    setTriggeringEvent(true);

    try {
      const snapshot = await triggerMeaningfulRoomEvent();
      dispatch({ type: "apply_snapshot", snapshot, source: "api" });
    } catch (error) {
      dispatch({
        type: "socket_status",
        status: state.socket,
        message: readErrorMessage(error)
      });
    } finally {
      setTriggeringEvent(false);
    }
  }

  return (
    <main className="kernel-shell">
      <header className="kernel-topbar">
        <div className="title-lockup">
          <span className="app-mark" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <div>
            <h1>{state.snapshot.roomName}</h1>
            <p>{state.snapshot.roomId}</p>
          </div>
        </div>

        <div className="topbar-actions" aria-label="Simulation controls">
          <StatusPill state={state.socket} source={state.source} />
          <button
            className="control-button"
            type="button"
            onClick={handleTriggerRoomEvent}
            disabled={triggeringEvent}
            title="Trigger a meaningful room event"
          >
            <Megaphone size={17} />
            <span>{triggeringEvent ? "Triggering" : "Trigger Event"}</span>
          </button>
          <button
            className="control-button"
            type="button"
            onClick={handlePauseToggle}
            title={state.snapshot.paused ? "Resume simulation" : "Pause simulation"}
          >
            {state.snapshot.paused ? <Play size={17} /> : <Pause size={17} />}
            <span>{state.snapshot.paused ? "Resume" : "Pause"}</span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={handleReset}
            title="Reset room to seed"
            aria-label="Reset room to seed"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      {state.error ? (
        <div className="status-banner" role="status">
          <CircleAlert size={16} />
          <span>{state.error}</span>
        </div>
      ) : null}
      {state.loading && !state.error ? (
        <div className="status-banner is-loading" role="status">
          <span className="loading-dot" aria-hidden="true" />
          <span>Loading sanctuary snapshot.</span>
        </div>
      ) : null}

      <section className="kernel-grid" aria-label="Living room kernel">
        <div className="room-stage-panel">
          <div className="room-toolbar">
            <div>
              <span className="metric-label">Pets</span>
              <strong>{state.snapshot.pets.length}</strong>
            </div>
            <div>
              <span className="metric-label">Events</span>
              <strong>{state.snapshot.events.length}</strong>
            </div>
            <div>
              <span className="metric-label">Updated</span>
              <strong>{formatTime(state.snapshot.updatedAt)}</strong>
            </div>
          </div>

          <RoomGrid
            gridWidth={state.snapshot.grid.width}
            gridHeight={state.snapshot.grid.height}
            objects={state.snapshot.objects}
            pets={state.snapshot.pets}
            selectedPetId={state.selectedPetId}
            onSelectPet={(petId) => dispatch({ type: "select_pet", petId })}
          />
        </div>

        <aside className="side-panel inspector-panel" aria-label="Pet inspector">
          {selectedPet ? <PetInspector pet={selectedPet} /> : <EmptyPanel label="No pet selected" />}
        </aside>

        <aside className="side-panel event-panel" aria-label="World event feed">
          <div className="panel-heading">
            <Activity size={18} />
            <h2>World Events</h2>
          </div>
          <EventFeed events={state.snapshot.events} pets={state.snapshot.pets} />
        </aside>
      </section>
    </main>
  );
}

function StatusPill({
  state,
  source
}: {
  state: "idle" | "connecting" | "connected" | "disconnected" | "error";
  source: "api" | "socket" | "seed-fallback";
}) {
  const connected = state === "connected";
  const label = source === "seed-fallback" ? "Seed fallback" : connected ? "Live socket" : state;

  return (
    <span className={`status-pill ${connected ? "is-live" : ""}`}>
      {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
      {label}
    </span>
  );
}

function RoomGrid({
  gridWidth,
  gridHeight,
  objects,
  pets,
  selectedPetId,
  onSelectPet
}: {
  gridWidth: number;
  gridHeight: number;
  objects: RoomObject[];
  pets: Pet[];
  selectedPetId: string;
  onSelectPet: (petId: string) => void;
}) {
  return (
    <div
      className="room-grid"
      style={
        {
          "--grid-width": gridWidth,
          "--grid-height": gridHeight
        } as CSSProperties
      }
    >
      {objects.map((object) => (
        <RoomObjectMarker
          key={object.id}
          object={object}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
        />
      ))}

      {pets.map((pet) => (
        <button
          className={`pet-token ${pet.id === selectedPetId ? "is-selected" : ""}`}
          key={pet.id}
          type="button"
          onClick={() => onSelectPet(pet.id)}
          title={`Inspect ${pet.name}`}
          style={markerStyle(pet.position.x, pet.position.y, gridWidth, gridHeight, pet.accent)}
        >
          {pet.currentSpeech ? <span className="speech-bubble">{pet.currentSpeech.message}</span> : null}
          <span className="pet-avatar" aria-hidden="true">
            {pet.avatar}
          </span>
          <span className="pet-name">{pet.name}</span>
        </button>
      ))}
    </div>
  );
}

function RoomObjectMarker({
  object,
  gridWidth,
  gridHeight
}: {
  object: RoomObject;
  gridWidth: number;
  gridHeight: number;
}) {
  return (
    <div
      className={`room-object room-object-${object.kind}`}
      style={objectStyle(object, gridWidth, gridHeight)}
      title={`${object.label}: ${object.state ?? "ready"}`}
    >
      <span>{object.label}</span>
    </div>
  );
}

function PetInspector({ pet }: { pet: Pet }) {
  return (
    <>
      <div className="inspector-hero">
        <div className="inspector-avatar" style={{ "--accent": pet.accent } as CSSProperties}>
          {pet.avatar}
        </div>
        <div>
          <h2>{pet.name}</h2>
          <p>{pet.tagline}</p>
        </div>
      </div>

      <div className="stat-row">
        <span>Status</span>
        <strong>{labelize(pet.status)}</strong>
      </div>
      <div className="stat-row">
        <span>Response</span>
        <strong>{labelize(pet.responseLevel)}</strong>
      </div>
      <div className="stat-row">
        <span>Karma</span>
        <strong className="tabular">{pet.karma}</strong>
      </div>

      <section className="panel-section">
        <h3>Traits</h3>
        <div className="chip-list">
          {pet.traits.map((trait) => (
            <span className="chip" key={trait}>
              {trait}
            </span>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3>Profile</h3>
        <p>{pet.personalitySummary}</p>
        <p className="muted">{pet.speakingStyle}</p>
      </section>

      <section className="panel-section">
        <h3>Permissions</h3>
        <div className="chip-list">
          {pet.permissions.map((permission) => (
            <span className="chip chip-quiet" key={permission}>
              {permission}
            </span>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3>Memory Stub</h3>
        <p>{pet.memoryStub}</p>
      </section>
    </>
  );
}

function EventFeed({ events, pets }: { events: WorldEvent[]; pets: Pet[] }) {
  const petNames = new Map(pets.map((pet) => [pet.id, pet.name]));

  return (
    <ol className="event-feed">
      {events.map((event) => (
        <li className={`event-item significance-${event.significance}`} key={event.id}>
          <div className="event-time">{formatTime(event.createdAt)}</div>
          <div>
            <strong>{petNames.get(event.actorPetId ?? "") ?? labelize(event.type)}</strong>
            <p>{event.summary}</p>
            {event.responseLevel ? <span>{labelize(event.responseLevel)}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return <p className="empty-panel">{label}</p>;
}

function markerStyle(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number,
  accent: string
): CSSProperties {
  return {
    "--x": `${(x / Math.max(gridWidth - 1, 1)) * 100}%`,
    "--y": `${(y / Math.max(gridHeight - 1, 1)) * 100}%`,
    "--accent": accent
  } as CSSProperties;
}

function objectStyle(object: RoomObject, gridWidth: number, gridHeight: number): CSSProperties {
  return {
    "--x": `${(object.position.x / Math.max(gridWidth, 1)) * 100}%`,
    "--y": `${(object.position.y / Math.max(gridHeight, 1)) * 100}%`,
    "--w": `${(object.width / Math.max(gridWidth, 1)) * 100}%`,
    "--h": `${(object.height / Math.max(gridHeight, 1)) * 100}%`
  } as CSSProperties;
}

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}
