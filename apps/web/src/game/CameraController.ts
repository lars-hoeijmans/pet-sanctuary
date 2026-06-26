/** Drag to pan, wheel to zoom, follow an agent, reset to the city overview. */
import Phaser from "phaser";

const MIN_ZOOM = 0.32;
const MAX_ZOOM = 2.2;
const DRAG_THRESHOLD = 6;

export class CameraController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private center: { x: number; y: number };
  private homeZoom: number;
  private dragging = false;
  private dragDistance = 0;

  // Bound handler refs so destroy() can remove them — the scene's input plugin
  // outlives a scene rebuild, so without this a re-created controller would
  // stack duplicate pan/zoom listeners.
  private readonly onPointerDown: () => void;
  private readonly onPointerMove: (pointer: Phaser.Input.Pointer) => void;
  private readonly onWheel: (
    pointer: Phaser.Input.Pointer,
    objects: unknown,
    dx: number,
    dy: number,
  ) => void;

  constructor(
    scene: Phaser.Scene,
    cam: Phaser.Cameras.Scene2D.Camera,
    center: { x: number; y: number },
    homeZoom = 1,
  ) {
    this.scene = scene;
    this.cam = cam;
    this.center = center;
    this.homeZoom = homeZoom;

    cam.setBackgroundColor("#0c1330");
    cam.setZoom(homeZoom);
    cam.centerOn(center.x, center.y);

    this.onPointerDown = () => {
      this.dragging = false;
      this.dragDistance = 0;
    };

    this.onPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const dx = pointer.position.x - pointer.prevPosition.x;
      const dy = pointer.position.y - pointer.prevPosition.y;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      if (this.dragDistance < DRAG_THRESHOLD) return;
      this.dragging = true;
      this.cam.stopFollow();
      this.cam.scrollX -= dx / this.cam.zoom;
      this.cam.scrollY -= dy / this.cam.zoom;
    };

    this.onWheel = (_pointer, _objects, _dx, dy) => {
      const next = Phaser.Math.Clamp(this.cam.zoom - dy * 0.0016, MIN_ZOOM, MAX_ZOOM);
      this.cam.setZoom(next);
    };

    scene.input.on("pointerdown", this.onPointerDown);
    scene.input.on("pointermove", this.onPointerMove);
    scene.input.on("wheel", this.onWheel);
  }

  /** Remove this controller's input listeners (call before discarding it). */
  destroy(): void {
    this.scene.input.off("pointerdown", this.onPointerDown);
    this.scene.input.off("pointermove", this.onPointerMove);
    this.scene.input.off("wheel", this.onWheel);
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
    if (this.cam.zoom < 0.8) this.cam.zoomTo(0.9, 420, "Sine.easeInOut");
    this.cam.pan(x, y, 420, "Sine.easeInOut");
  }

  reset(): void {
    this.cam.stopFollow();
    this.cam.pan(this.center.x, this.center.y, 420, "Sine.easeInOut");
    this.cam.zoomTo(this.homeZoom, 420, "Sine.easeInOut");
  }
}
