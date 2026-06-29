/**
 * The isometric city scene. React/Zustand owns world truth; this scene reads
 * the current snapshot for steady state and listens on worldBus for discrete
 * events to animate. It never mutates world state — selection clicks call back
 * into the store.
 *
 * Everything visible is a real CC0 Kenney sprite: floor tiles, back walls with
 * windows + a door, furniture, and 8-direction animated characters.
 */
import Phaser from "phaser";
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type WorldEvent,
  type WorldObject,
  type WorldSnapshot,
} from "../../protocol/index";
import { DEPTH, isoToScreen, TILE_H, TILE_W } from "./IsoMath";
import { createTextures } from "./TextureFactory";
import { ENV_SCALE, FLOOR_OVERLAP, FLOOR_ORIGIN_Y, footprint, renderScale, RUGS, ROOM } from "./assets";
import { buildRoom } from "./Room";
import { createObjectView } from "./ObjectRenderer";
import { AgentSprite, type WorldProjector } from "./AgentSprite";
import { CameraController } from "./CameraController";
import { Effects } from "./Effects";
import { findPath } from "./Pathfinding";
import { IdleLife } from "./IdleLife";
import { ZONES, zoneCenter } from "../world/zones";
import { useWorldStore } from "../state/useWorldStore";
import { sceneBus, worldBus } from "./eventBus";

export class AgentCityScene extends Phaser.Scene {
  private originX = 0;
  private originY = 0;
  private centerScreen = { x: 0, y: 0 };
  private fitZoom = 0.7;

  private agents = new Map<string, AgentSprite>();
  private objects = new Map<string, Phaser.GameObjects.Container>();
  private camCtl!: CameraController;
  private projector!: WorldProjector;
  private idleLife!: IdleLife;
  private unsubscribers: Array<() => void> = [];

  constructor() {
    super("AgentCityScene");
  }

