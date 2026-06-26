"use client";

/**
 * Client-only mount point for the Phaser room. Phaser needs `window`, so the
 * actual host is loaded with `next/dynamic({ ssr: false })` — it never renders
 * on the server. While the chunk loads we show a calm placeholder so the stage
 * is never a blank flash.
 */
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import type { RoomSnapshot } from "@/lib/contracts";

const PhaserStage = dynamic(() => import("@/game/PhaserStage"), {
  ssr: false,
  loading: () => (
    <div className="stage-loading" role="status">
      <span className="loading-dot" aria-hidden="true" />
      <span>Booting the sanctuary…</span>
    </div>
  ),
});

export interface SanctuaryStageProps {
  snapshot: RoomSnapshot;
  selectedPetId: string;
  onSelectPet: (petId: string) => void;
  style?: CSSProperties;
}

export function SanctuaryStage({ snapshot, selectedPetId, onSelectPet, style }: SanctuaryStageProps) {
  return (
    <div className="sanctuary-stage" style={style}>
      <PhaserStage
        snapshot={snapshot}
        selectedPetId={selectedPetId || null}
        onSelectPet={onSelectPet}
      />
    </div>
  );
}
