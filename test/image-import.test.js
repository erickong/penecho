"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const IMAGE_IMPORT = require("../public/image-import.js");

const ROOT = path.join(__dirname, "..");

test("accepted image types are PNG, JPEG, and WebP only", () => {
  assert.equal(IMAGE_IMPORT.acceptedImageType("image/png"), true);
  assert.equal(IMAGE_IMPORT.acceptedImageType("image/jpeg"), true);
  assert.equal(IMAGE_IMPORT.acceptedImageType("image/webp"), true);
  assert.equal(IMAGE_IMPORT.acceptedImageType("IMAGE/PNG"), true);
  assert.equal(IMAGE_IMPORT.acceptedImageType(" image/webp "), true);
  assert.equal(IMAGE_IMPORT.acceptedImageType("image/gif"), false);
  assert.equal(IMAGE_IMPORT.acceptedImageType("image/svg+xml"), false);
  assert.equal(IMAGE_IMPORT.acceptedImageType("application/pdf"), false);
  assert.equal(IMAGE_IMPORT.acceptedImageType(""), false);
  assert.equal(IMAGE_IMPORT.acceptedImageType(undefined), false);
});

test("raster size caps the longest side without distorting aspect", () => {
  assert.deepEqual(IMAGE_IMPORT.rasterSize(800, 600), { width: 800, height: 600 });
  const capped = IMAGE_IMPORT.rasterSize(8192, 4096);
  assert.equal(capped.width, IMAGE_IMPORT.MAX_SOURCE_SIDE);
  assert.equal(capped.height, IMAGE_IMPORT.MAX_SOURCE_SIDE / 2);
  const tall = IMAGE_IMPORT.rasterSize(1000, 10000);
  assert.equal(tall.height, IMAGE_IMPORT.MAX_SOURCE_SIDE);
  assert.equal(tall.width, Math.round(1000 * (IMAGE_IMPORT.MAX_SOURCE_SIDE / 10000)));
  assert.deepEqual(IMAGE_IMPORT.rasterSize(0.4, 0.4), { width: 1, height: 1 });
});

test("fit preserves aspect ratio and centers inside the visible rect", () => {
  const visible = { x: 4000, y: 6000, w: 8000, h: 5000 };
  const fit = IMAGE_IMPORT.fitImportRect(1600, 900, visible, 20000);
  assert.ok(Math.abs(fit.w / fit.h - 1600 / 900) < 0.01);
  assert.ok(fit.w <= visible.w * 0.6 + 1 && fit.h <= visible.h * 0.6 + 1);
  assert.ok(Math.abs(fit.x + fit.w / 2 - (visible.x + visible.w / 2)) <= 1);
  assert.ok(Math.abs(fit.y + fit.h / 2 - (visible.y + visible.h / 2)) <= 1);
});

test("fit clamps to the canvas near its edges and stays inside bounds", () => {
  const fit = IMAGE_IMPORT.fitImportRect(4000, 3000, { x: 18000, y: 18500, w: 4000, h: 2500 }, 20000);
  assert.ok(fit.x >= 0 && fit.y >= 0);
  assert.ok(fit.x + fit.w <= 20000 && fit.y + fit.h <= 20000);
  const tiny = IMAGE_IMPORT.fitImportRect(2, 2, { x: 0, y: 0, w: 300, h: 300 }, 20000);
  assert.ok(tiny.w >= 32 && tiny.h >= 32);
});

test("the canvas wires import and camera controls to the draft pipeline", () => {
  const app = fs.readFileSync(path.join(ROOT, "public", "app.js"), "utf8"),
    html = fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8");
  assert.match(html, /id="importImageInput" type="file" accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(html, /id="importImageBtn"/);
  assert.match(html, /id="takePhotoBtn"/);
  assert.match(html, /id="cameraModal"[^>]*hidden/);
  assert.match(app, /IMAGE_IMPORT\.acceptedImageType\(file\.type\)/);
  assert.match(app, /startPending\(image, fit\.x, fit\.y, state\.userRevision, \{ source: "image-import" \}, \{ tool: "import_image" \}\)/);
  assert.match(app, /createImageBitmap\(file, \{ imageOrientation: "from-image" \}\)/);
  assert.match(app, /getUserMedia\(\{ video: \{ facingMode: "environment" \}, audio: false \}\)/);
  // Камера останавливается при любом закрытии модалки и никогда не работает в фоне.
  assert.match(app, /function closeCamera\(\) \{\s*stopCamera\(\);/);
  assert.match(app, /cameraStream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
});