  create(): void {
    createTextures(this);

    this.originX = (WORLD_HEIGHT - 1) * (TILE_W / 2) + TILE_W;
    this.originY = 170;
    this.projector = {
      toScreen: (x, y, z = 0) => {
        const s = isoToScreen(x, y, z);
        return { x: s.x + this.originX, y: s.y + this.originY };
      },
    };

    buildRoom(this, (x, y) => this.projector.toScreen(x, y), WORLD_WIDTH, WORLD_HEIGHT);
    this.buildFloor();
    this.buildRugs();
    this.buildZoneLabels();

    this.centerScreen = this.projector.toScreen((WORLD_WIDTH - 1) / 2, (WORLD_HEIGHT - 1) / 2);
    this.computeFitZoom();
    this.camCtl = new CameraController(this, this.cameras.main, this.centerScreen, this.fitZoom);

    // Render whatever already happened before the scene booted.
    this.syncFromSnapshot(useWorldStore.getState().snapshot);

    // Ambient liveliness: idle agents wander + chat (purely visual, always
    // overridden by authoritative world events via notifyActivity).
    this.idleLife = new IdleLife(this, {
      getAgents: () => this.agents,
      getBlocked: () => this.blockedTiles(),
    });
    this.idleLife.start();

    this.unsubscribers.push(worldBus.on("world:event", (event) => this.handleEvent(event)));
    this.unsubscribers.push(worldBus.on("world:snapshot", (snapshot) => this.syncFromSnapshot(snapshot, true)));
    this.unsubscribers.push(sceneBus.on("camera:reset", () => this.camCtl.reset()));
    this.unsubscribers.push(
      sceneBus.on("camera:focusAgent", (id) => {
        const sprite = this.agents.get(id);
        if (sprite) this.camCtl.focusOn(sprite.container.x, sprite.container.y);
      }),
    );

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

  private computeFitZoom(): void {
    // scale.width/height are in physical pixels (buffer is rendered at the device
    // pixel ratio). Fit the room using LOGICAL dimensions so the clamp stays
    // meaningful, then scale the camera zoom back up by the DPR so the world is
    // drawn at native resolution while keeping the same on-screen size.
    const dpr = renderScale();
    const worldW = (WORLD_WIDTH + WORLD_HEIGHT) * (TILE_W / 2);
    const worldH = (WORLD_WIDTH + WORLD_HEIGHT) * (TILE_H / 2) + 260; // wall + char headroom
    const zw = this.scale.width / dpr / worldW;
    const zh = this.scale.height / dpr / worldH;
    const logicalZoom = Phaser.Math.Clamp(Math.min(zw, zh) * 0.98, 0.46, 0.95);
    this.fitZoom = logicalZoom * dpr;
  }

  private handleResize(): void {
    this.computeFitZoom();
    if (!useWorldStore.getState().followAgentId) {
      this.cameras.main.centerOn(this.centerScreen.x, this.centerScreen.y);
    }
  }

  // ---- world building -----------------------------------------------------

  private buildFloor(): void {
    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        const screen = this.projector.toScreen(x, y);
        const tile = this.add.image(screen.x, screen.y, ROOM.floor);
        tile.setOrigin(0.5, FLOOR_ORIGIN_Y);
        tile.setScale(ENV_SCALE * FLOOR_OVERLAP);
        tile.setTint(this.floorTint(x, y));
        tile.setDepth(DEPTH.floor(x, y));
      }
    }
  }

  /** Clean two-tone checker (Habbo-style) — zones are conveyed by labels + rugs. */
  private floorTint(x: number, y: number): number {
    return (x + y) % 2 === 0 ? 0xffffff : 0xe7caa1;
  }

  private buildRugs(): void {
    ZONES.forEach((zone, i) => {
      const c = zoneCenter(zone.id);
      const screen = this.projector.toScreen(c.x, c.y);
      const rug = this.add.image(screen.x, screen.y, RUGS[i % RUGS.length]);
      rug.setOrigin(0.5, 0.5);
      rug.setScale(ENV_SCALE * 1.1);
      rug.setAlpha(0.92);
      rug.setDepth(DEPTH.rug(c.x, c.y));
    });
  }

  private buildZoneLabels(): void {
    for (const zone of ZONES) {
      const labelTileX = zone.rect.x + zone.rect.w / 2 - 0.5;
      const labelTileY = zone.rect.y + 0.15;
      const screen = this.projector.toScreen(labelTileX, labelTileY);
      const label = this.add
        .text(screen.x, screen.y, zone.name.toUpperCase(), {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "12px",
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: zone.accent + "cc",
          padding: { x: 7, y: 3 },
        })
        .setResolution(renderScale())
        .setOrigin(0.5, 0.5)
        .setAlpha(0.9);
      label.setShadow(0, 1, "#00000055", 3, false, true);
      label.setDepth(DEPTH.rug(labelTileX, labelTileY) + 1);
    }
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
    sprite.container.setInteractive(new Phaser.Geom.Circle(0, -46, 40), Phaser.Geom.Circle.Contains);
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
    const { w, d } = footprint(object.kind);
    const view = createObjectView(this, object);
    // Center on the footprint block; depth-sort by the front-most tile.
    const cx = object.position.x + (w - 1) / 2;
    const cy = object.position.y + (d - 1) / 2;
    const screen = this.projector.toScreen(cx, cy);
    view.setPosition(screen.x, screen.y);
    view.setDepth(DEPTH.object(object.position.x + w - 1, object.position.y + d - 1));
    this.objects.set(object.id, view);
    if (withSparkle) Effects.sparkle(this, screen.x, screen.y - 18);
  }

  // ---- event animation ----------------------------------------------------

  private handleEvent(event: WorldEvent): void {
    // Hand authoritative activity back to the event pipeline: cancel any idle
    // ambience on the affected agent. Idle/offline heartbeats are *not* activity
    // (they'd otherwise interrupt wandering + chatting every few seconds).
    switch (event.type) {
      case "agent.move":
      case "agent.say":
      case "agent.build":
        this.idleLife?.notifyActivity(event.agentId);
        break;
      case "agent.status":
      case "agent.heartbeat":
        if (event.status !== "idle" && event.status !== "offline") {
          this.idleLife?.notifyActivity(event.agentId);
        }
        break;
      case "agent.skill.learned":
        this.idleLife?.notifyActivity(event.agentId);
        break;
      default:
        break;
    }

    switch (event.type) {
      case "agent.register": {
        if (!this.agents.has(event.agent.id)) this.createAgentSprite(event.agent.id);
        break;
      }
      case "agent.move": {
        const sprite = this.agents.get(event.agentId) ?? this.createAgentSprite(event.agentId);
        if (!sprite) break;
        const path = findPath(
          { x: sprite.gridX, y: sprite.gridY },
          { x: event.to.x, y: event.to.y },
          this.blockedTiles(),
        );
        sprite.walkAlong(path);
        break;
      }
      case "agent.say": {
        this.agents.get(event.agentId)?.say(event.text);
        break;
      }
      case "agent.status": {
        if (!this.idleLife?.isBusy(event.agentId)) {
          this.agents.get(event.agentId)?.setStatus(event.status);
        }
        break;
      }
      case "agent.heartbeat": {
        // Don't let an idle heartbeat stomp a transient idle-chat "talking" chip.
        if (!this.idleLife?.isBusy(event.agentId)) {
          this.agents.get(event.agentId)?.setStatus(event.status);
        }
        break;
      }
      case "agent.build": {
        this.agents.get(event.agentId)?.playBuild();
        if (!this.objects.has(event.object.id)) this.addObject(event.object, true);
        break;
      }
      case "agent.artifact": {
        const sprite = this.agents.get(event.artifact.agentId);
        if (sprite) {
          Effects.pulse(this, sprite.container);
          Effects.ping(this, sprite.container.x, sprite.container.y - 56, 0xf472b6);
        }
        break;
      }
      case "task.created": {
        const creator = event.task.createdByAgentId
          ? this.agents.get(event.task.createdByAgentId)
          : undefined;
        const at = creator
          ? { x: creator.container.x, y: creator.container.y - 56 }
          : this.centerScreen;
        Effects.ping(this, at.x, at.y, 0x60a5fa);
        break;
      }
      case "agent.skill.learned": {
        const sprite = this.agents.get(event.agentId);
        if (sprite) Effects.ping(this, sprite.container.x, sprite.container.y - 56, 0xfacc15);
        break;
      }
      case "world.notification": {
        if (event.severity === "success") {
          const view = this.cameras.main.worldView;
          Effects.confetti(this, view.centerX, view.centerY - 80);
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
      const { w, d } = footprint(object.kind);
      for (let dx = 0; dx < w; dx += 1) {
        for (let dy = 0; dy < d; dy += 1) {
          blocked.add((object.position.y + dy) * WORLD_WIDTH + (object.position.x + dx));
        }
      }
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
    this.idleLife?.stop();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    for (const sprite of this.agents.values()) sprite.destroy();
    this.agents.clear();
    this.objects.clear();
  }
}
