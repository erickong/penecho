"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PENECHO_IMAGE_IMPORT = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"],
    MAX_SOURCE_SIDE = 4096,
    MIN_LOGICAL_SIDE = 32;

  function acceptedImageType(type) {
    return ACCEPTED_TYPES.includes(String(type || "").trim().toLowerCase());
  }

  // Ограничить размер исходного растра: возвращает целевые пиксельные размеры <= MAX_SOURCE_SIDE.
  function rasterSize(imageWidth, imageHeight) {
    const width = Math.max(1, Math.floor(imageWidth)), height = Math.max(1, Math.floor(imageHeight)),
      scale = Math.min(1, MAX_SOURCE_SIDE / width, MAX_SOURCE_SIDE / height);
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  }

  // Вписать картинку в видимую область холста с сохранением пропорций: занять не более
  // coverage её ширины/высоты, отцентрировать и удержать в границах логического холста.
  function fitImportRect(imageWidth, imageHeight, visibleRect, canvasSize, coverage = 0.6) {
    const w = Math.max(1, imageWidth), h = Math.max(1, imageHeight),
      viewW = Math.max(1, visibleRect?.w || canvasSize), viewH = Math.max(1, visibleRect?.h || canvasSize),
      viewX = Math.max(0, visibleRect?.x || 0), viewY = Math.max(0, visibleRect?.y || 0),
      scale = Math.min((viewW * coverage) / w, (viewH * coverage) / h),
      logicalW = Math.max(MIN_LOGICAL_SIDE, Math.min(canvasSize, w * scale)),
      logicalH = Math.max(MIN_LOGICAL_SIDE, Math.min(canvasSize, h * scale)),
      x = Math.max(0, Math.min(canvasSize - logicalW, viewX + (viewW - logicalW) / 2)),
      y = Math.max(0, Math.min(canvasSize - logicalH, viewY + (viewH - logicalH) / 2));
    return { x: Math.round(x), y: Math.round(y), w: Math.round(logicalW), h: Math.round(logicalH) };
  }

  return { ACCEPTED_TYPES, MAX_SOURCE_SIDE, acceptedImageType, rasterSize, fitImportRect };
});
