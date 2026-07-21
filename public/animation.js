"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PENECHO_ANIMATION = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  const MAX_OBJECTS = 32,
    MAX_MOTIONS = 32,
    MAX_PATH_POINTS = 128,
    MAX_TEXT_LENGTH = 240,
    OBJECT_TYPES = new Set(["group", "circle", "ellipse", "rect", "line", "path", "text"]),
    MOTION_TYPES = new Set(["orbit", "spin", "translate", "pulse", "fade", "keyframes"]),
    PALETTE = ["#f59e0b", "#2563eb", "#ef4444", "#10b981", "#8b5cf6", "#06b6d4", "#f97316", "#64748b"],
    COLOR_NAMES = new Set(["black", "white", "red", "orange", "yellow", "green", "blue", "purple", "gray", "grey", "transparent"]);

  const finite = (value) => Number.isFinite(value),
    clamp = (value, min, max) => Math.max(min, Math.min(max, value)),
    safeNumber = (value, fallback = 0) => (finite(value) ? value : fallback),
    point = (value) => Array.isArray(value) && value.length === 2 && value.every(finite) ? [value[0], value[1]] : null,
    period = (value, fallback) => clamp(finite(value) ? value : fallback, 250, 600000);

  function safeColor(value, fallback = null) {
    if (typeof value !== "string") return fallback;
    const color = value.trim().toLowerCase();
    if (/^#[0-9a-f]{3,8}$/i.test(color) || /^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*[\d.]+%?)?\s*\)$/i.test(color) || COLOR_NAMES.has(color)) return color;
    return fallback;
  }

  function normalizeStyle(source, index, type) {
    const outlined = type === "line" || type === "path",
      fill = safeColor(source.fill, outlined ? null : PALETTE[index % PALETTE.length]),
      stroke = safeColor(source.stroke, outlined ? PALETTE[index % PALETTE.length] : null),
      lineWidth = clamp(safeNumber(source.lineWidth, outlined ? 4 : 2), 0.5, 80),
      opacity = clamp(safeNumber(source.opacity, 1), 0, 1);
    return { fill, stroke, lineWidth, opacity };
  }

  function bounded(value, min, max) {
    return finite(value) && value >= min && value <= max;
  }

  function normalizeObject(source, index, width, height) {
    if (!source || typeof source !== "object" || Array.isArray(source) || !OBJECT_TYPES.has(source.type)) return null;
    const id = typeof source.id === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(source.id) ? source.id : null;
    if (!id) return null;
    const base = { id, type: source.type, ...normalizeStyle(source, index, source.type) };
    if (source.type === "group") {
      const children = Array.isArray(source.children) ? source.children.filter((child) => typeof child === "string").slice(0, 32) : [];
      if (!children.length) return null;
      return { ...base, x: safeNumber(source.x), y: safeNumber(source.y), rotation: safeNumber(source.rotation), scale: clamp(safeNumber(source.scale, 1), 0.05, 20), children };
    }
    if (source.type === "circle") {
      if (![source.cx, source.cy, source.r].every(finite) || source.r <= 0 || source.r > Math.max(width, height) * 2) return null;
      return { ...base, cx: source.cx, cy: source.cy, r: source.r };
    }
    if (source.type === "ellipse") {
      if (![source.cx, source.cy, source.rx, source.ry].every(finite) || source.rx <= 0 || source.ry <= 0 || source.rx > width * 2 || source.ry > height * 2) return null;
      return { ...base, cx: source.cx, cy: source.cy, rx: source.rx, ry: source.ry };
    }
    if (source.type === "rect") {
      if (![source.x, source.y, source.w, source.h].every(finite) || source.w <= 0 || source.h <= 0 || source.w > width * 3 || source.h > height * 3) return null;
      return { ...base, x: source.x, y: source.y, w: source.w, h: source.h, radius: clamp(safeNumber(source.radius), 0, Math.min(source.w, source.h) / 2) };
    }
    if (source.type === "line") {
      if (![source.x1, source.y1, source.x2, source.y2].every(finite)) return null;
      return { ...base, x1: source.x1, y1: source.y1, x2: source.x2, y2: source.y2 };
    }
    if (source.type === "path") {
      const points = Array.isArray(source.points) ? source.points.map(point).filter(Boolean).slice(0, MAX_PATH_POINTS) : [];
      if (points.length < 2) return null;
      return { ...base, points, closed: Boolean(source.closed), smooth: Boolean(source.smooth) };
    }
    if (source.type === "text") {
      if (!finite(source.x) || !finite(source.y) || typeof source.text !== "string" || !source.text.length) return null;
      return {
        ...base,
        x: source.x,
        y: source.y,
        text: source.text.slice(0, MAX_TEXT_LENGTH),
        fontSize: clamp(safeNumber(source.fontSize, 32), 6, 400),
        fontFamily: typeof source.fontFamily === "string" && source.fontFamily.length <= 80 ? source.fontFamily : "system-ui, sans-serif",
        fontWeight: source.fontWeight === "bold" || source.fontWeight === 700 ? "700" : "500",
        align: ["left", "center", "right"].includes(source.align) ? source.align : "left",
      };
    }
    return null;
  }

  function normalizeKeyframes(source) {
    if (!Array.isArray(source) || source.length < 2 || source.length > 16) return null;
    const frames = source.map((frame) => {
      if (!frame || typeof frame !== "object" || Array.isArray(frame) || !bounded(frame.at, 0, 1)) return null;
      const normalized = { at: frame.at };
      for (const key of ["x", "y", "rotation"]) if (finite(frame[key])) normalized[key] = frame[key];
      if (finite(frame.scale)) normalized.scale = clamp(frame.scale, 0.05, 20);
      if (finite(frame.opacity)) normalized.opacity = clamp(frame.opacity, 0, 1);
      return Object.keys(normalized).length > 1 ? normalized : null;
    });
    if (frames.some((frame) => !frame)) return null;
    frames.sort((a, b) => a.at - b.at);
    if (frames.some((frame, index) => index && frame.at <= frames[index - 1].at)) return null;
    return frames;
  }

  function normalizeMotion(source, ids, durationMs, width, height) {
    if (!source || typeof source !== "object" || Array.isArray(source) || !MOTION_TYPES.has(source.type) || !ids.has(source.target)) return null;
    const base = { type: source.type, target: source.target, periodMs: period(source.periodMs, durationMs), phase: safeNumber(source.phaseDeg) * Math.PI / 180 };
    if (source.type === "orbit") {
      const center = typeof source.center === "string" && ids.has(source.center) ? source.center : point(source.center);
      if (!center || !finite(source.rx) || !finite(source.ry) || source.rx <= 0 || source.ry <= 0 || source.rx > width * 2 || source.ry > height * 2) return null;
      return { ...base, center, rx: source.rx, ry: source.ry, clockwise: source.clockwise !== false };
    }
    if (source.type === "spin") return { ...base, clockwise: source.clockwise !== false };
    if (source.type === "translate") {
      const from = point(source.from) || [0, 0],
        to = point(source.to);
      if (!to) return null;
      return { ...base, from, to, alternate: source.alternate !== false };
    }
    if (source.type === "pulse") return { ...base, from: clamp(safeNumber(source.from, 0.85), 0.05, 20), to: clamp(safeNumber(source.to, 1.15), 0.05, 20) };
    if (source.type === "fade") return { ...base, from: clamp(safeNumber(source.from, 0.25), 0, 1), to: clamp(safeNumber(source.to, 1), 0, 1) };
    const frames = normalizeKeyframes(source.frames);
    return frames ? { ...base, frames } : null;
  }

  function normalize(command, canvasSize = 20000) {
    if (!command || typeof command !== "object" || Array.isArray(command) || (command.tool || command.type || command.name) !== "animate_scene") return null;
    const x = command.x,
      y = command.y,
      width = command.w,
      height = command.h,
      durationMs = period(command.durationMs, 8000);
    if (![x, y, width, height].every(finite) || x < 0 || y < 0 || width < 120 || height < 90 || width > 6000 || height > 6000 || x + width > canvasSize || y + height > canvasSize) return null;
    if (!Array.isArray(command.objects) || !command.objects.length || command.objects.length > MAX_OBJECTS || !Array.isArray(command.motions) || !command.motions.length || command.motions.length > MAX_MOTIONS) return null;
    const objects = command.objects.map((object, index) => normalizeObject(object, index, width, height));
    if (objects.some((object) => !object)) return null;
    const ids = new Set(objects.map((object) => object.id));
    if (ids.size !== objects.length) return null;
    const byId = new Map(objects.map((object) => [object.id, object])),
      childIds = new Set();
    for (const object of objects) {
      if (object.type !== "group") continue;
      const localChildren = new Set();
      for (const child of object.children) {
        if (!ids.has(child) || child === object.id || localChildren.has(child) || childIds.has(child)) return null;
        localChildren.add(child);
        childIds.add(child);
      }
    }
    const visiting = new Set(),
      visited = new Set();
    function visitGroup(id) {
      const object = byId.get(id);
      if (!object || object.type !== "group" || visited.has(id)) return true;
      if (visiting.has(id)) return false;
      visiting.add(id);
      for (const child of object.children) if (!visitGroup(child)) return false;
      visiting.delete(id);
      visited.add(id);
      return true;
    }
    for (const object of objects) if (object.type === "group" && !visitGroup(object.id)) return null;
    const motions = command.motions.map((motion) => normalizeMotion(motion, ids, durationMs, width, height));
    if (motions.some((motion) => !motion)) return null;
    return {
      tool: "animate_scene",
      version: 1,
      x,
      y,
      w: width,
      h: height,
      durationMs,
      loop: command.loop !== false,
      objects,
      motions,
      dynamicObjectCount: new Set(motions.map((motion) => motion.target)).size,
    };
  }

  function objectAnchor(object) {
    if (object.type === "circle" || object.type === "ellipse") return { x: object.cx, y: object.cy };
    if (object.type === "rect") return { x: object.x + object.w / 2, y: object.y + object.h / 2 };
    if (object.type === "line") return { x: (object.x1 + object.x2) / 2, y: (object.y1 + object.y2) / 2 };
    if (object.type === "path") return { x: object.points.reduce((sum, item) => sum + item[0], 0) / object.points.length, y: object.points.reduce((sum, item) => sum + item[1], 0) / object.points.length };
    return { x: object.x || 0, y: object.y || 0 };
  }

  function motionProgress(motion, timeMs, loop = true) {
    const raw = timeMs / motion.periodMs + motion.phase / (Math.PI * 2);
    if (!loop) return clamp(raw, 0, 1);
    const cycle = raw % 1;
    return cycle < 0 ? cycle + 1 : cycle;
  }

  function interpolateFrames(frames, progress) {
    let left = frames[0], right = frames.at(-1);
    if (progress <= left.at) right = left;
    else if (progress >= right.at) left = right;
    else for (let index = 1; index < frames.length; index++) if (frames[index].at >= progress) { left = frames[index - 1]; right = frames[index]; break; }
    const ratio = left === right ? 0 : (progress - left.at) / (right.at - left.at), result = {};
    for (const key of ["x", "y", "rotation", "scale", "opacity"]) {
      const a = finite(left[key]) ? left[key] : key === "scale" || key === "opacity" ? 1 : 0,
        b = finite(right[key]) ? right[key] : a;
      result[key] = a + (b - a) * ratio;
    }
    return result;
  }

  function animationStates(scene, timeMs) {
    const byId = new Map(scene.objects.map((object) => [object.id, object])),
      states = new Map(scene.objects.map((object) => [object.id, { dx: 0, dy: 0, rotation: 0, scale: 1, opacity: 1 }]));
    for (const motion of scene.motions) {
      const target = byId.get(motion.target), state = states.get(motion.target), progress = motionProgress(motion, timeMs, scene.loop);
      if (!target || !state) continue;
      if (motion.type === "orbit") {
        const centerObject = typeof motion.center === "string" ? byId.get(motion.center) : null,
          center = centerObject ? objectAnchor(centerObject) : { x: motion.center[0], y: motion.center[1] },
          anchor = objectAnchor(target), angle = (motion.clockwise ? 1 : -1) * progress * Math.PI * 2;
        state.dx += center.x + Math.cos(angle) * motion.rx - anchor.x;
        state.dy += center.y + Math.sin(angle) * motion.ry - anchor.y;
      } else if (motion.type === "spin") state.rotation += (motion.clockwise ? 1 : -1) * progress * Math.PI * 2;
      else if (motion.type === "translate") {
        const ratio = motion.alternate ? 0.5 - Math.cos(progress * Math.PI * 2) / 2 : progress;
        state.dx += motion.from[0] + (motion.to[0] - motion.from[0]) * ratio;
        state.dy += motion.from[1] + (motion.to[1] - motion.from[1]) * ratio;
      } else if (motion.type === "pulse") state.scale *= motion.from + (motion.to - motion.from) * (0.5 - Math.cos(progress * Math.PI * 2) / 2);
      else if (motion.type === "fade") state.opacity *= motion.from + (motion.to - motion.from) * (0.5 - Math.cos(progress * Math.PI * 2) / 2);
      else {
        const frame = interpolateFrames(motion.frames, progress);
        state.dx += frame.x;
        state.dy += frame.y;
        state.rotation += frame.rotation * Math.PI / 180;
        state.scale *= frame.scale;
        state.opacity *= frame.opacity;
      }
    }
    return states;
  }

  function roundedRect(context, object) {
    if (object.radius && typeof context.roundRect === "function") context.roundRect(object.x, object.y, object.w, object.h, object.radius);
    else context.rect(object.x, object.y, object.w, object.h);
  }

  function drawPath(context, object) {
    const points = object.points;
    context.moveTo(points[0][0], points[0][1]);
    if (!object.smooth || points.length < 3) for (let index = 1; index < points.length; index++) context.lineTo(points[index][0], points[index][1]);
    else {
      for (let index = 1; index < points.length - 1; index++) {
        const item = points[index], next = points[index + 1];
        context.quadraticCurveTo(item[0], item[1], (item[0] + next[0]) / 2, (item[1] + next[1]) / 2);
      }
      context.lineTo(points.at(-1)[0], points.at(-1)[1]);
    }
    if (object.closed) context.closePath();
  }

  function drawShape(context, object) {
    if (object.type === "text") {
      context.fillStyle = object.fill || object.stroke || "#1f2937";
      context.font = object.fontWeight + " " + object.fontSize + "px " + object.fontFamily;
      context.textAlign = object.align;
      context.textBaseline = "middle";
      context.fillText(object.text, object.x, object.y);
      return;
    }
    context.beginPath();
    if (object.type === "circle") context.arc(object.cx, object.cy, object.r, 0, Math.PI * 2);
    else if (object.type === "ellipse") context.ellipse(object.cx, object.cy, object.rx, object.ry, 0, 0, Math.PI * 2);
    else if (object.type === "rect") roundedRect(context, object);
    else if (object.type === "line") { context.moveTo(object.x1, object.y1); context.lineTo(object.x2, object.y2); }
    else if (object.type === "path") drawPath(context, object);
    if (object.fill && object.type !== "line") { context.fillStyle = object.fill; context.fill(); }
    if (object.stroke) { context.strokeStyle = object.stroke; context.lineWidth = object.lineWidth; context.lineCap = context.lineJoin = "round"; context.stroke(); }
  }

  function render(context, scene, timeMs = 0) {
    const normalized = scene?.tool === "animate_scene" && scene.version === 1 ? scene : normalize(scene);
    if (!normalized || !context) return false;
    const byId = new Map(normalized.objects.map((object) => [object.id, object])),
      states = animationStates(normalized, timeMs),
      childIds = new Set(normalized.objects.filter((object) => object.type === "group").flatMap((object) => object.children)),
      rendering = new Set();
    function renderObject(object) {
      if (!object || rendering.has(object.id)) return;
      rendering.add(object.id);
      const state = states.get(object.id) || { dx: 0, dy: 0, rotation: 0, scale: 1, opacity: 1 };
      context.save();
      context.globalAlpha *= object.opacity * state.opacity;
      if (object.type === "group") {
        context.translate(object.x + state.dx, object.y + state.dy);
        context.rotate((object.rotation || 0) * Math.PI / 180 + state.rotation);
        context.scale(object.scale * state.scale, object.scale * state.scale);
        object.children.forEach((id) => renderObject(byId.get(id)));
      } else {
        const anchor = objectAnchor(object);
        context.translate(anchor.x + state.dx, anchor.y + state.dy);
        context.rotate(state.rotation);
        context.scale(state.scale, state.scale);
        context.translate(-anchor.x, -anchor.y);
        drawShape(context, object);
      }
      context.restore();
      rendering.delete(object.id);
    }
    context.save();
    context.beginPath();
    context.rect(0, 0, normalized.w, normalized.h);
    context.clip();
    normalized.objects.filter((object) => !childIds.has(object.id)).forEach(renderObject);
    context.restore();
    return true;
  }

  function rasterize(scene, createCanvas, timeMs = 0, pixelRatio = 1, maxPixels = 4000000) {
    const normalized = scene?.tool === "animate_scene" && scene.version === 1 ? scene : normalize(scene);
    if (!normalized || typeof createCanvas !== "function") return null;
    const ratio = Math.max(0.1, Math.min(pixelRatio, 2048 / normalized.w, 1536 / normalized.h, Math.sqrt(maxPixels / (normalized.w * normalized.h)))),
      canvas = createCanvas(Math.max(1, Math.ceil(normalized.w * ratio)), Math.max(1, Math.ceil(normalized.h * ratio))),
      context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    render(context, normalized, timeMs);
    canvas.logicalWidth = normalized.w;
    canvas.logicalHeight = normalized.h;
    return canvas;
  }

  function serialize(scene) {
    const normalized = scene?.tool === "animate_scene" && scene.version === 1 ? scene : normalize(scene);
    if (!normalized) return null;
    const { dynamicObjectCount, background, ...plain } = normalized;
    return JSON.parse(JSON.stringify(plain));
  }

  return { normalize, render, rasterize, serialize, animationStates, objectAnchor, MAX_OBJECTS, MAX_MOTIONS };
});
