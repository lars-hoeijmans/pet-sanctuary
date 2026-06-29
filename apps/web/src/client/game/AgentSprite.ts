/**
 * A single agent character — a real CC0 Kenney "Human" sprite:
 *   - 8 facing directions, with idle / run / pickup animations
 *   - per-agent color via tint (frames are grayscaled at boot for accuracy)
 *   - soft contact shadow, colored selection ring, floating name + status chip
 *   - smooth tile-by-tile walking that picks the facing from the travel vector
 */
import Phaser from "phaser";
import type { AgentStatus, AgentView } from "../../protocol/index";
import { DEPTH } from "./IsoMath";
import {
  CHAR_ANCHOR_X,
  CHAR_ANCHOR_Y,
  CHAR_SCALE,
  charAnimKey,
  charFrameKey,
  facingFromGridDelta,
  renderScale,
} from "./assets";
import { TEX } from "./TextureFactory";
import { showBubble } from "./BubbleLayer";
import type { Tile } from "./Pathfinding";

export interface WorldProjector {
  toScreen: (x: number, y: number, z?: number) => { x: number; y: number };
}

const PER_TILE_MS = 300;

export const STATUS_COLORS: Record<AgentStatus, string> = {
  offline: "#64748b",
  idle: "#94a3b8",
  thinking: "#a78bfa",
  coding: "#60a5fa",
  reviewing: "#f59e0b",
  debugging: "#fb7185",
  testing: "#22d3ee",
  blocked: "#ef4444",
  talking: "#34d399",
  building: "#c4b5fd",
  shipping: "#f472b6",
  learning: "#facc15",
};

export class AgentSprite {
  readonly id: string;
  readonly container: Phaser.GameObjects.Container;

  private scene: Phaser.Scene;
  private projector: WorldProjector;
  private char: Phaser.GameObjects.Sprite;
  private ring: Phaser.GameObjects.Graphics;
  private namePlate: Phaser.GameObjects.Container;
  private statusDot: Phaser.GameObjects.Arc;
  private statusText: Phaser.GameObjects.Text;
  private ringTween?: Phaser.Tweens.Tween;
  private bobTween?: Phaser.Tweens.Tween;

  gridX: number;
  gridY: number;
  private facing = 2;
  private moveToken = 0;
  private building = false;
  private moving = false;
  private currentStatus: AgentStatus;
  private readonly colorNum: number;
  readonly name: string;
  readonly role: string;

