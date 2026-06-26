/**
 * The isometric sanctuary scene. React owns world truth and pushes the latest
 * `StageWorld` through the bridge; this scene reconciles to it — a pure view.
 *
 * Steady state (positions, objects, statuses) is read from each `StageWorld`;
 * change is inferred by DIFFING successive worlds (the data layer hands us full
 * snapshots, and the normalized event stream drops movement deltas, so diffing
 * is the robust source of animation): a moved pet walks, a new object sparkles,
 * a new speech line pops a bubble. The scene never mutates world state; pet
 * clicks call back through the bridge.
 *
 * Everything visible is a real CC0 Kenney sprite — floor tiles, furniture and
 * 8-direction animated characters — framed by a procedural Habbo-style shell.
 */
import Phaser from "phaser";
import { DEPTH, isoToScreen, TILE_H, TILE_W } from "./IsoMath";
import { createTextures } from "./TextureFactory";
import {
  ENV_SCALE,
  FLOOR_ORIGIN_Y,
  FLOOR_OVERLAP,
  ROOM,
  footprint,
  isRugType,
  rugTexForId,
} from "./assets";
import { buildRoom } from "./Room";
import { createObjectView } from "./ObjectRenderer";
import { PetSprite, type WorldProjector } from "./PetSprite";
import { CameraController } from "./CameraController";
import { Effects } from "./Effects";
import { findPath } from "./Pathfinding";
import type { StageBridge } from "./bridge";
import type { StageObject, StagePet, StageWorld } from "./stage-model";

const ORIGIN_Y = 160;

export class SanctuaryScene extends Phaser.Scene {
  private bridge!: StageBridge;
  private projector!: WorldProjector;
  private camCtl!: CameraController;

  private originX = 0;
  private originY = ORIGIN_Y;
  private gridW = 0;
  private gridH = 0;
  private centerScreen = { x: 0, y: 0 };
  private fitZoom = 0.7;
  private built = false;
  private firstSync = true;

  private readonly pets = new Map<string, PetSprite>();
  private readonly objects = new Map<string, Phaser.GameObjects.GameObject>();
  /** Last-seen per-object/pet view so we can diff successive worlds. */
  private prevPets = new Map<string, StagePet>();
  private prevObjects = new Map<string, StageObject>();
  private readonly unsubscribers: Array<() => void> = [];

  constructor() {
    super("SanctuaryScene");
  }

