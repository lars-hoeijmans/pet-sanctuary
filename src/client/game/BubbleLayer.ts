/**
 * Speech bubbles. One active bubble per agent; a new line replaces the old one.
 * Bubbles are children of the agent container so they follow it automatically,
 * and auto-dismiss after a few seconds.
 */
import Phaser from "phaser";

const BUBBLE_TTL_MS = 4800;
const MAX_WIDTH = 150;
const TAIL_HEIGHT = 8;
const ANCHOR_Y = -46; // above the agent's head

interface BubbleState {
  container: Phaser.GameObjects.Container;
  timer: Phaser.Time.TimerEvent;
}

export function showBubble(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  text: string,
): void {
  // Replace any existing bubble on this agent.
  const existing = parent.getData("bubble") as BubbleState | undefined;
  if (existing) {
    existing.timer.remove(false);
    existing.container.destroy();
  }

  const label = scene.add.text(0, 0, text, {
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "11px",
    color: "#0f172a",
    align: "center",
    wordWrap: { width: MAX_WIDTH },
  });
  label.setOrigin(0.5, 0.5);

  const padX = 8;
  const padY = 5;
  const w = label.width + padX * 2;
  const h = label.height + padY * 2;

  const bg = scene.add.graphics();
  bg.fillStyle(0xffffff, 0.97);
  bg.lineStyle(1, 0x94a3b8, 0.6);
  bg.fillRoundedRect(-w / 2, -h - TAIL_HEIGHT, w, h, 7);
  bg.strokeRoundedRect(-w / 2, -h - TAIL_HEIGHT, w, h, 7);
  // tail
  bg.fillStyle(0xffffff, 0.97);
  bg.beginPath();
  bg.moveTo(-6, -TAIL_HEIGHT);
  bg.lineTo(6, -TAIL_HEIGHT);
  bg.lineTo(0, 0);
  bg.closePath();
  bg.fillPath();

  label.setPosition(0, -h / 2 - TAIL_HEIGHT);

  const container = scene.add.container(0, ANCHOR_Y, [bg, label]);
  container.setAlpha(0);
  container.setScale(0.85);
  parent.add(container);

  scene.tweens.add({
    targets: container,
    alpha: 1,
    scale: 1,
    duration: 160,
    ease: "Back.easeOut",
  });

  const timer = scene.time.delayedCall(BUBBLE_TTL_MS, () => {
    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: ANCHOR_Y - 8,
      duration: 250,
      onComplete: () => container.destroy(),
    });
    parent.setData("bubble", undefined);
  });

  parent.setData("bubble", { container, timer } satisfies BubbleState);
}
