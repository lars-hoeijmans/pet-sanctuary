/**
 * The view model the Phaser stage consumes — the single adapter boundary
 * between pet-core's data layer (`@/lib/contracts` `RoomSnapshot`) and the
 * isometric renderer. The scene knows ONLY about `StageWorld`; it never imports
 * the contracts directly. That keeps the renderer a pure view: swap the data
 * source and nothing in `game/` changes.
 */
import type { RoomSnapshot } from "@/lib/contracts";

export interface StagePet {
  id: string;
  name: string;
  /** Hex color (e.g. "#4fb286") used to tint the character + selection ring. */
  accent: string;
  /** Contract `PetStatus` string (idle/observing/working/…). */
  status: string;
  x: number;
  y: number;
  /** Latest speech line + a stamp so the scene can detect a *new* utterance. */
  speech?: { message: string; stamp: string };
}

export interface StageObject {
  id: string;
  /** Raw world-object type ("couch"/"desk"/"lamp"/…) — drives sprite mapping. */
  type: string;
  label: string;
  x: number;
  y: number;
}

export interface StageWorld {
  roomId: string;
  roomName: string;
  width: number;
  height: number;
  paused: boolean;
  pets: StagePet[];
  objects: StageObject[];
}

/** Map a normalized `RoomSnapshot` view-model into the renderer's `StageWorld`. */
export function toStageWorld(snapshot: RoomSnapshot): StageWorld {
  return {
    roomId: snapshot.roomId,
    roomName: snapshot.roomName,
    width: snapshot.grid.width,
    height: snapshot.grid.height,
    paused: snapshot.paused,
    pets: snapshot.pets.map((pet) => ({
      id: pet.id,
      name: pet.name,
      accent: pet.accent,
      status: pet.status,
      x: pet.position.x,
      y: pet.position.y,
      speech: pet.currentSpeech
        ? { message: pet.currentSpeech.message, stamp: pet.currentSpeech.createdAt }
        : undefined,
    })),
    objects: snapshot.objects.map((object) => ({
      id: object.id,
      type: object.type,
      label: object.label,
      x: object.position.x,
      y: object.position.y,
    })),
  };
}
