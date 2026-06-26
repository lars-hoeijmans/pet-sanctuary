/**
 * The isometric city scene. React/Zustand owns world truth; this scene reads
 * the current snapshot for steady state and listens on worldBus for discrete
 * events to animate. It never mutates world state — selection clicks call back
 * into the store.
 */
import Phaser from "phaser";
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type WorldEvent,
  type WorldObject,
  type WorldSnapshot,
} from "../../protocol/index";
import { isoToScreen, screenDepth, TILE_W } from "./IsoMath";
import { createTextures, TEX } from "./TextureFactory";
import { createObjectView } from "./ObjectRenderer";
import { AgentSprite, type WorldProjector } from "./AgentSprite";
import { CameraController } from "./CameraController";
import { Effects } from "./Effects";
import { findPath } from "./Pathfinding";
import { ZONES, zoneAt } from "../world/zones";
import { useWorldStore } from "../state/useWorldStore";
import { sceneBus, worldBus } from "./eventBus";

const GENERIC_FLOOR = 0x0e1426;

export class AgentCityScene extends Phaser.Scene {
  private originX = 0;
  private originY = 0;
  private centerScreen = { x: 0, y: 0 };

  private agents = new Map<string, AgentSprite>();
  private objects = new Map<string, Phaser.GameObjects.Container>();
  private camCtl!: CameraController;
  private projector!: WorldProjector;
  private unsubscribers: Array<() => void> = [];

  constructor() {
    super("AgentCityScene");
  }

