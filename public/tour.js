"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PENECHO_TOUR = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  const SCHEMA = 1;

  function parseProgress(raw) {
    let value = raw;
    if (typeof raw === "string") {
      try {
        value = JSON.parse(raw);
      } catch {
        value = null;
      }
    }
    const seen = Array.isArray(value?.seen)
      ? [...new Set(value.seen.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 120))].slice(-512)
      : [];
    return { schema: SCHEMA, seen };
  }

  function serializeProgress(progress) {
    return JSON.stringify(parseProgress(progress));
  }

  function markSeen(progress, ids) {
    const current = parseProgress(progress),
      additions = [...new Set((Array.isArray(ids) ? ids : [ids]).filter((id) => typeof id === "string" && id.length > 0 && id.length <= 120))],
      refreshed = new Set(additions);
    return parseProgress({ seen: [...current.seen.filter((id) => !refreshed.has(id)), ...additions] });
  }

  function unseenSteps(steps, progress, forceAll = false) {
    const list = Array.isArray(steps) ? steps.filter((step) => step && typeof step.id === "string" && step.id) : [];
    if (forceAll) return list.slice();
    const seen = new Set(parseProgress(progress).seen);
    return list.filter((step) => !seen.has(step.id));
  }

  function resolveInitialLanguage(primaryStored, legacyStored) {
    const normalize = (value) => (value === "en" || value === "zh" ? value : null),
      stored = normalize(primaryStored) ?? normalize(legacyStored);
    return stored || "en";
  }

  function finiteRect(rect) {
    if (!rect) return null;
    const left = Number(rect.left ?? rect.x),
      top = Number(rect.top ?? rect.y),
      width = Number(rect.width ?? (Number(rect.right) - left)),
      height = Number(rect.height ?? (Number(rect.bottom) - top));
    if (![left, top, width, height].every(Number.isFinite) || width < 0 || height < 0) return null;
    return { left, top, right: left + width, bottom: top + height, width, height };
  }

  function unionRects(rects) {
    const valid = (Array.isArray(rects) ? rects : []).map(finiteRect).filter(Boolean);
    if (!valid.length) return null;
    const left = Math.min(...valid.map((rect) => rect.left)),
      top = Math.min(...valid.map((rect) => rect.top)),
      right = Math.max(...valid.map((rect) => rect.right)),
      bottom = Math.max(...valid.map((rect) => rect.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function rectHasArea(rect) {
    const value = finiteRect(rect);
    return Boolean(value && value.width > 0 && value.height > 0);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(Math.max(minimum, maximum), value));
  }

  function viewportRect(viewport) {
    const left = Number(viewport?.left ?? viewport?.offsetLeft ?? 0),
      top = Number(viewport?.top ?? viewport?.offsetTop ?? 0),
      width = Math.max(1, Number(viewport?.width ?? 1)),
      height = Math.max(1, Number(viewport?.height ?? 1));
    return { left, top, right: left + width, bottom: top + height, width, height };
  }

  function placeCoachmark(targetRect, cardSize, viewport, preferred = "auto", options = {}) {
    const target = finiteRect(targetRect),
      view = viewportRect(viewport),
      card = { width: Math.max(1, Number(cardSize?.width || 1)), height: Math.max(1, Number(cardSize?.height || 1)) },
      margin = Math.max(0, Number(options.margin ?? 12)),
      gap = Math.max(0, Number(options.gap ?? 14)),
      arrowMargin = Math.max(12, Number(options.arrowMargin ?? 22));
    if (!target) return { x: view.left + margin, y: view.top + margin, placement: "center", arrowOffset: 0 };
    if (preferred === "center") {
      return {
        x: clamp(target.left + (target.width - card.width) / 2, view.left + margin, view.right - margin - card.width),
        y: clamp(target.top + (target.height - card.height) / 2, view.top + margin, view.bottom - margin - card.height),
        placement: "center",
        arrowOffset: 0,
      };
    }
    const spaces = {
        bottom: view.bottom - target.bottom - gap - margin,
        top: target.top - view.top - gap - margin,
        right: view.right - target.right - gap - margin,
        left: target.left - view.left - gap - margin,
      },
      fits = {
        bottom: spaces.bottom >= card.height,
        top: spaces.top >= card.height,
        right: spaces.right >= card.width,
        left: spaces.left >= card.width,
      },
      opposite = { bottom: "top", top: "bottom", right: "left", left: "right" },
      axes = ["bottom", "top", "right", "left"],
      order = axes.includes(preferred) ? [preferred, opposite[preferred], ...axes.filter((item) => item !== preferred && item !== opposite[preferred])] : axes,
      placement = order.find((item) => fits[item]) || order.reduce((best, item) => (spaces[item] > spaces[best] ? item : best), order[0]);
    let x,
      y,
      arrowOffset;
    if (placement === "bottom" || placement === "top") {
      x = clamp(target.left + (target.width - card.width) / 2, view.left + margin, view.right - margin - card.width);
      y = placement === "bottom" ? target.bottom + gap : target.top - gap - card.height;
      y = clamp(y, view.top + margin, view.bottom - margin - card.height);
      arrowOffset = clamp(target.left + target.width / 2 - x, arrowMargin, card.width - arrowMargin);
    } else {
      x = placement === "right" ? target.right + gap : target.left - gap - card.width;
      y = clamp(target.top + (target.height - card.height) / 2, view.top + margin, view.bottom - margin - card.height);
      x = clamp(x, view.left + margin, view.right - margin - card.width);
      arrowOffset = clamp(target.top + target.height / 2 - y, arrowMargin, card.height - arrowMargin);
    }
    return { x, y, placement, arrowOffset };
  }

  function keyAction(event) {
    if (!event || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return null;
    if (event.key === "Escape") return "skip";
    if (event.key === "ArrowRight" || event.key === "Enter") return "next";
    if (event.key === "ArrowLeft") return "back";
    return null;
  }

  return { SCHEMA, parseProgress, serializeProgress, markSeen, unseenSteps, resolveInitialLanguage, unionRects, rectHasArea, placeCoachmark, keyAction };
});