  create(): void {
    this.bridge = this.registry.get("bridge") as StageBridge;
    createTextures(this);

    const world = this.bridge.getWorld();
    if (world) {
      this.buildWorldShell(world.width, world.height);
      this.reconcile(world);
    }

    this.unsubscribers.push(this.bridge.onWorld((next) => this.reconcile(next)));
    this.unsubscribers.push(
      this.bridge.onSelectedPetChange((petId) => this.refreshSelection(petId)),
    );
    this.refreshSelection(this.bridge.getSelectedPet());

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  // ---- world shell --------------------------------------------------------

  /** Build the floor + procedural room shell for a given grid size. */
  private buildWorldShell(width: number, height: number): void {
    this.gridW = width;
    this.gridH = height;
    this.originX = (height - 1) * (TILE_W / 2) + TILE_W;
    this.originY = ORIGIN_Y;
    this.projector = {
      toScreen: (x, y, z = 0) => {
        const s = isoToScreen(x, y, z);
        return { x: s.x + this.originX, y: s.y + this.originY };
      },
    };

    buildRoom(this, (x, y) => this.projector.toScreen(x, y), width, height);
    this.buildFloor();

    this.centerScreen = this.projector.toScreen((width - 1) / 2, (height - 1) / 2);
    this.computeFitZoom();
    // A rebuild re-runs this; drop the previous controller's input listeners
    // before creating a new one so pan/zoom handlers don't stack.
    this.camCtl?.destroy();
    this.camCtl = new CameraController(this, this.cameras.main, this.centerScreen, this.fitZoom);
    this.input.on("pointerup", (_p: Phaser.Input.Pointer) => undefined);
    this.built = true;
  }

  private buildFloor(): void {
    for (let y = 0; y < this.gridH; y += 1) {
      for (let x = 0; x < this.gridW; x += 1) {
        const screen = this.projector.toScreen(x, y);
        const tile = this.add.image(screen.x, screen.y, ROOM.floor);
        tile.setOrigin(0.5, FLOOR_ORIGIN_Y);
        tile.setScale(ENV_SCALE * FLOOR_OVERLAP);
        tile.setTint(this.floorTint(x, y));
        tile.setDepth(DEPTH.floor(x, y));
      }
    }
  }

  /** Clean two-tone checker (Habbo-style). */
  private floorTint(x: number, y: number): number {
    return (x + y) % 2 === 0 ? 0xffffff : 0xe7caa1;
  }

  private computeFitZoom(): void {
    const worldW = (this.gridW + this.gridH) * (TILE_W / 2);
    const worldH = (this.gridW + this.gridH) * (TILE_H / 2) + 260; // wall + char headroom
    const zw = this.scale.width / Math.max(worldW, 1);
    const zh = this.scale.height / Math.max(worldH, 1);
    this.fitZoom = Phaser.Math.Clamp(Math.min(zw, zh) * 0.98, 0.42, 1.05);
  }

  private handleResize(): void {
    if (!this.built) return;
    this.computeFitZoom();
    this.cameras.main.centerOn(this.centerScreen.x, this.centerScreen.y);
  }

  // ---- reconcile (diff the world) -----------------------------------------

  private reconcile(world: StageWorld): void {
    // A grid resize means a different room — rebuild the shell from scratch.
    if (!this.built || world.width !== this.gridW || world.height !== this.gridH) {
      this.teardownEntities();
      this.children.removeAll(true);
      this.firstSync = true;
      this.buildWorldShell(world.width, world.height);
    }

    this.reconcileObjects(world.objects);
    this.reconcilePets(world.pets);

    this.prevPets = new Map(world.pets.map((p) => [p.id, p]));
    this.prevObjects = new Map(world.objects.map((o) => [o.id, o]));
    this.firstSync = false;
  }

  private reconcileObjects(objects: StageObject[]): void {
    const present = new Set(objects.map((o) => o.id));
    for (const [id, view] of this.objects) {
      if (!present.has(id)) {
        view.destroy();
        this.objects.delete(id);
      }
    }
    for (const object of objects) {
      if (!this.objects.has(object.id)) {
        this.addObject(object, !this.firstSync);
      }
    }
  }

  private addObject(object: StageObject, withSparkle: boolean): void {
    if (isRugType(object.type)) {
      const screen = this.projector.toScreen(object.x, object.y);
      const rug = this.add.image(screen.x, screen.y, rugTexForId(object.id));
      rug.setOrigin(0.5, 0.5);
      rug.setScale(ENV_SCALE * 1.5);
      rug.setAlpha(0.92);
      rug.setDepth(DEPTH.rug(object.x, object.y));
      this.objects.set(object.id, rug);
      return;
    }

    const { w, d } = footprint(object.type);
    const view = createObjectView(this, object);
    // Center on the footprint block; depth-sort by the front-most tile.
    const cx = object.x + (w - 1) / 2;
    const cy = object.y + (d - 1) / 2;
    const screen = this.projector.toScreen(cx, cy);
    view.setPosition(screen.x, screen.y);
    view.setDepth(DEPTH.object(object.x + w - 1, object.y + d - 1));
    this.objects.set(object.id, view);
    if (withSparkle) Effects.sparkle(this, screen.x, screen.y - 18);
  }

  private reconcilePets(pets: StagePet[]): void {
    const present = new Set(pets.map((p) => p.id));
    for (const [id, sprite] of this.pets) {
      if (!present.has(id)) {
        sprite.destroy();
        this.pets.delete(id);
      }
    }

    for (const pet of pets) {
      let sprite = this.pets.get(pet.id);
      if (!sprite) {
        sprite = this.createPetSprite(pet);
        // New pets appear at their position; nothing to animate yet.
        this.prevPets.set(pet.id, pet);
        continue;
      }

      const prev = this.prevPets.get(pet.id);
      if (prev && (prev.x !== pet.x || prev.y !== pet.y)) {
        const path = findPath(
          { x: sprite.gridX, y: sprite.gridY },
          { x: pet.x, y: pet.y },
          this.blockedTiles(),
          { width: this.gridW, height: this.gridH },
        );
        sprite.walkAlong(path);
      }
      if (!prev || prev.status !== pet.status) {
        sprite.setStatus(pet.status);
      }
      const stamp = pet.speech?.stamp;
      if (stamp && stamp !== prev?.speech?.stamp && pet.speech) {
        sprite.say(pet.speech.message);
      }
    }
  }

  private createPetSprite(pet: StagePet): PetSprite {
    const sprite = new PetSprite(this, pet, this.projector);
    sprite.container.setInteractive(
      new Phaser.Geom.Circle(0, -46, 40),
      Phaser.Geom.Circle.Contains,
    );
    sprite.container.on("pointerover", () => this.input.setDefaultCursor("pointer"));
    sprite.container.on("pointerout", () => this.input.setDefaultCursor(""));
    sprite.container.on("pointerup", () => {
      if (!this.camCtl.isDragging) this.bridge.emitPetClicked(pet.id);
    });
    if (this.bridge.getSelectedPet() === pet.id) sprite.setSelected(true);
    if (pet.speech) sprite.say(pet.speech.message);
    this.pets.set(pet.id, sprite);
    return sprite;
  }

  /** Tiles blocked by upright furniture (rugs are walkable). */
  private blockedTiles(): Set<number> {
    const blocked = new Set<number>();
    for (const object of this.prevObjects.values()) {
      if (isRugType(object.type)) continue;
      const { w, d } = footprint(object.type);
      for (let dx = 0; dx < w; dx += 1) {
        for (let dy = 0; dy < d; dy += 1) {
          blocked.add((object.y + dy) * this.gridW + (object.x + dx));
        }
      }
    }
    return blocked;
  }

  private refreshSelection(selectedId: string | null): void {
    for (const [id, sprite] of this.pets) sprite.setSelected(id === selectedId);
  }

  // ---- teardown -----------------------------------------------------------

  private teardownEntities(): void {
    for (const sprite of this.pets.values()) sprite.destroy();
    for (const view of this.objects.values()) view.destroy();
    this.pets.clear();
    this.objects.clear();
    this.prevPets.clear();
    this.prevObjects.clear();
  }

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
    this.camCtl?.destroy();
    this.teardownEntities();
  }
}
