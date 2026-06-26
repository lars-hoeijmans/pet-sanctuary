/**
 * Boots the asset pipeline before the city renders:
 *   1. loads every vendored CC0 sprite (room, furniture, characters)
 *   2. desaturates the character frames to grayscale so per-agent color tints
 *      come out accurate (the source mesh ships magenta)
 *   3. registers the 8-direction idle / run / pickup animations
 * then hands off to AgentCityScene. Shows a lightweight loading bar meanwhile.
 */
import Phaser from "phaser";
import {
  CHAR_DIRECTIONS,
  allCharKeys,
  animFrameKeys,
  buildLoadList,
  charAnimKey,
  renderScale,
  type CharAnim,
} from "./assets";

const BAR_W = 260;
const BAR_H = 14;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor("#0c1330");
    this.buildLoadingBar();
    for (const { key, path } of buildLoadList()) {
      this.load.image(key, path);
    }
  }

  create(): void {
    this.grayscaleCharacters();
    this.registerCharacterAnimations();
    this.scene.start("AgentCityScene");
  }

  // ---- loading UI ---------------------------------------------------------

  private buildLoadingBar(): void {
    // The buffer renders at device resolution while the camera zoom stays 1, so
    // world units map 1:1 to physical pixels. Drawing at DPR-scaled sizes keeps
    // the loader normally sized on screen and crisp (text rendered at native px).
    const s = renderScale();
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const barW = BAR_W * s;
    const barH = BAR_H * s;

    this.add
      .text(cx, cy - 38 * s, "AGENT CITY", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: `${22 * s}px`,
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(cx, cy - 12 * s, "warming up the city…", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: `${12 * s}px`,
        color: "#8aa0d8",
      })
      .setOrigin(0.5);

    const frame = this.add.graphics();
    frame.lineStyle(2 * s, 0x3a4a7a, 1);
    frame.strokeRoundedRect(cx - barW / 2, cy + 8 * s, barW, barH, barH / 2);

    const bar = this.add.graphics();
    this.load.on("progress", (value: number) => {
      bar.clear();
      bar.fillStyle(0x5b8cff, 1);
      bar.fillRoundedRect(
        cx - barW / 2 + 2 * s,
        cy + 10 * s,
        (barW - 4 * s) * value,
        barH - 4 * s,
        (barH - 4 * s) / 2,
      );
      hint.setText(`${Math.round(value * 100)}%`);
    });
  }

  // ---- character processing ----------------------------------------------

  /** Convert each loaded character frame to bright grayscale for clean tinting. */
  private grayscaleCharacters(): void {
    for (const key of allCharKeys()) {
      if (!this.textures.exists(key)) continue;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const w = src.width;
      const h = src.height;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.filter = "grayscale(1) brightness(1.55) contrast(1.05)";
      ctx.drawImage(src, 0, 0);
      this.textures.remove(key);
      this.textures.addCanvas(key, canvas);
    }
  }

  private registerCharacterAnimations(): void {
    const specs: Array<{ anim: CharAnim; frameRate: number; repeat: number }> = [
      { anim: "idle", frameRate: 1, repeat: -1 },
      { anim: "run", frameRate: 15, repeat: -1 },
      { anim: "pickup", frameRate: 13, repeat: 0 },
    ];
    for (const dir of CHAR_DIRECTIONS) {
      for (const { anim, frameRate, repeat } of specs) {
        const key = charAnimKey(dir, anim);
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: animFrameKeys(dir, anim).map((k) => ({ key: k })),
          frameRate,
          repeat,
        });
      }
    }
  }
}
