"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PENECHO_SELECTION = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  function clipPoint(point, limit) {
    return { x: Math.max(0, Math.min(limit, point.x)), y: Math.max(0, Math.min(limit, point.y)) };
  }

  function polygonBounds(points, limit) {
    if (!points.length) return null;
    let left = limit,
      top = limit,
      right = 0,
      bottom = 0;
    for (const point of points) {
      left = Math.min(left, point.x);
      top = Math.min(top, point.y);
      right = Math.max(right, point.x);
      bottom = Math.max(bottom, point.y);
    }
    left = Math.max(0, Math.floor(left));
    top = Math.max(0, Math.floor(top));
    right = Math.min(limit, Math.ceil(right));
    bottom = Math.min(limit, Math.ceil(bottom));
    return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
  }

  function pathLength(points, scale = 1) {
    let length = 0;
    for (let index = 1; index < points.length; index++) length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y) * scale;
    return length;
  }

  function shouldAddPoint(points, point, minimumDistance) {
    const last = points.at(-1);
    return !last || Math.hypot(point.x - last.x, point.y - last.y) >= minimumDistance;
  }

  function pointInPolygon(point, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
      const a = polygon[current],
        b = polygon[previous],
        crosses = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function pointSegmentDistance(point, start, end) {
    const dx = end.x - start.x,
      dy = end.y - start.y,
      lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
    const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)),
      x = start.x + ratio * dx,
      y = start.y + ratio * dy;
    return Math.hypot(point.x - x, point.y - y);
  }

  function pointNearPath(point, path, tolerance) {
    if (!Array.isArray(path) || path.length < 2) return false;
    for (let index = 0; index < path.length; index++) {
      const next = path[(index + 1) % path.length];
      if (pointSegmentDistance(point, path[index], next) <= tolerance) return true;
    }
    return false;
  }

  function unionBox(current, next) {
    if (!current) return { ...next };
    const x = Math.min(current.x, next.x),
      y = Math.min(current.y, next.y),
      right = Math.max(current.x + current.w, next.x + next.w),
      bottom = Math.max(current.y + current.h, next.y + next.h);
    return { x, y, w: right - x, h: bottom - y };
  }

  function moveBox(box, dx, dy, limit) {
    if (!box || !Number.isFinite(box.w) || !Number.isFinite(box.h) || box.w <= 0 || box.h <= 0) return { ...box };
    return {
      ...box,
      x: Math.max(0, Math.min(limit - box.w, box.x + dx)),
      y: Math.max(0, Math.min(limit - box.h, box.y + dy)),
    };
  }

  function resizeBox(box, point, minimum, limit) {
    if (!box || !Number.isFinite(box.w) || !Number.isFinite(box.h) || box.w <= 0 || box.h <= 0) return { ...box };
    const maximumScale = Math.max(Number.EPSILON, Math.min((limit - box.x) / box.w, (limit - box.y) / box.h)),
      minimumScale = Math.min(maximumScale, Math.max(minimum / box.w, minimum / box.h)),
      requestedScale = Math.max((point.x - box.x) / box.w, (point.y - box.y) / box.h),
      scale = Math.max(minimumScale, Math.min(maximumScale, requestedScale));
    return { ...box, w: box.w * scale, h: box.h * scale };
  }

  function resizeBoxAxis(box, point, axis, minimum, limit) {
    if (!box || !Number.isFinite(box.w) || !Number.isFinite(box.h) || box.w <= 0 || box.h <= 0) return { ...box };
    if (axis === "width") {
      const maximum = Math.max(minimum, limit - box.x);
      return { ...box, w: Math.max(Math.min(maximum, point.x - box.x), Math.min(minimum, maximum)) };
    }
    if (axis === "height") {
      const maximum = Math.max(minimum, limit - box.y);
      return { ...box, h: Math.max(Math.min(maximum, point.y - box.y), Math.min(minimum, maximum)) };
    }
    return resizeBox(box, point, minimum, limit);
  }

  function mapPoint(point, sourceBox, targetBox) {
    const scaleX = sourceBox?.w > 0 ? targetBox.w / sourceBox.w : 1,
      scaleY = sourceBox?.h > 0 ? targetBox.h / sourceBox.h : 1;
    return {
      x: targetBox.x + (point.x - sourceBox.x) * scaleX,
      y: targetBox.y + (point.y - sourceBox.y) * scaleY,
    };
  }

  function mapPath(path, sourceBox, targetBox) {
    if (!Array.isArray(path)) return [];
    return path.map((point) => mapPoint(point, sourceBox, targetBox));
  }

  function mapFragment(fragment, sourceBox, targetBox) {
    const scaleX = sourceBox?.w > 0 ? targetBox.w / sourceBox.w : 1,
      scaleY = sourceBox?.h > 0 ? targetBox.h / sourceBox.h : 1;
    return {
      x: targetBox.x + (fragment.x - sourceBox.x) * scaleX,
      y: targetBox.y + (fragment.y - sourceBox.y) * scaleY,
      w: fragment.w * scaleX,
      h: fragment.h * scaleY,
    };
  }

  function controlPoints(box, size) {
    return {
      cancel: { x: box.x - size * 0.42, y: box.y - size * 0.42 },
      accept: { x: box.x + box.w + size * 0.42, y: box.y - size * 0.42 },
      move: { x: box.x + box.w / 2, y: box.y - size * 0.46 },
      resize: { x: box.x + box.w, y: box.y + box.h },
      width: { x: box.x + box.w, y: box.y + box.h / 2 },
      height: { x: box.x + box.w / 2, y: box.y + box.h },
    };
  }

  function hitTest(box, point, size, includeActions = true) {
    const controls = controlPoints(box, size),
      radius = Math.max(size * 0.8, 1);
    const actions = includeActions ? ["cancel", "accept", "resize", "width", "height", "move"] : ["resize", "width", "height"];
    for (const action of actions)
      if (Math.hypot(point.x - controls[action].x, point.y - controls[action].y) <= radius) return action;
    return point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h ? "move" : null;
  }

  function hitTestPath(path, box, point, size, includeActions = true) {
    if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y) || box.w <= 0 || box.h <= 0) return null;
    const controls = controlPoints(box, size),
      radius = Math.max(Number.isFinite(size) ? size * 0.8 : 1, 1),
      right = box.x + box.w,
      bottom = box.y + box.h;
    const actions = includeActions ? ["cancel", "accept", "resize", "width", "height", "move"] : ["resize", "width", "height"];
    for (const action of actions)
      if (Math.hypot(point.x - controls[action].x, point.y - controls[action].y) <= radius) return action;
    if (!includeActions) {
      if (Math.abs(point.x - right) <= radius && point.y >= box.y - radius && point.y <= bottom + radius) return "width";
      if (Math.abs(point.y - bottom) <= radius && point.x >= box.x - radius && point.x <= right + radius) return "height";
    }
    return pointInPolygon(point, path) || pointNearPath(point, path, radius) ? "move" : null;
  }

  return {
    clipPoint,
    polygonBounds,
    pathLength,
    shouldAddPoint,
    pointInPolygon,
    pointNearPath,
    unionBox,
    moveBox,
    resizeBox,
    resizeBoxAxis,
    mapPoint,
    mapPath,
    mapFragment,
    controlPoints,
    hitTest,
    hitTestPath,
  };
});
