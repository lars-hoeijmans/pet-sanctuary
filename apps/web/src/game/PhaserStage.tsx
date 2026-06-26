"use client";

/**
 * React host for the Phaser sanctuary. Boots ONE game instance, owns a single
 * `StageBridge`, and keeps the scene in sync with React state:
 *   - the latest `RoomSnapshot` is mapped to a `StageWorld` and pushed to the
 *     bridge (the scene diffs successive worlds to animate);
 *   - selection flows both ways through the bridge.
 * Phaser touches `window`, so this module is only ever loaded client-side (via
 * `next/dynamic({ ssr: false })` in SanctuaryStage).
 */
import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { PreloadScene } from "./PreloadScene";
import { SanctuaryScene } from "./SanctuaryScene";
import { StageBridge } from "./bridge";
import { toStageWorld } from "./stage-model";
import type { RoomSnapshot } from "@/lib/contracts";

export interface PhaserStageProps {
  snapshot: RoomSnapshot;
  selectedPetId: string | null;
  onSelectPet: (petId: string) => void;
}

export default function PhaserStage({ snapshot, selectedPetId, onSelectPet }: PhaserStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const bridgeRef = useRef<StageBridge | null>(null);

  // Refs hold the latest props so the boot effect can seed initial state
  // without re-running when those props change.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const selectedRef = useRef(selectedPetId);
  selectedRef.current = selectedPetId;
  const onSelectRef = useRef(onSelectPet);
  onSelectRef.current = onSelectPet;

  // Boot the game once it has a real size, and tear it down cleanly across
  // StrictMode remounts / HMR. Phaser's RESIZE scale mode sizes its WebGL
  // framebuffer from the parent element, so booting against a 0×0 host throws
  // "Framebuffer status: Incomplete Attachment". We wait for the first non-zero
  // size (reported by the ResizeObserver) before creating the game.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let game: Phaser.Game | null = null;
    let bridge: StageBridge | null = null;
    let disposed = false;

    const boot = (width: number, height: number) => {
      if (game || disposed || width <= 0 || height <= 0) return;

      bridge = new StageBridge();
      bridge.setWorld(toStageWorld(snapshotRef.current));
      bridge.setSelectedPet(selectedRef.current);
      bridge.onPetClicked((petId) => {
        if (petId) onSelectRef.current(petId);
      });
      bridgeRef.current = bridge;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host,
        backgroundColor: "#0c1330",
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.NO_CENTER,
          width,
          height,
        },
        // preserveDrawingBuffer keeps WebGL screenshots reliable.
        render: { antialias: true, pixelArt: false, preserveDrawingBuffer: true },
        fps: { target: 60 },
        scene: [PreloadScene, SanctuaryScene],
      });
      game.registry.set("bridge", bridge);
      gameRef.current = game;
    };

    // CSS-grid resizes don't fire window 'resize', so drive Phaser explicitly —
    // and use the first sized callback to boot.
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      if (!game) boot(rect.width, rect.height);
      else game.scale.resize(rect.width, rect.height);
    });
    ro.observe(host);

    // If the host is already sized synchronously, boot immediately.
    boot(host.clientWidth, host.clientHeight);

    return () => {
      disposed = true;
      ro.disconnect();
      if (game) {
        const renderer = game.renderer;
        const gl =
          renderer && "gl" in renderer
            ? (renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl
            : null;
        game.destroy(true);
        // Proactively free the WebGL context so rapid remounts don't leak one.
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      }
      gameRef.current = null;
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
    };
  }, []);

  // Push world + selection updates to the scene through the bridge.
  useEffect(() => {
    bridgeRef.current?.setWorld(toStageWorld(snapshot));
  }, [snapshot]);

  useEffect(() => {
    bridgeRef.current?.setSelectedPet(selectedPetId);
  }, [selectedPetId]);

  // The canvas is a purely visual rendering; the room's state (pets, statuses,
  // speech, events) is exposed accessibly via the pet roster, inspector, and
  // event feed in React, and pet selection has a keyboard path there. So the
  // canvas is hidden from assistive tech rather than mislabeled as an image.
  return <div ref={hostRef} className="phaser-host" aria-hidden="true" />;
}
