/** Cheap, GPU-friendly polish: build sparkle, artifact pulse, task ping, confetti. */
import Phaser from "phaser";
import { TEX } from "./TextureFactory";

export const Effects = {
  /** Sparkle burst when an object is built. */
  sparkle(scene: Phaser.Scene, x: number, y: number): void {
    const emitter = scene.add.particles(x, y, TEX.spark, {
      speed: { min: 40, max: 120 },
      angle: { min: 200, max: 340 },
      lifespan: 600,
      scale: { start: 0.6, end: 0 },
      quantity: 14,
      tint: [0xfde68a, 0xffffff, 0x60a5fa],
      blendMode: "ADD",
      emitting: false,
    });
    emitter.setDepth(100000);
    emitter.explode(14, x, y);
    scene.time.delayedCall(800, () => emitter.destroy());
  },

  /** Quick scale pop on an agent publishing an artifact. */
  pulse(scene: Phaser.Scene, target: Phaser.GameObjects.Container): void {
    scene.tweens.add({
      targets: target,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 140,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  },

  /** Expanding ring ping for new tasks / attention. */
  ping(scene: Phaser.Scene, x: number, y: number, color = 0x60a5fa): void {
    const ring = scene.add.graphics({ x, y });
    ring.lineStyle(3, color, 1);
    ring.strokeCircle(0, 0, 8);
    ring.setDepth(100000);
    scene.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 650,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  },

  /** Celebratory confetti for the shipped-v0.1 finale. */
  confetti(scene: Phaser.Scene, x: number, y: number): void {
    const emitter = scene.add.particles(x, y, TEX.spark, {
      speed: { min: 120, max: 320 },
      angle: { min: 230, max: 310 },
      gravityY: 380,
      lifespan: 1600,
      scale: { start: 0.7, end: 0.1 },
      quantity: 60,
      tint: [0xf472b6, 0x60a5fa, 0x34d399, 0xfacc15, 0xa78bfa],
      blendMode: "NORMAL",
      emitting: false,
    });
    emitter.setDepth(100000);
    emitter.explode(60, x, y);
    scene.time.delayedCall(1800, () => emitter.destroy());
  },
};