  constructor(scene: Phaser.Scene, view: AgentView, projector: WorldProjector) {
    this.scene = scene;
    this.projector = projector;
    this.id = view.id;
    this.gridX = view.position.x;
    this.gridY = view.position.y;

    const color = Phaser.Display.Color.HexStringToColor(view.color).color;
    this.colorNum = color;
    this.name = view.name;
    this.role = view.role;
    this.currentStatus = view.status;
    const screen = projector.toScreen(this.gridX, this.gridY);
    this.container = scene.add.container(screen.x, screen.y);
    this.container.setData("agentId", view.id);

    const shadow = scene.add.image(0, 0, TEX.shadow).setScale(0.34, 0.34).setAlpha(0.32);

    this.ring = scene.add.graphics();
    this.ring.lineStyle(3, color, 1);
    this.ring.strokeEllipse(0, 0, 40, 20);
    this.ring.setVisible(false);

    this.char = scene.add.sprite(0, 0, charFrameKey(this.facing, "idle", 0));
    this.char.setOrigin(CHAR_ANCHOR_X, CHAR_ANCHOR_Y);
    this.char.setScale(CHAR_SCALE);
    this.char.setTint(color);
    this.char.play(charAnimKey(this.facing, "idle"));

    this.namePlate = this.buildNamePlate(view.name, color);
    const statusGroup = this.buildStatusChip(view.status);
    this.statusDot = statusGroup.dot;
    this.statusText = statusGroup.text;

    this.container.add([shadow, this.ring, this.char, this.namePlate, statusGroup.container]);
    this.container.setDepth(DEPTH.agent(this.gridX, this.gridY));

    // gentle idle bob so static frames still feel alive
    this.bobTween = scene.tweens.add({
      targets: this.char,
      y: -3,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private buildNamePlate(name: string, color: number): Phaser.GameObjects.Container {
    const text = this.scene.add
      .text(0, 0, name, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setResolution(renderScale())
      .setOrigin(0.5, 0.5);
    const w = text.width + 16;
    const h = 18;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0b1020, 0.78);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.lineStyle(1.5, color, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const plate = this.scene.add.container(0, -104, [bg, text]);
    return plate;
  }

  private buildStatusChip(status: AgentStatus): {
    container: Phaser.GameObjects.Container;
    dot: Phaser.GameObjects.Arc;
    text: Phaser.GameObjects.Text;
  } {
    const dot = this.scene.add.circle(0, 0, 3.5, this.statusColorNum(status));
    const text = this.scene.add
      .text(8, 0, status, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "9px",
        color: "#cbd5f5",
      })
      .setResolution(renderScale())
      .setOrigin(0, 0.5);
    const group = this.scene.add.container(0, -88, [dot, text]);
    this.recenterStatus(dot, text);
    return { container: group, dot, text };
  }

  private recenterStatus(dot: Phaser.GameObjects.Arc, text: Phaser.GameObjects.Text): void {
    const totalW = 8 + text.width;
    dot.setX(-totalW / 2);
    text.setX(-totalW / 2 + 8);
  }

  private statusColorNum(status: AgentStatus): number {
    return Phaser.Display.Color.HexStringToColor(STATUS_COLORS[status]).color;
  }

  setStatus(status: AgentStatus): void {
    this.currentStatus = status;
    this.statusText.setText(status);
    this.statusDot.setFillStyle(this.statusColorNum(status));
    this.recenterStatus(this.statusDot, this.statusText);
    if (status === "building") this.playBuild();
  }

  /** Current visual status. */
  get status(): AgentStatus {
    return this.currentStatus;
  }

  /** True while a walk animation is in flight (real or idle wander). */
  get isMoving(): boolean {
    return this.moving;
  }

  /** Turn to face a grid tile without moving (used for idle conversations). */
  faceToGrid(x: number, y: number): void {
    const facing = facingFromGridDelta(x - this.gridX, y - this.gridY);
    if (facing === null) return;
    this.facing = facing;
    if (!this.building && !this.moving) this.playIdle();
  }

  /** Play the pickup animation once (used as the "building" gesture). */
  playBuild(): void {
    if (this.building) return;
    this.building = true;
    this.bobTween?.pause();
    this.char.play(charAnimKey(this.facing, "pickup"));
    this.char.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.building = false;
      this.bobTween?.resume();
      this.playIdle();
    });
  }

  private playIdle(): void {
    if (this.building) return;
    this.char.play(charAnimKey(this.facing, "idle"), true);
  }

  private playRun(): void {
    this.char.play(charAnimKey(this.facing, "run"), true);
  }

  say(text: string): void {
    showBubble(this.scene, this.container, text, { color: this.colorNum, name: this.name });
  }

  setSelected(selected: boolean): void {
    this.ring.setVisible(selected);
    if (selected && !this.ringTween) {
      this.ringTween = this.scene.tweens.add({
        targets: this.ring,
        scaleX: 1.15,
        scaleY: 1.15,
        alpha: 0.5,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else if (!selected && this.ringTween) {
      this.ringTween.stop();
      this.ringTween = undefined;
      this.ring.setScale(1).setAlpha(1);
    }
  }

  setGridPosImmediate(x: number, y: number): void {
    this.moveToken += 1;
    this.moving = false;
    this.gridX = x;
    this.gridY = y;
    const screen = this.projector.toScreen(x, y);
    this.container.setPosition(screen.x, screen.y);
    this.container.setDepth(DEPTH.agent(x, y));
  }

  /** Walk smoothly along a path of tiles (excluding the current tile). */
  walkAlong(path: Tile[]): void {
    this.moveToken += 1;
    const token = this.moveToken;
    if (path.length === 0) {
      this.moving = false;
      this.playIdle();
      return;
    }
    this.moving = true;

    const stepTo = (index: number): void => {
      if (token !== this.moveToken || index >= path.length) {
        if (token === this.moveToken) {
          this.moving = false;
          this.playIdle();
        }
        return;
      }
      const tile = path[index];
      const dx = tile.x - this.gridX;
      const dy = tile.y - this.gridY;
      const facing = facingFromGridDelta(dx, dy);
      if (facing !== null) this.facing = facing;
      if (!this.building) this.playRun();

      const screen = this.projector.toScreen(tile.x, tile.y);
      this.container.setDepth(
        DEPTH.agent(Math.max(tile.x, this.gridX), Math.max(tile.y, this.gridY)),
      );
      this.scene.tweens.add({
        targets: this.container,
        x: screen.x,
        y: screen.y,
        duration: PER_TILE_MS,
        ease: "Linear",
        onComplete: () => {
          if (token !== this.moveToken) return;
          this.gridX = tile.x;
          this.gridY = tile.y;
          this.container.setDepth(DEPTH.agent(tile.x, tile.y));
          stepTo(index + 1);
        },
      });
    };
    stepTo(0);
  }

  destroy(): void {
    this.moveToken += 1;
    this.ringTween?.stop();
    this.bobTween?.stop();
    this.container.destroy();
  }
}
