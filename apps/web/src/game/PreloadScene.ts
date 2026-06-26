/**
 * Boots the asset pipeline before the room renders:
 *   1. loads every vendored CC0 sprite (room, furniture, characters)
 *   2. desaturates the character frames to grayscale so per-agent color tints
 *      come out accurate (the source mesh ships magenta)
 *   3. registers the 8-direction idle / run / pickup animations
 * then hands off to SanctuaryScene. Shows a lightweight loading bar meanwhile.
 */
import Phaser from "phaser";
import {
  CHAR_DIRECTIONS,
  allCharKeys,
  animFrameKeys,
  buildLoadList,
  charAnimKey,
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
    this.scene.start("SanctuaryScene");
  }

  // ---- loading UI ---------------------------------------------------------

  private buildLoadingBar(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add
      .text(cx, cy - 38, "PET SANCTUARY", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(cx, cy - 12, "warming up the room…", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12px",
        color: "#8aa0d8",
      })
      .setOrigin(0.5);

    const frame = this.add.graphics();
    frame.lineStyle(2, 0x3a4a7a, 1);
    frame.strokeRoundedRect(cx - BAR_W / 2, cy + 8, BAR_W, BAR_H, BAR_H / 2);

    const bar = this.add.graphics();
    this.load.on("progress", (value: number) => {
      bar.clear();
      bar.fillStyle(0x5b8cff, 1);
      bar.fillRoundedRect(cx - BAR_W / 2 + 2, cy + 10, (BAR_W - 4) * value, BAR_H - 4, (BAR_H - 4) / 2);
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