  create(): void {
    createTextures(this);

    this.originX = (WORLD_HEIGHT - 1) * (TILE_W / 2) + 64;
    this.originY = 72;
    this.projector = {
      toScreen: (x, y, z = 0) => {
        const s = isoToScreen(x, y, z);
        return { x: s.x + this.originX, y: s.y + this.originY };
      },
      depthOf: (x, y) => screenDepth(x, y),
    };

    this.buildFloor();
    this.buildZoneLabels();

    const c = this.projector.toScreen((WORLD_WIDTH - 1) / 2, (WORLD_HEIGHT - 1) / 2);
    this.centerScreen = c;
    this.camCtl = new CameraController(this, this.cameras.main, c);

    // Render whatever already happened before the scene booted (avoids the
    // boot race with the synchronous initial snapshot + register events).
    this.syncFromSnapshot(useWorldStore.getState().snapshot);

    // Future events + commands.
    this.unsubscribers.push(worldBus.on("world:event", (event) => this.handleEvent(event)));
    this.unsubscribers.push(worldBus.on("world:snapshot", (snapshot) => this.syncFromSnapshot(snapshot, true)));
    this.unsubscribers.push(sceneBus.on("camera:reset", () => this.camCtl.reset()));
    this.unsubscribers.push(
      sceneBus.on("camera:focusAgent", (id) => {
        const sprite = this.agents.get(id);
        if (sprite) this.camCtl.focusOn(sprite.container.x, sprite.container.y);
      }),
    );

    // Selection / follow are reflected from the store.
    let prevSelected = useWorldStore.getState().selectedAgentId;
    let prevFollow = useWorldStore.getState().followAgentId;
    this.refreshSelection(prevSelected);
    this.refreshFollow(prevFollow);
    const unsub = useWorldStore.subscribe((state) => {
      if (state.selectedAgentId !== prevSelected) {
        prevSelected = state.selectedAgentId;
        this.refreshSelection(prevSelected);
      }
      if (state.followAgentId !== prevFollow) {
        prevFollow = state.followAgentId;
        this.refreshFollow(prevFollow);
      }
    });
    this.unsubscribers.push(unsub);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private handleResize(): void {
    // Keep the city centered on resize, unless the user is following an agent.
    if (!useWorldStore.getState().followAgentId) {
      this.cameras.main.centerOn(this.centerScreen.x, this.centerScreen.y);
    }
  }

  // ---- world building -----------------------------------------------------

  private buildFloor(): void {
    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        const screen = this.projector.toScreen(x, y);
        const zone = zoneAt(x, y);
        const baseColor = zone?.color ?? GENERIC_FLOOR;
        const tint = (x + y) % 2 === 0 ? baseColor : this.darken(baseColor, 0.88);
        const tile = this.add.image(screen.x, screen.y, TEX.tile);
        tile.setTint(tint);
        tile.setDepth(-100000 + screenDepth(x, y));
      }
    }
  }

  private buildZoneLabels(): void {
    for (const zone of ZONES) {
      const labelTileX = zone.rect.x + zone.rect.w / 2 - 0.5;
      const labelTileY = zone.rect.y + 0.2;
      const screen = this.projector.toScreen(labelTileX, labelTileY);
      const label = this.add
        .text(screen.x, screen.y, zone.name.toUpperCase(), {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "11px",
          fontStyle: "bold",
          color: zone.accent,
        })
        .setOrigin(0.5, 0.5)
        .setAlpha(0.45);
      label.setDepth(-90000 + screenDepth(labelTileX, labelTileY));
    }
  }

  private darken(color: number, factor: number): number {
    const r = Math.round(((color >> 16) & 0xff) * factor);
    const g = Math.round(((color >> 8) & 0xff) * factor);
    const b = Math.round((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  // ---- syncing ------------------------------------------------------------

  private syncFromSnapshot(snapshot: WorldSnapshot, rebuild = false): void {
    if (rebuild) {
      for (const sprite of this.agents.values()) sprite.destroy();
      for (const obj of this.objects.values()) obj.destroy();
      this.agents.clear();
      this.objects.clear();
    }

    for (const object of Object.values(snapshot.objects)) {
      if (!this.objects.has(object.id)) this.addObject(object, false);
    }
    for (const view of Object.values(snapshot.agents)) {
      if (!this.agents.has(view.id)) this.createAgentSprite(view.id);
    }
  }

  private createAgentSprite(id: string): AgentSprite | undefined {
    const view = useWorldStore.getState().snapshot.agents[id];
    if (!view) return undefined;
    const sprite = new AgentSprite(this, view, this.projector);
    sprite.container.setInteractive(new Phaser.Geom.Circle(0, -22, 28), Phaser.Geom.Circle.Contains);
    sprite.container.on("pointerover", () => this.input.setDefaultCursor("pointer"));
    sprite.container.on("pointerout", () => this.input.setDefaultCursor(""));
    sprite.container.on("pointerup", () => {
      if (!this.camCtl.isDragging) useWorldStore.getState().selectAgent(id);
    });
    if (useWorldStore.getState().selectedAgentId === id) sprite.setSelected(true);
    this.agents.set(id, sprite);
    return sprite;
  }

  private addObject(object: WorldObject, withSparkle: boolean): void {
    const view = createObjectView(this, object);
    const screen = this.projector.toScreen(object.position.x, object.position.y);
    view.setPosition(screen.x, screen.y);
    view.setDepth(screenDepth(object.position.x, object.position.y) - 1); // just behind agents on same tile
    this.objects.set(object.id, view);
    if (withSparkle) Effects.sparkle(this, screen.x, screen.y - 10);
  }

  // ---- event animation ----------------------------------------------------

  private handleEvent(event: WorldEvent): void {
    switch (event.type) {
      case "agent.register": {
        if (!this.agents.has(event.agent.id)) this.createAgentSprite(event.agent.id);
        break;
      }
      case "agent.move": {
        const sprite = this.agents.get(event.agentId) ?? this.createAgentSprite(event.agentId);
        if (!sprite) break;
        const blocked = this.blockedTiles();
        const path = findPath(
          { x: sprite.gridX, y: sprite.gridY },
          { x: event.to.x, y: event.to.y },
          blocked,
        );
        sprite.walkAlong(path);
        break;
      }
      case "agent.say": {
        this.agents.get(event.agentId)?.say(event.text);
        break;
      }
      case "agent.status": {
        this.agents.get(event.agentId)?.setStatus(event.status);
        break;
      }
      case "agent.heartbeat": {
        this.agents.get(event.agentId)?.setStatus(event.status);
        break;
      }
      case "agent.build": {
        if (!this.objects.has(event.object.id)) this.addObject(event.object, true);
        break;
      }
      case "agent.artifact": {
        const sprite = this.agents.get(event.artifact.agentId);
        if (sprite) {
          Effects.pulse(this, sprite.container);
          Effects.ping(this, sprite.container.x, sprite.container.y - 20, 0xf472b6);
        }
        break;
      }
      case "task.created": {
        const creator = event.task.createdByAgentId
          ? this.agents.get(event.task.createdByAgentId)
          : undefined;
        const at = creator
          ? { x: creator.container.x, y: creator.container.y - 20 }
          : this.centerScreen;
        Effects.ping(this, at.x, at.y, 0x60a5fa);
        break;
      }
      case "agent.skill.learned": {
        const sprite = this.agents.get(event.agentId);
        if (sprite) Effects.ping(this, sprite.container.x, sprite.container.y - 20, 0xfacc15);
        break;
      }
      case "world.notification": {
        if (event.severity === "success") {
          const view = this.cameras.main.worldView;
          Effects.confetti(this, view.centerX, view.centerY - 60);
        }
        break;
      }
      default:
        break;
    }
  }

  private blockedTiles(): Set<number> {
    const blocked = new Set<number>();
    for (const object of Object.values(useWorldStore.getState().snapshot.objects)) {
      blocked.add(object.position.y * WORLD_WIDTH + object.position.x);
    }
    return blocked;
  }

  private refreshSelection(selectedId: string | null): void {
    for (const [id, sprite] of this.agents) sprite.setSelected(id === selectedId);
  }

  private refreshFollow(followId: string | null): void {
    const sprite = followId ? this.agents.get(followId) : null;
    this.camCtl.follow(sprite ? sprite.container : null);
  }

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    for (const sprite of this.agents.values()) sprite.destroy();
    this.agents.clear();
    this.objects.clear();
  }
}
