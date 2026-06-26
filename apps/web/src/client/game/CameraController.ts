/** Drag to pan, wheel to zoom, follow an agent, reset to the city overview. */
import Phaser from "phaser";
import { renderScale } from "./assets";

// Camera zoom lives in physical-pixel space (the buffer renders at the device
// pixel ratio), so the logical zoom bounds are scaled by the DPR.
const DPR = renderScale();
const MIN_ZOOM = 0.32 * DPR;
const MAX_ZOOM = 2.2 * DPR;
const FOCUS_MIN_ZOOM = 0.8 * DPR;
const FOCUS_ZOOM = 0.9 * DPR;
const DRAG_THRESHOLD = 6;

export class CameraController {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private center: { x: number; y: number };
  private homeZoom: number;
  private dragging = false;
  private dragDistance = 0;

  constructor(
    scene: Phaser.Scene,
    cam: Phaser.Cameras.Scene2D.Camera,
    center: { x: number; y: number },
    homeZoom = 1,
  ) {
    this.cam = cam;
    this.center = center;
    this.homeZoom = homeZoom;

    cam.setBackgroundColor("#0c1330");
    cam.setZoom(homeZoom);
    cam.centerOn(center.x, center.y);

    scene.input.on("pointerdown", () => {
      this.dragging = false;
      this.dragDistance = 0;
    });

    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const dx = pointer.position.x - pointer.prevPosition.x;
      const dy = pointer.position.y - pointer.prevPosition.y;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      if (this.dragDistance < DRAG_THRESHOLD) return;
      this.dragging = true;
      this.cam.stopFollow();
      this.cam.scrollX -= dx / this.cam.zoom;
      this.cam.scrollY -= dy / this.cam.zoom;
    });

    scene.input.on(
      "wheel",
      (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        const next = Phaser.Math.Clamp(this.cam.zoom - dy * 0.0016, MIN_ZOOM, MAX_ZOOM);
        this.cam.setZoom(next);
      },
    );
  }

  /** True if the last pointer gesture was a pan (so it shouldn't count as a click). */
  get isDragging(): boolean {
    return this.dragging;
  }

  follow(target: Phaser.GameObjects.Container | null): void {
    if (target) this.cam.startFollow(target, false, 0.08, 0.08);
    else this.cam.stopFollow();
  }

  focusOn(x: number, y: number): void {
    this.cam.stopFollow();
    if (this.cam.zoom < FOCUS_MIN_ZOOM) this.cam.zoomTo(FOCUS_ZOOM, 420, "Sine.easeInOut");
    this.cam.pan(x, y, 420, "Sine.easeInOut");
  }

  reset(): void {
    this.cam.stopFollow();
    this.cam.pan(this.center.x, this.center.y, 420, "Sine.easeInOut");
    this.cam.zoomTo(this.homeZoom, 420, "Sine.easeInOut");
  }
}
