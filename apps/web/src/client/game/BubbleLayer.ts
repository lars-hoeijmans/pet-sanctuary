/**
 * Habbo-style speech bubbles: a rounded white pill with a colored speaker cap,
 * a soft drop shadow and a little downward tail. One active bubble per agent;
 * a new line replaces the old one and it auto-dismisses.
 */
import Phaser from "phaser";
import { renderScale } from "./assets";

const BUBBLE_TTL_MS = 4800;
const MAX_WIDTH = 168;
const TAIL_H = 9;
const PAD_X = 9;
const PAD_Y = 6;
const CAP_R = 5;
const CAP_GAP = 8;
const ANCHOR_Y = -118; // tail tip sits here, above the name plate

export interface BubbleOpts {
  color?: number;
  name?: string;
}

interface BubbleState {
  container: Phaser.GameObjects.Container;
  timer: Phaser.Time.TimerEvent;
}

export function showBubble(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  text: string,
  opts: BubbleOpts = {},
): void {
  const existing = parent.getData("bubble") as BubbleState | undefined;
  if (existing) {
    existing.timer.remove(false);
    existing.container.destroy();
  }

  const color = opts.color ?? 0x5b8cff;
  const label = scene.add.text(0, 0, text, {
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "11px",
    color: "#1b2440",
    align: "left",
    wordWrap: { width: MAX_WIDTH },
  });
  label.setResolution(renderScale());
  label.setOrigin(0, 0.5);

  const capW = CAP_R * 2 + CAP_GAP;
  const w = capW + label.width + PAD_X * 2;
  const h = Math.max(label.height, CAP_R * 2) + PAD_Y * 2;
  const top = -h - TAIL_H;

  const bg = scene.add.graphics();
  // drop shadow
  bg.fillStyle(0x0b1020, 0.18);
  bg.fillRoundedRect(-w / 2 + 2, top + 3, w, h, 9);
  // body
  bg.fillStyle(0xffffff, 0.98);
  bg.lineStyle(1.5, 0xcdd6ee, 1);
  bg.fillRoundedRect(-w / 2, top, w, h, 9);
  bg.strokeRoundedRect(-w / 2, top, w, h, 9);
  // tail
  bg.fillStyle(0xffffff, 0.98);
  bg.beginPath();
  bg.moveTo(-6, -TAIL_H + 0.5);
  bg.lineTo(6, -TAIL_H + 0.5);
  bg.lineTo(0, 0);
  bg.closePath();
  bg.fillPath();
  // speaker color cap
  bg.fillStyle(color, 1);
  bg.fillCircle(-w / 2 + PAD_X + CAP_R, top + h / 2, CAP_R);

  label.setPosition(-w / 2 + PAD_X + capW, top + h / 2);

  const container = scene.add.container(0, ANCHOR_Y, [bg, label]);
  container.setAlpha(0).setScale(0.85);
  parent.add(container);

  scene.tweens.add({
    targets: container,
    alpha: 1,
    scale: 1,
    duration: 170,
    ease: "Back.easeOut",
  });

  const timer = scene.time.delayedCall(BUBBLE_TTL_MS, () => {
    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: ANCHOR_Y - 8,
      duration: 240,
      onComplete: () => container.destroy(),
    });
    parent.setData("bubble", undefined);
  });

  parent.setData("bubble", { container, timer } satisfies BubbleState);
}
