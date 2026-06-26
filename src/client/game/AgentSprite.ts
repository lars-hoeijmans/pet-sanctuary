/**
 * A single agent character: shaded body, avatar accent, name + status pill,
 * soft shadow, idle bob, selection ring and smooth tile-by-tile walking.
 */
import Phaser from "phaser";
import type { AgentAvatar, AgentStatus, AgentView } from "../../protocol/index";
import { TEX } from "./TextureFactory";
import { showBubble } from "./BubbleLayer";
import type { Tile } from "./Pathfinding";

export interface WorldProjector {
  toScreen: (x: number, y: number, z?: number) => { x: number; y: number };
  depthOf: (x: number, y: number) => number;
}

const PER_TILE_MS = 260;

const STATUS_COLORS: Record<AgentStatus, string> = {
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

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

export class AgentSprite {
  readonly id: string;
  readonly container: Phaser.GameObjects.Container;

  private scene: Phaser.Scene;
  private projector: WorldProjector;
  private bodyGroup: Phaser.GameObjects.Container;
  private ring: Phaser.GameObjects.Graphics;
  private statusPill: Phaser.GameObjects.Text;
  private ringTween?: Phaser.Tweens.Tween;

  gridX: number;
  gridY: number;
  private moveToken = 0;

  constructor(scene: Phaser.Scene, view: AgentView, projector: WorldProjector) {
    this.scene = scene;
    this.projector = projector;
    this.id = view.id;
    this.gridX = view.position.x;
    this.gridY = view.position.y;

    const color = Phaser.Display.Color.HexStringToColor(view.color).color;
    const screen = projector.toScreen(this.gridX, this.gridY);
    this.container = scene.add.container(screen.x, screen.y);
    this.container.setData("agentId", view.id);

    const shadow = scene.add.image(0, 6, TEX.shadow).setAlpha(0.3).setScale(0.5, 0.55);

    this.ring = scene.add.graphics();
    this.ring.lineStyle(2.5, color, 1);
    this.ring.strokeEllipse(0, 5, 38, 19);
    this.ring.setVisible(false);

    this.bodyGroup = scene.add.container(0, 0);
    this.drawBody(color, view.avatar);

    const name = scene.add
      .text(0, 14, view.name, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#f8fafc",
      })
      .setOrigin(0.5, 0.5);
    name.setShadow(0, 1, "#0b1020", 3, false, true);

    this.statusPill = scene.add
      .text(0, 28, view.status, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "9px",
        color: "#0b1020",
        backgroundColor: STATUS_COLORS[view.status],
        padding: { x: 5, y: 1 },
      })
      .setOrigin(0.5, 0.5);

    this.container.add([shadow, this.ring, this.bodyGroup, name, this.statusPill]);
    this.container.setDepth(projector.depthOf(this.gridX, this.gridY));

    // gentle idle bob
    scene.tweens.add({
      targets: this.bodyGroup,
      y: -3,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private drawBody(color: number, avatar: AgentAvatar): void {
    const g = this.scene.add.graphics();
    const head = shade(color, 1.3);

    // feet
    g.fillStyle(shade(color, 0.5), 1);
    g.fillEllipse(-5, -6, 9, 5);
    g.fillEllipse(5, -6, 9, 5);

    // body (rounded capsule)
    g.fillStyle(color, 1);
    g.fillRoundedRect(-11, -32, 22, 26, 8);
    g.fillStyle(shade(color, 0.78), 1);
    g.fillRoundedRect(2, -32, 9, 26, { tl: 0, tr: 8, bl: 0, br: 8 });

    // head
    g.fillStyle(head, 1);
    g.fillCircle(0, -38, 9);

    // eyes
    g.fillStyle(0x0b1020, 0.85);
    g.fillCircle(-3, -39, 1.6);
    g.fillCircle(3, -39, 1.6);

    this.bodyGroup.add(g);
    this.drawAvatarAccent(avatar, color);
  }

  private drawAvatarAccent(avatar: AgentAvatar, color: number): void {
    const a = this.scene.add.graphics();
    switch (avatar) {
      case "robot": {
        a.lineStyle(2, 0x94a3b8, 1);
        a.beginPath();
        a.moveTo(0, -47);
        a.lineTo(0, -52);
        a.strokePath();
        a.fillStyle(0x22d3ee, 1);
        a.fillCircle(0, -53, 2.5);
        break;
      }
      case "hoodie": {
        a.fillStyle(shade(color, 0.6), 1);
        a.slice(0, -38, 11, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
        a.fillPath();
        break;
      }
      case "wizard": {
        a.fillStyle(0x7c3aed, 1);
        a.beginPath();
        a.moveTo(-9, -45);
        a.lineTo(9, -45);
        a.lineTo(0, -62);
        a.closePath();
        a.fillPath();
        a.fillStyle(0xfacc15, 1);
        a.fillCircle(0, -56, 1.8);
        break;
      }
      case "infra": {
        a.fillStyle(0xf59e0b, 1);
        a.slice(0, -43, 11, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), true);
        a.fillPath();
        a.fillRect(-12, -44, 24, 2);
        break;
      }
      default: {
        a.fillStyle(0xffffff, 0.9);
        a.fillCircle(-3, -39, 1);
        a.fillCircle(3, -39, 1);
        break;
      }
    }
    this.bodyGroup.add(a);
  }

  setStatus(status: AgentStatus): void {
    this.statusPill.setText(status);
    this.statusPill.setBackgroundColor(STATUS_COLORS[status]);
  }

  say(text: string): void {
    showBubble(this.scene, this.container, text);
  }

  setSelected(selected: boolean): void {
    this.ring.setVisible(selected);
    if (selected && !this.ringTween) {
      this.ringTween = this.scene.tweens.add({
        targets: this.ring,
        scaleX: 1.15,
        scaleY: 1.15,
        alpha: 0.6,
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
    this.moveToken += 1; // cancel any in-flight walk
    this.gridX = x;
    this.gridY = y;
    const screen = this.projector.toScreen(x, y);
    this.container.setPosition(screen.x, screen.y);
    this.container.setDepth(this.projector.depthOf(x, y));
  }

  /** Walk smoothly along a path of tiles (excluding the current tile). */
  walkAlong(path: Tile[]): void {
    this.moveToken += 1;
    const token = this.moveToken;
    if (path.length === 0) return;

    const stepTo = (index: number): void => {
      if (token !== this.moveToken || index >= path.length) return;
      const tile = path[index];
      const screen = this.projector.toScreen(tile.x, tile.y);
      // bump depth to the leading tile so we sort correctly mid-stride
      this.container.setDepth(this.projector.depthOf(Math.max(tile.x, this.gridX), Math.max(tile.y, this.gridY)));
      this.scene.tweens.add({
        targets: this.container,
        x: screen.x,
        y: screen.y,
        duration: PER_TILE_MS,
        ease: "Sine.easeInOut",
        onComplete: () => {
          if (token !== this.moveToken) return;
          this.gridX = tile.x;
          this.gridY = tile.y;
          this.container.setDepth(this.projector.depthOf(tile.x, tile.y));
          stepTo(index + 1);
        },
      });
    };
    stepTo(0);
  }

  destroy(): void {
    this.moveToken += 1;
    this.ringTween?.stop();
    this.container.destroy();
  }
}
