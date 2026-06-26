/**
 * Renders WorldObjects as procedural 2.5D furniture. Each object becomes a
 * Container (shadow + shaded iso body + optional accents/label) that the scene
 * positions and depth-sorts.
 */
import Phaser from "phaser";
import type { ObjectKind, WorldObject } from "../../protocol/index";
import { TEX } from "./TextureFactory";

interface BoxSpec {
  hw: number; // footprint half-width (px)
  hh: number; // footprint half-height (px)
  height: number; // box height (px)
  color: number;
}

const SPECS: Record<ObjectKind, BoxSpec> = {
  desk: { hw: 20, hh: 10, height: 14, color: 0x8b5a2b },
  chair: { hw: 10, hh: 5, height: 16, color: 0x64748b },
  plant: { hw: 8, hh: 4, height: 10, color: 0x7c4a2d },
  server_rack: { hw: 14, hh: 7, height: 46, color: 0x1f2733 },
  whiteboard: { hw: 22, hh: 3, height: 34, color: 0xe5e7eb },
  terminal: { hw: 14, hh: 7, height: 20, color: 0x111827 },
  meeting_table: { hw: 24, hh: 12, height: 12, color: 0x6b4f2a },
  lamp: { hw: 3, hh: 2, height: 40, color: 0x9ca3af },
  bookshelf: { hw: 15, hh: 7, height: 40, color: 0x5b3a1a },
  coffee_machine: { hw: 12, hh: 6, height: 22, color: 0x374151 },
  sofa: { hw: 26, hh: 13, height: 16, color: 0x4f7cac },
  notice_board: { hw: 20, hh: 3, height: 30, color: 0xb45309 },
};

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

function drawIsoBox(g: Phaser.GameObjects.Graphics, hw: number, hh: number, height: number, color: number): void {
  const top = shade(color, 1.18);
  const right = shade(color, 0.82);
  const left = shade(color, 0.58);

  // top face
  g.fillStyle(top, 1);
  g.beginPath();
  g.moveTo(0, -hh - height);
  g.lineTo(hw, -height);
  g.lineTo(0, hh - height);
  g.lineTo(-hw, -height);
  g.closePath();
  g.fillPath();

  // right face
  g.fillStyle(right, 1);
  g.beginPath();
  g.moveTo(0, hh);
  g.lineTo(hw, 0);
  g.lineTo(hw, -height);
  g.lineTo(0, hh - height);
  g.closePath();
  g.fillPath();

  // left face
  g.fillStyle(left, 1);
  g.beginPath();
  g.moveTo(-hw, 0);
  g.lineTo(0, hh);
  g.lineTo(0, hh - height);
  g.lineTo(-hw, -height);
  g.closePath();
  g.fillPath();
}

function addAccents(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  object: WorldObject,
  spec: BoxSpec,
): void {
  const topY = -spec.height;
  switch (object.kind) {
    case "server_rack": {
      const colors = [0x34d399, 0xf59e0b, 0x60a5fa];
      for (let i = 0; i < 5; i += 1) {
        g.fillStyle(colors[i % colors.length], 0.9);
        g.fillRect(-spec.hw + 4, -spec.height + 6 + i * 7, 6, 3);
      }
      break;
    }
    case "terminal": {
      g.fillStyle(0x22d3ee, 0.9);
      g.fillRect(-spec.hw + 4, topY + 4, spec.hw * 2 - 8, spec.height - 8);
      break;
    }
    case "plant": {
      g.fillStyle(0x2f9e44, 1);
      g.fillCircle(0, topY - 6, 12);
      g.fillStyle(0x37b24d, 1);
      g.fillCircle(-5, topY - 10, 7);
      break;
    }
    case "lamp": {
      g.fillStyle(0xfde68a, 0.95);
      g.fillCircle(0, topY - 4, 10);
      break;
    }
    case "coffee_machine": {
      g.fillStyle(0xf87171, 1);
      g.fillRect(-4, topY + 4, 8, 4);
      break;
    }
    case "bookshelf": {
      const colors = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b];
      for (let i = 0; i < 4; i += 1) {
        g.fillStyle(colors[i], 0.9);
        g.fillRect(-spec.hw + 3 + i * 7, -spec.height + 6, 5, spec.height - 12);
      }
      break;
    }
    default:
      break;
  }

  // Label for boards (and any explicitly-labelled object).
  const labelKinds: ObjectKind[] = ["whiteboard", "notice_board", "server_rack"];
  if (object.label && labelKinds.includes(object.kind)) {
    const label = scene.add
      .text(0, -spec.height - 12, object.label, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "10px",
        color: "#e5e7eb",
        backgroundColor: "#0f172acc",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1);
    container.add(label);
  }
}

export function createObjectView(scene: Phaser.Scene, object: WorldObject): Phaser.GameObjects.Container {
  const spec = SPECS[object.kind];
  const container = scene.add.container(0, 0);
  container.setData("objectId", object.id);

  const shadow = scene.add.image(0, spec.hh * 0.3, TEX.shadow).setAlpha(0.22).setScale(spec.hw / 28, 0.7);
  const g = scene.add.graphics();
  drawIsoBox(g, spec.hw, spec.hh, spec.height, spec.color);

  container.add([shadow, g]);
  addAccents(scene, container, g, object, spec);
  return container;
}
