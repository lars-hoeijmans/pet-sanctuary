/**
 * The instance-scoped bridge between React and the Phaser scene.
 *
 * pet-core's React layer owns world truth (the `RoomSnapshot` reducer). The
 * scene is a pure view: React pushes the latest `StageWorld` here and the scene
 * reconciles to it (diff-driven animation). Selection flows both ways — React
 * tells the scene which pet is highlighted; the scene tells React when a pet is
 * clicked. No globals: one bridge per mounted stage, so multiple stages (or
 * React strict-mode double-mounts) never cross-talk.
 */
import type { StageWorld } from "./stage-model";

type WorldListener = (world: StageWorld) => void;
type SelectionListener = (petId: string | null) => void;

export class StageBridge {
  private world: StageWorld | null = null;
  private selectedPetId: string | null = null;
  private readonly worldListeners = new Set<WorldListener>();
  private readonly selectionIn = new Set<SelectionListener>(); // React -> scene
  private readonly selectionOut = new Set<SelectionListener>(); // scene -> React

  // ---- world: React -> scene ----------------------------------------------

  setWorld(world: StageWorld): void {
    this.world = world;
    for (const listener of this.worldListeners) listener(world);
  }

  getWorld(): StageWorld | null {
    return this.world;
  }

  onWorld(listener: WorldListener): () => void {
    this.worldListeners.add(listener);
    return () => this.worldListeners.delete(listener);
  }

  // ---- selection: React -> scene ------------------------------------------

  setSelectedPet(petId: string | null): void {
    this.selectedPetId = petId;
    for (const listener of this.selectionIn) listener(petId);
  }

  getSelectedPet(): string | null {
    return this.selectedPetId;
  }

  onSelectedPetChange(listener: SelectionListener): () => void {
    this.selectionIn.add(listener);
    return () => this.selectionIn.delete(listener);
  }

  // ---- selection: scene -> React ------------------------------------------

  emitPetClicked(petId: string): void {
    for (const listener of this.selectionOut) listener(petId);
  }

  onPetClicked(listener: SelectionListener): () => void {
    this.selectionOut.add(listener);
    return () => this.selectionOut.delete(listener);
  }

  dispose(): void {
    this.worldListeners.clear();
    this.selectionIn.clear();
    this.selectionOut.clear();
    this.world = null;
  }
}
