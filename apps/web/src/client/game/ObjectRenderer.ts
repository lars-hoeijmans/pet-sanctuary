/**
 * Renders WorldObjects as real Kenney furniture sprites (CC0), sized to fit their
 * grid footprint. Each object is a Container of [soft shadow, sprite, optional
 * label] anchored at its base so it sits on the tile block; the scene positions
 * it at the footprint centroid and depth-sorts it by its front tile.
 */
import Phaser from "phaser";
import type { ObjectKind, WorldObject } from "../../protocol/index";
import { OBJECT_SPRITE } from "./assets";
import { TILE_W } from "./IsoMath";
import { TEX } from "./TextureFactory";

/** Kinds that show their label as a floating chip above the sprite. */
const LABELLED_KINDS: ReadonlySet<ObjectKind> = new Set([
  "whiteboard",
  "notice_board",
  "server_rack",
]);

export function createObjectView(scene: Phaser.Scene, object: WorldObject): Phaser.GameObjects.Container {
  const spec = OBJECT_SPRITE[object.kind];
  const container = scene.add.container(0, 0);
  container.setData("objectId", object.id);

  // Footprint diamond width in screen px, then scale the sprite to fill `fill`
  // of it — so a 2x1 sofa spans ~2 tiles and a 1x1 chair sits in one.
  const footW = (spec.w + spec.d) * (TILE_W / 2);
  const sprite = scene.add.image(0, 0, spec.tex);
  sprite.setOrigin(0.5, 0.92); // base of the furniture sits on the tile block
  let scale = (footW * spec.fill) / sprite.width;
  // Guard: keep tall/thin pieces (lamps) from towering over the room.
  const maxH = TILE_W * 2.1;
  if (sprite.height * scale > maxH) scale = maxH / sprite.height;
  sprite.setScale(scale);

  const shadowW = footW * 0.82;
  const shadow = scene.add
    .image(0, -2, TEX.shadow)
    .setScale(shadowW / 128, shadowW / 128)
    .setAlpha(0.28);

  container.add([shadow, sprite]);

  if (object.label && LABELLED_KINDS.has(object.kind)) {
    const top = -sprite.displayHeight * 0.92;
    const label = scene.add
      .text(0, top - 6, object.label, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#0b1020",
        backgroundColor: "#ffffffdd",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.82);
    container.add(label);
  }

  return container;
}
