"use strict";
(() => {
  const SIZE = 20000,
    TILE = 512,
    MAX_ATLAS_WIDTH = 2048,
    MAX_ATLAS_HEIGHT = 1536,
    FOCUS_INSET_ENABLED = false,
    MAX_LASSO_POINTS = 4096,
    MAX_HISTORY = 30,
    DEFAULT_AUTO_DELAY = 1200,
    DEFAULT_AI_TIMEOUT = 260000,
    screen = document.querySelector("#screen"),
    view = document.querySelector("#viewport"),
    ctx = screen.getContext("2d"),
    status = document.querySelector("#status"),
    coords = document.querySelector("#coords"),
    debugList = document.querySelector("#debugEvents"),
    debugRequest = document.querySelector("#debugRequest"),
    embodiment = document.querySelector("#aiEmbodiment"),
    aiOrb = document.querySelector("#aiOrb"),
    aiRadial = document.querySelector("#aiRadial");
  const ZH = window.PENECHO_LOCALES?.zh || {};
  const DRAW = window.PENECHO_DRAW;
  const SELECT = window.PENECHO_SELECTION;
  const I18N = {
    en: {
      title: "PenEcho | Handwritten AI Canvas",
      tagline: "Write across twenty thousand squares and summon knowledge",
      taglineArcane: "Interdisciplinary intuition, creative synthesis, and exploratory explanation",
      taglineScifi: "Engineering, programming, system design, and future-technology analysis",
      taglineResearch: "Mathematical physics, rigorous teaching, and verifiable code",
      language: "Language",
      theme: "Theme",
      themeArcane: "Arcane",
      themeScifi: "Sci-fi",
      themeResearch: "Research",
      themeFocusArcane: "Favors interdisciplinary insight, intuitive analogy, and creative exploration",
      themeFocusScifi: "Favors engineering, debugging, system design, and future technology",
      themeFocusResearch: "Favors mathematical physics, rigorous derivation, teaching, and code verification",
      guideArcane: "Arcane knowledge crystal",
      guideScifi: "Holographic analysis core",
      guideResearch: "Einstein scientific mentor",
      boardTools: "Board tools",
      pen: "Pen",
      eraser: "Eraser",
      select: "Lasso select",
      penSize: "Pen size",
      autoAI: "Auto AI",
      autoEnabled: "Auto AI ({delay}s)",
      autoDisabled: "Manual AI",
      autoDelay: "Auto AI delay",
      grid: "Canvas grid",
      gridOn: "Show canvas grid",
      gridOff: "Hide canvas grid",
      researchGridDefault: "Research grid (off by default)",
      aiFont: "AI font",
      inkColor: "Ink color",
      fontRounded: "Rounded",
      fontHand: "Handwritten",
      fontSerif: "Classic serif",
      fontSans: "Sans serif",
      aiColor: "AI color",
      colorBlue: "Blue",
      colorBlack: "Ink black",
      colorRed: "Red",
      colorOrange: "Orange",
      colorGold: "Gold",
      colorGreen: "Green",
      colorCyan: "Cyan",
      colorPurple: "Purple",
      undo: "Undo",
      redo: "Redo",
      fullscreen: "Fullscreen",
      exitFullscreen: "Exit fullscreen",
      clear: "Clear",
      debug: "Debug",
      canvas: "Zoomable handwritten AI canvas",
      aiGuide: "AI knowledge guide",
      openAIMenu: "Open AI action menu",
      aiActions: "AI actions",
      answer: "Answer",
      hint: "Hint",
      continue: "Continue",
      explain: "Explain",
      plot: "Plot",
      tip: "Stylus writes · finger pans · pinch zooms · wheel zooms · middle or Alt drag pans",
      debugTitle: "PenEcho debug",
      openLocalLog: "Open local server log",
      history: "Local history",
      historyTitle: "Local canvas history",
      historyDescription: "Stores confirmed canvas content only. Unconfirmed AI drafts are excluded.",
      closeHistory: "Close history",
      newCanvas: "New",
      newCanvasTitle: "Start a new canvas?",
      newCanvasDescription: "Save confirmed content before starting over. Unconfirmed AI drafts are not included.",
      currentSnapshot: "Current snapshot: {name}",
      noCurrentSnapshot: "There is no current snapshot to overwrite.",
      newSnapshotName: "Name for new snapshot (optional)",
      cancel: "Cancel",
      newWithoutSave: "Don't save",
      saveAsNewAndCreate: "Save as new",
      overwriteAndCreate: "Overwrite current",
      snapshotName: "Snapshot name (optional)",
      saveSnapshot: "Save canvas",
      loadSnapshot: "Load",
      deleteSnapshot: "Delete",
      emptyHistory: "No local snapshots yet",
      emptyCanvas: "The canvas is empty",
      snapshotSaved: "Canvas snapshot saved",
      snapshotOverwritten: "Current snapshot overwritten",
      snapshotLoaded: "Canvas snapshot loaded",
      snapshotDeleted: "Canvas snapshot deleted",
      newCanvasReady: "New canvas ready",
      snapshotError: "Local history: ",
      snapshotTiles: "canvas tiles",
      deleteSnapshotConfirm: "Delete this local snapshot?",
      footerTip: "AI drafts: move the whole group or adjust, accept, and discard items independently",
      ready: "Ready",
      aiBusy: "AI is working. Please wait.",
      noInk: "Write something first",
      cannotCapture: "Could not capture the newest handwriting",
      observing: "Observing...",
      deferred: "New ink found; this AI result was deferred",
      writing: "Writing...",
      aiDone: "AI complete",
      draftRejected: "AI draft discarded",
      draftFading: "Continued writing detected; fading the AI draft",
      canvasChanged: "Canvas changed; the old AI draft was discarded",
      draftReady: "AI draft is ready to adjust",
      batchDraftReady: "AI items can be moved together or adjusted, accepted, and discarded individually",
      itemAccepted: "AI item accepted; remaining drafts are still editable",
      itemDiscarded: "AI item discarded; remaining drafts are still editable",
      rejectBatch: "Discard all AI drafts",
      acceptBatch: "Accept all AI drafts",
      outsideCanvas: "This is outside the canvas. Write on the paper.",
      selectionEmpty: "The selected area has no ink",
      selectionTooSmall: "Draw a larger closed lasso around some ink",
      selectionReady: "Move, resize, recolor, accept, or cancel the selection",
      selectionCommitted: "Selection applied locally",
      selectionCancelled: "Selection cancelled",
      selectionRecolored: "Selection color changed locally",
      pendingConfirm: "Confirm or discard the current AI draft first",
      merged: "AI merged",
      clearConfirm: "Clear the whole canvas?",
      timeout: "Request timed out",
      aiError: "AI: ",
    },
    zh: ZH,
  };
  const storedLanguage = localStorage.getItem("penecho-language") || localStorage.getItem("ghostboard-language"),
    storedTheme = localStorage.getItem("penecho-theme") || localStorage.getItem("ghostboard-theme"),
    storedGrid = localStorage.getItem("penecho-grid") ?? localStorage.getItem("ghostboard-grid"),
    storedResearchGrid = localStorage.getItem("penecho-research-grid"),
    storedAutoEnabled = localStorage.getItem("penecho-auto-ai"),
    storedAutoDelayText = localStorage.getItem("penecho-auto-delay-ms"),
    storedAutoDelay = storedAutoDelayText === null ? NaN : Number(storedAutoDelayText),
    initialLanguage = storedLanguage === "zh" ? "zh" : "en",
    initialTheme = ["arcane", "scifi", "research"].includes(storedTheme) ? storedTheme : "arcane",
    initialGrid = storedGrid === null ? true : storedGrid === "true",
    initialResearchGrid = storedResearchGrid === "true",
    configuredAutoDelay = Number(window.PENECHO_CONFIG?.autoAiDelayMs),
    configuredAiTimeout = Number(window.PENECHO_CONFIG?.aiRequestTimeoutMs),
    serverAutoDelay = Number.isFinite(configuredAutoDelay) && configuredAutoDelay >= 0 ? configuredAutoDelay : DEFAULT_AUTO_DELAY,
    initialAutoDelay = Number.isFinite(storedAutoDelay) && storedAutoDelay >= 0 && storedAutoDelay <= 10000 ? storedAutoDelay : Math.min(10000, serverAutoDelay),
    initialAutoEnabled = storedAutoEnabled === null ? true : storedAutoEnabled === "true",
    initialAiTimeout = Number.isFinite(configuredAiTimeout) && configuredAiTimeout >= 10000 ? configuredAiTimeout : DEFAULT_AI_TIMEOUT;
  const tiles = new Map(),
    state = {
      mode: "pen",
      scale: 0.1,
      panX: 0,
      panY: 0,
      pen: 4,
      eraser: 35,
      aiFont: "ui-rounded, system-ui, sans-serif",
      inkColor: "#1f2937",
      aiColor: "#2563eb",
      drawing: null,
      pointers: new Map(),
      touches: new Map(),
      touchGesture: null,
      panGesture: null,
      pending: null,
      pendingGesture: null,
      selection: null,
      selectionGesture: null,
      hotspotTrail: [],
      auto: initialAutoEnabled,
      timer: 0,
      autoPopoverTimer: 0,
      autoDelayMs: initialAutoDelay,
      aiRequestTimeoutMs: initialAiTimeout,
      dirty: null,
      autoEligible: false,
      lastUserBox: null,
      history: [],
      future: [],
      historyBefore: new Map(),
      inkBounds: new Map(),
      busy: false,
      activeAI: null,
      snapshotLoadGeneration: 0,
      currentSnapshotId: null,
      currentSnapshotName: "",
      restoreGeneration: 0,
      recognitionGeneration: 0,
      userRevision: 0,
      lastRequestId: "—",
      viewInitialized: false,
      renderQueued: false,
      language: initialLanguage,
      theme: initialTheme,
      gridVisible: initialTheme === "research" ? initialResearchGrid : initialGrid,
      paint: { paper: "#ead9ad", paperGrid: "#c8ae7155", outside: "#090814", border: "#7f693b" },
      navigationTimer: 0,
      radialGesture: null,
      radialCloseTimer: 0,
      radialSuppressClickUntil: 0,
      statusKey: "ready",
    };
  const AI_CANCELLED = "AI_CANCELLED";
  const AI_REJECTED = "AI_REJECTED";
  const AI_SUPERSEDED = "AI_SUPERSEDED";
  const COLOR_CLASS = { "#2563eb": "color-blue", "#1f2937": "color-black", "#dc2626": "color-red", "#ea580c": "color-orange", "#ca8a04": "color-gold", "#16a34a": "color-green", "#0891b2": "color-cyan", "#9333ea": "color-purple" };
  const setStatus = (text, key = null) => {
    status.textContent = text;
    state.statusKey = key;
  };
  const setStatusKey = (key) => setStatus(t(key), key);
  const t = (key) => I18N[state.language][key] || I18N.zh[key] || key;
  function autoDelayText() {
    const seconds = state.autoDelayMs / 1000;
    return Number.isInteger(seconds) ? String(seconds) : String(Number(seconds.toFixed(1)));
  }
  function updateAutoControl() {
    const button = document.querySelector("#auto"),
      range = document.querySelector("#autoDelayRange"),
      value = document.querySelector("#autoDelayValue");
    button.classList.toggle("active", state.auto);
    button.setAttribute("aria-pressed", String(state.auto));
    document.querySelector("#autoLabel").textContent = state.auto ? t("autoEnabled").replace("{delay}", autoDelayText()) : t("autoDisabled");
    range.value = String(state.autoDelayMs / 1000);
    value.textContent = `${autoDelayText()} s`;
  }
  function hideAutoDelayControl() {
    clearTimeout(state.autoPopoverTimer);
    state.autoPopoverTimer = 0;
    document.querySelector("#autoDelayPopover").hidden = true;
    document.querySelector("#auto").setAttribute("aria-expanded", "false");
  }
  function keepAutoDelayControlOpen() {
    clearTimeout(state.autoPopoverTimer);
    state.autoPopoverTimer = setTimeout(hideAutoDelayControl, 5000);
  }
  function showAutoDelayControl() {
    document.querySelector("#autoDelayPopover").hidden = false;
    document.querySelector("#auto").setAttribute("aria-expanded", "true");
    keepAutoDelayControlOpen();
  }
  function setAutoEnabled(enabled, showDelay = false) {
    state.auto = enabled;
    clearTimeout(state.timer);
    state.timer = 0;
    localStorage.setItem("penecho-auto-ai", String(enabled));
    updateAutoControl();
    if (enabled) {
      schedule();
      if (showDelay) showAutoDelayControl();
    } else hideAutoDelayControl();
  }
  function updatePaint() {
    const css = getComputedStyle(document.body);
    state.paint = {
      paper: css.getPropertyValue("--paper").trim() || "#ead9ad",
      paperGrid: css.getPropertyValue("--paper-grid").trim() || "#c8ae7155",
      outside: css.getPropertyValue("--outside").trim() || "#090814",
      border: css.getPropertyValue("--line").trim() || "#7f693b",
    };
  }
  function applyLanguage() {
    document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
    document.title = t("title");
    document.querySelectorAll("[data-i18n]").forEach((node) => (node.textContent = t(node.dataset.i18n)));
    document.querySelectorAll("[data-i18n-aria]").forEach((node) => node.setAttribute("aria-label", t(node.dataset.i18nAria)));
    document.querySelectorAll("[data-i18n-title]").forEach((node) => node.setAttribute("title", t(node.dataset.i18nTitle)));
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder)));
    document.querySelectorAll("[data-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.language === state.language)));
    updateAutoControl();
    updateFullscreenButton();
    updateThemeCopy();
    updateEmbodimentLabel();
    updateGridButton();
    renderSnapshotList();
    updateNewCanvasDialog();
    if (state.statusKey) status.textContent = t(state.statusKey);
  }
  function updateThemeCopy() {
    const key = { arcane: "taglineArcane", scifi: "taglineScifi", research: "taglineResearch" }[state.theme];
    document.querySelector("[data-i18n=tagline]").textContent = t(key);
    const focus = t({ arcane: "themeFocusArcane", scifi: "themeFocusScifi", research: "themeFocusResearch" }[state.theme]);
    document.querySelector("#theme").setAttribute("title", focus);
    document.querySelector("#theme").setAttribute("aria-description", focus);
  }
  function updateEmbodimentLabel() {
    const label = t({ arcane: "guideArcane", scifi: "guideScifi", research: "guideResearch" }[state.theme]);
    embodiment.setAttribute("aria-label", label);
    aiOrb.setAttribute("title", label);
  }
  function updateFullscreenButton() {
    const button = document.querySelector("#fullscreenBtn");
    if (!button) return;
    const active = Boolean(document.fullscreenElement);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", t(active ? "exitFullscreen" : "fullscreen"));
    button.setAttribute("title", t(active ? "exitFullscreen" : "fullscreen"));
    document.body.classList.toggle("is-fullscreen", active);
  }
  function updateBatchActions() {
    const actions = document.querySelector("#batchActions");
    if (actions) actions.hidden = !state.pending?.items || state.pending.fading;
  }
  function updateGridButton() {
    const button = document.querySelector("#gridToggle"),
      visible = state.gridVisible,
      label = t(visible ? "gridOff" : "gridOn");
    button.disabled = false;
    button.classList.toggle("active", visible);
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  }
  function applyTheme(theme) {
    state.theme = theme;
    document.body.dataset.theme = theme;
    embodiment.dataset.theme = theme;
    document.querySelector("#theme").value = theme;
    localStorage.setItem("penecho-theme", theme);
    if (theme === "research") state.gridVisible = localStorage.getItem("penecho-research-grid") === "true";
    else state.gridVisible = (localStorage.getItem("penecho-grid") ?? localStorage.getItem("ghostboard-grid")) !== "false";
    updateThemeCopy();
    updateEmbodimentLabel();
    updateGridButton();
    updatePaint();
    requestRender();
  }
  function setBusy(value) {
    state.busy = Boolean(value);
    embodiment.classList.toggle("working", state.busy);
    embodiment.setAttribute("aria-busy", String(state.busy));
  }
  function setNavigating(value) {
    clearTimeout(state.navigationTimer);
    if (value) view.classList.add("is-navigating");
    else view.classList.remove("is-navigating");
  }
  function wheelNavigating() {
    setNavigating(true);
    state.navigationTimer = setTimeout(() => setNavigating(false), 700);
  }
  function invokeAIAction(action) {
    if (state.selection) commitSelection();
    supersedeActiveAI("manual-action");
    requestAI(action);
  }
  function openRadialMenu() {
    clearTimeout(state.radialCloseTimer);
    embodiment.classList.add("menu-open");
    aiOrb.setAttribute("aria-expanded", "true");
    aiRadial.setAttribute("aria-hidden", "false");
    document.querySelectorAll(".radial-action").forEach((button) => button.setAttribute("tabindex", "0"));
  }
  function closeRadialMenu() {
    if (state.radialGesture) return;
    embodiment.classList.remove("menu-open");
    aiOrb.setAttribute("aria-expanded", "false");
    aiRadial.setAttribute("aria-hidden", "true");
    document.querySelectorAll(".radial-action").forEach((button) => {
      button.classList.remove("is-highlighted");
      button.setAttribute("tabindex", "-1");
    });
  }
  function chooseRadialAction(clientX, clientY) {
    const orbRect = aiOrb.getBoundingClientRect(),
      origin = { x: orbRect.left + orbRect.width / 2, y: orbRect.top + orbRect.height / 2 },
      pointerDistance = Math.hypot(clientX - origin.x, clientY - origin.y);
    let selected = null,
      angleDistance = Infinity;
    if (pointerDistance < 22) {
      document.querySelectorAll(".radial-action").forEach((button) => button.classList.remove("is-highlighted"));
      return null;
    }
    const pointerAngle = Math.atan2(clientY - origin.y, clientX - origin.x);
    document.querySelectorAll(".radial-action").forEach((button) => {
      const r = button.getBoundingClientRect(),
        buttonAngle = Math.atan2(r.top + r.height / 2 - origin.y, r.left + r.width / 2 - origin.x),
        next = Math.abs(Math.atan2(Math.sin(pointerAngle - buttonAngle), Math.cos(pointerAngle - buttonAngle)));
      if (next < angleDistance) {
        angleDistance = next;
        selected = button;
      }
    });
    if (angleDistance > 0.42) selected = null;
    document.querySelectorAll(".radial-action").forEach((button) => button.classList.toggle("is-highlighted", button === selected));
    return selected;
  }
  function debug(event, details = {}) {
    const item = document.createElement("li");
    item.textContent = `${new Date().toLocaleTimeString()} ${event} ${JSON.stringify(details)}`;
    debugList.prepend(item);
    while (debugList.children.length > 30) debugList.lastChild.remove();
    fetch("/api/debug/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ event, details }),
    }).catch(() => {});
  }
  function rememberRequest(id) {
    if (!id) return;
    state.lastRequestId = id;
    debugRequest.textContent = `request: ${id}`;
  }
  const key = (x, y) => `${x},${y}`;
  function tile(tx, ty, create = true) {
    const k = key(tx, ty);
    if (!tiles.has(k) && create) {
      const c = document.createElement("canvas");
      c.width = c.height = TILE;
      c.getContext("2d", { willReadFrequently: true });
      tiles.set(k, c);
      state.inkBounds.set(k, null);
    }
    return tiles.get(k);
  }
  function requestRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      render();
    });
  }
  function forTiles(x, y, w, h, fn, create = true) {
    if (w <= 0 || h <= 0) return;
    const x0 = Math.max(0, Math.floor(x / TILE)),
      y0 = Math.max(0, Math.floor(y / TILE)),
      x1 = Math.min(Math.ceil(SIZE / TILE) - 1, Math.ceil((x + w) / TILE) - 1),
      y1 = Math.min(Math.ceil(SIZE / TILE) - 1, Math.ceil((y + h) / TILE) - 1);
    if (x1 < x0 || y1 < y0) return;
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const c = tile(tx, ty, create);
        if (c) fn(c, tx, ty);
      }
  }
  function fit() {
    const r = view.getBoundingClientRect(),
      d = devicePixelRatio || 1;
    screen.width = Math.round(r.width * d);
    screen.height = Math.round(r.height * d);
    if (!state.viewInitialized && r.width > 0 && r.height > 0) {
      state.scale = Math.max(0.03, Math.min(2, Math.max(r.width, r.height) / 10000));
      state.panX = (r.width - SIZE * state.scale) / 2;
      state.panY = (r.height - SIZE * state.scale) / 2;
      state.viewInitialized = true;
    }
    updateCoordinates();
    requestRender();
  }
  function updateCoordinates() {
    const r = view.getBoundingClientRect(),
      x = (r.width / 2 - state.panX) / state.scale,
      y = (r.height / 2 - state.panY) / state.scale;
    coords.textContent = `x ${Math.round(x)} · y ${Math.round(y)} · ${Math.round(state.scale * 100)}%`;
  }
  function render() {
    const d = devicePixelRatio || 1,
      r = view.getBoundingClientRect();
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.fillStyle = state.paint.outside;
    ctx.fillRect(0, 0, r.width, r.height);
    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.scale, state.scale);
    ctx.fillStyle = state.paint.paper;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const l = Math.max(0, -state.panX / state.scale),
      t = Math.max(0, -state.panY / state.scale),
      rr = Math.min(SIZE, (r.width - state.panX) / state.scale),
      b = Math.min(SIZE, (r.height - state.panY) / state.scale);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SIZE, SIZE);
    ctx.clip();
    if (state.gridVisible) {
      ctx.strokeStyle = state.paint.paperGrid;
      ctx.lineWidth = 1 / state.scale;
      ctx.beginPath();
      for (let x = Math.floor(l / 500) * 500; x < rr; x += 500) {
        ctx.moveTo(x, t);
        ctx.lineTo(x, b);
      }
      for (let y = Math.floor(t / 500) * 500; y < b; y += 500) {
        ctx.moveTo(l, y);
        ctx.lineTo(rr, y);
      }
      ctx.stroke();
    }
    forTiles(l, t, rr - l, b - t, (c, tx, ty) => ctx.drawImage(c, tx * TILE, ty * TILE), false);
    if (state.drawing?.preview) drawPreview(state.drawing.preview);
    if (state.selection) drawSelection(state.selection);
    ctx.restore();
    ctx.strokeStyle = state.paint.border;
    ctx.lineWidth = 2 / state.scale;
    ctx.strokeRect(0, 0, SIZE, SIZE);
    if (state.pending) {
      ctx.save();
      ctx.globalAlpha = 1 - (state.pending.fadeProgress || 0);
      drawPending(state.pending);
      ctx.restore();
    }
    ctx.restore();
  }
  function clientPoint(e) {
    const r = view.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - state.panX) / state.scale,
      y: (e.clientY - r.top - state.panY) / state.scale,
    };
  }
  function setCanvasCursor(cursor) {
    screen.classList.remove("cursor-crosshair", "cursor-grab", "cursor-grabbing", "cursor-nwse-resize", "cursor-ew-resize", "cursor-ns-resize");
    screen.classList.add(`cursor-${cursor}`);
  }
  function beginTouchGesture() {
    if (state.touches.size < 2) return;
    const ids = [...state.touches.keys()].slice(0, 2),
      points = ids.map((id) => state.touches.get(id));
    state.touchGesture = {
      ids,
      center: {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      },
      distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
      scale: state.scale,
      panX: state.panX,
      panY: state.panY,
    };
    state.panGesture = null;
  }
  function updateTouchGesture() {
    const g = state.touchGesture;
    if (!g) return false;
    const points = g.ids.map((id) => state.touches.get(id));
    if (points.some((p) => !p)) return false;
    const center = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      },
      distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
      r = view.getBoundingClientRect(),
      next = Math.max(0.03, Math.min(2, (g.scale * distance) / g.distance)),
      anchorX = (g.center.x - r.left - g.panX) / g.scale,
      anchorY = (g.center.y - r.top - g.panY) / g.scale;
    state.scale = next;
    state.panX = center.x - r.left - anchorX * next;
    state.panY = center.y - r.top - anchorY * next;
    updateCoordinates();
    setNavigating(true);
    render();
    return true;
  }
  function moveCanvas(dx, dy) {
    state.panX += dx;
    state.panY += dy;
    updateCoordinates();
    requestRender();
  }
  function valid(p) {
    return p.x >= 0 && p.x <= SIZE && p.y >= 0 && p.y <= SIZE;
  }
  function mergeDirty(x, y, p = 10) {
    const a = {
      x: Math.max(0, x - p),
      y: Math.max(0, y - p),
      w: Math.min(SIZE, x + p) - Math.max(0, x - p),
      h: Math.min(SIZE, y + p) - Math.max(0, y - p),
    };
    if (!state.dirty) state.dirty = a;
    else {
      const b = state.dirty,
        x1 = Math.min(a.x, b.x),
        y1 = Math.min(a.y, b.y),
        x2 = Math.max(a.x + a.w, b.x + b.w),
        y2 = Math.max(a.y + a.h, b.y + b.h);
      state.dirty = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
  }
  function restoreDirty(box) {
    if (!box) return;
    if (!state.dirty) {
      state.dirty = box;
      return;
    }
    const x = Math.min(box.x, state.dirty.x),
      y = Math.min(box.y, state.dirty.y),
      right = Math.max(box.x + box.w, state.dirty.x + state.dirty.w),
      bottom = Math.max(box.y + box.h, state.dirty.y + state.dirty.h);
    state.dirty = { x, y, w: right - x, h: bottom - y };
  }
  function discardUncapturableInput(hotspotCount, usedDirty) {
    if (hotspotCount) state.hotspotTrail.splice(0, hotspotCount);
    state.dirty = null;
    state.autoEligible = false;
    if (!usedDirty) state.lastUserBox = null;
  }
  function invalidateRecognition() {
    const active=state.activeAI;
    if(active&&!active.superseded){active.superseded=true;active.dirtyRestored=true;active.controller.abort();if(state.activeAI===active){state.activeAI=null;setBusy(false)}}
    clearTimeout(state.timer);
    state.timer = 0;
    state.recognitionGeneration++;
    state.hotspotTrail = [];
    state.dirty = null;
    state.autoEligible = false;
    state.lastUserBox = null;
  }
  function cloneCanvas(source) {
    if (!source) return null;
    const copy = document.createElement("canvas");
    copy.width = copy.height = TILE;
    copy.getContext("2d").drawImage(source, 0, 0);
    return copy;
  }
  const SNAPSHOT_DB = "penecho-canvas-history",
    SNAPSHOT_STORE = "snapshots",
    SNAPSHOT_TILE_STORE = "snapshot-tiles";
  let snapshotDbPromise = null,
    snapshotItems = [];
  function snapshotDb() {
    if (snapshotDbPromise) return snapshotDbPromise;
    snapshotDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(SNAPSHOT_DB, 2);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(SNAPSHOT_TILE_STORE)) {
          const store = db.createObjectStore(SNAPSHOT_TILE_STORE, { keyPath: "id" });
          store.createIndex("snapshotId", "snapshotId", { unique: false });
        }
        if (event.oldVersion === 1) request.transaction.objectStore(SNAPSHOT_STORE).clear();
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || Error("Could not open IndexedDB"));
    });
    return snapshotDbPromise;
  }
  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(Error("Could not encode canvas"))), "image/png"));
  }
  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || Error("IndexedDB request failed"));
    });
  }
  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () => reject(transaction.error || Error("IndexedDB transaction failed"));
    });
  }
  async function allSnapshots() {
    const db = await snapshotDb(),
      items = await requestResult(db.transaction(SNAPSHOT_STORE, "readonly").objectStore(SNAPSHOT_STORE).getAll());
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }
  function snapshotPreview() {
    const preview = offscreen(180, 120),
      q = preview.getContext("2d"),
      bounds = visibleInkBounds({ x: 0, y: 0, w: SIZE, h: SIZE });
    q.fillStyle = state.paint.paper;
    q.fillRect(0, 0, preview.width, preview.height);
    if (!bounds) return preview;
    const pad = 8,
      scale = Math.min((preview.width - pad * 2) / bounds.w, (preview.height - pad * 2) / bounds.h),
      dx = (preview.width - bounds.w * scale) / 2,
      dy = (preview.height - bounds.h * scale) / 2;
    for (const [k, canvas] of tiles) {
      const [tx, ty] = k.split(",").map(Number),
        x = tx * TILE,
        y = ty * TILE;
      if (!intersection({ x, y, w: TILE, h: TILE }, bounds)) continue;
      q.drawImage(canvas, dx + (x - bounds.x) * scale, dy + (y - bounds.y) * scale, TILE * scale, TILE * scale);
    }
    return preview;
  }
  function imageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob),
        image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(Error("Could not decode snapshot tile"));
      };
      image.src = url;
    });
  }
  async function saveSnapshot({ overwriteId = null, name = null } = {}) {
    if (state.selection) commitSelection();
    if (!tiles.size) {
      setStatusKey("emptyCanvas");
      return null;
    }
    const nameInput = document.querySelector("#historyName"),
      existing = overwriteId ? snapshotItems.find((item) => item.id === overwriteId) : null,
      id = overwriteId || `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
      createdAt = Date.now(),
      tileEntries = await Promise.all([...tiles].map(async ([k, canvas]) => ({ k, blob: await canvasBlob(canvas) }))),
      preview = await canvasBlob(snapshotPreview()),
      requestedName = String(name === null ? nameInput.value : name).trim().slice(0, 48),
      item = {
        id,
        createdAt,
        name: requestedName || (overwriteId ? (existing ? existing.name : state.currentSnapshotName) : ""),
        theme: state.theme,
        view: { scale: state.scale, panX: state.panX, panY: state.panY },
        tileCount: tileEntries.length,
        preview,
      },
      db = await snapshotDb();
    if (overwriteId && !existing && overwriteId !== state.currentSnapshotId) throw Error(t("noCurrentSnapshot"));
    let oldTileKeys = [];
    if (overwriteId) oldTileKeys = await requestResult(db.transaction(SNAPSHOT_TILE_STORE, "readonly").objectStore(SNAPSHOT_TILE_STORE).index("snapshotId").getAllKeys(overwriteId));
    const transaction = db.transaction([SNAPSHOT_STORE, SNAPSHOT_TILE_STORE], "readwrite");
    transaction.objectStore(SNAPSHOT_STORE).put(item);
    const tileStore = transaction.objectStore(SNAPSHOT_TILE_STORE);
    oldTileKeys.forEach((key) => tileStore.delete(key));
    tileEntries.forEach(({ k, blob }) => tileStore.put({ id: `${id}:${k}`, snapshotId: id, k, blob }));
    await transactionDone(transaction);
    nameInput.value = "";
    state.currentSnapshotId = id;
    state.currentSnapshotName = snapshotName(item);
    await refreshSnapshots();
    setStatusKey(overwriteId ? "snapshotOverwritten" : "snapshotSaved");
    return id;
  }
  async function loadSnapshot(id) {
    const loadGeneration=++state.snapshotLoadGeneration;
    if (state.selection) cancelSelection(true);
    state.userRevision++;
    invalidateRecognition();
    cancelPendingForRevision();
    const expectedRevision=state.userRevision;
    const db = await snapshotDb(),
      transaction = db.transaction([SNAPSHOT_STORE, SNAPSHOT_TILE_STORE], "readonly"),
      itemRequest = transaction.objectStore(SNAPSHOT_STORE).get(id),
      tilesRequest = transaction.objectStore(SNAPSHOT_TILE_STORE).index("snapshotId").getAll(id),
      [item, tileEntries] = await Promise.all([requestResult(itemRequest), requestResult(tilesRequest)]);
    if (!item) return;
    const decoded = await Promise.all(tileEntries.map(async ({ k, blob }) => ({ k, image: await imageFromBlob(blob) })));
    if(loadGeneration!==state.snapshotLoadGeneration||state.userRevision!==expectedRevision)return;
    state.userRevision++;
    invalidateRecognition();
    cancelPendingForRevision();
    tiles.clear();
    state.inkBounds.clear();
    state.history = [];
    state.future = [];
    state.historyBefore.clear();
    for (const { k, image } of decoded) {
      const canvas = offscreen(TILE, TILE);
      canvas.getContext("2d").drawImage(image, 0, 0);
      tiles.set(k, canvas);
    }
    if (["arcane", "scifi", "research"].includes(item.theme)) applyTheme(item.theme);
    if (item.view) {
      state.scale = Math.max(0.03, Math.min(2, item.view.scale));
      state.panX = item.view.panX;
      state.panY = item.view.panY;
      updateCoordinates();
    }
    state.currentSnapshotId = item.id;
    state.currentSnapshotName = snapshotName(item);
    render();
    closeHistoryPanel();
    setStatusKey("snapshotLoaded");
  }
  async function deleteSnapshot(id) {
    if (!confirm(t("deleteSnapshotConfirm"))) return;
    const db = await snapshotDb(),
      readTransaction = db.transaction(SNAPSHOT_TILE_STORE, "readonly"),
      tileKeys = await requestResult(readTransaction.objectStore(SNAPSHOT_TILE_STORE).index("snapshotId").getAllKeys(id)),
      transaction = db.transaction([SNAPSHOT_STORE, SNAPSHOT_TILE_STORE], "readwrite");
    transaction.objectStore(SNAPSHOT_STORE).delete(id);
    const tileStore = transaction.objectStore(SNAPSHOT_TILE_STORE);
    tileKeys.forEach((key) => tileStore.delete(key));
    await transactionDone(transaction);
    if (state.currentSnapshotId === id) {
      state.currentSnapshotId = null;
      state.currentSnapshotName = "";
    }
    await refreshSnapshots();
    setStatusKey("snapshotDeleted");
  }
  function updateNewCanvasDialog() {
    const label = document.querySelector("#currentSnapshotLabel"),
      overwrite = document.querySelector("#newOverwrite");
    if (!label || !overwrite) return;
    label.textContent = state.currentSnapshotId ? t("currentSnapshot").replace("{name}", state.currentSnapshotName || state.currentSnapshotId) : t("noCurrentSnapshot");
    overwrite.disabled = !state.currentSnapshotId;
  }
  function setNewCanvasDialogBusy(busy) {
    const dialog = document.querySelector("#newCanvasDialog");
    dialog.dataset.busy = String(busy);
    dialog.querySelectorAll("button, input").forEach((control) => (control.disabled = busy));
    if (!busy) updateNewCanvasDialog();
  }
  function startBlankCanvas() {
    const dialog = document.querySelector("#newCanvasDialog");
    if (state.selection) cancelSelection(true);
    state.snapshotLoadGeneration++;
    state.userRevision++;
    invalidateRecognition();
    cancelPendingForRevision();
    tiles.clear();
    state.inkBounds.clear();
    state.history = [];
    state.future = [];
    state.historyBefore.clear();
    state.currentSnapshotId = null;
    state.currentSnapshotName = "";
    state.viewInitialized = false;
    document.querySelector("#newSnapshotName").value = "";
    if (dialog.open) dialog.close();
    if (document.querySelector("#historyPanel").classList.contains("open")) closeHistoryPanel();
    fit();
    setStatusKey("newCanvasReady");
  }
  function openNewCanvasDialog() {
    if (!tiles.size) {
      startBlankCanvas();
      return;
    }
    const dialog = document.querySelector("#newCanvasDialog");
    document.querySelector("#newSnapshotName").value = "";
    setNewCanvasDialogBusy(false);
    updateNewCanvasDialog();
    if (!dialog.open) dialog.showModal();
  }
  async function completeNewCanvas(saveMode) {
    const name = document.querySelector("#newSnapshotName").value;
    setNewCanvasDialogBusy(true);
    try {
      if (saveMode === "new") await saveSnapshot({ name });
      else if (saveMode === "overwrite") await saveSnapshot({ overwriteId: state.currentSnapshotId, name });
      startBlankCanvas();
    } catch (error) {
      setStatus(`${t("snapshotError")}${error.message}`);
      setNewCanvasDialogBusy(false);
    }
  }
  function snapshotName(item) {
    return item.name || new Intl.DateTimeFormat(state.language === "zh" ? "zh-CN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(item.createdAt);
  }
  function renderSnapshotList() {
    const list = document.querySelector("#historyList");
    if (!list) return;
    list.replaceChildren();
    if (!snapshotItems.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = t("emptyHistory");
      list.append(empty);
      return;
    }
    for (const item of snapshotItems) {
      const card = document.createElement("article"),
        preview = document.createElement("div"),
        image = document.createElement("img"),
        meta = document.createElement("div"),
        title = document.createElement("strong"),
        detail = document.createElement("small"),
        actions = document.createElement("div"),
        load = document.createElement("button"),
        remove = document.createElement("button"),
        url = URL.createObjectURL(item.preview);
      card.className = "history-card";
      card.classList.toggle("current", item.id === state.currentSnapshotId);
      if (item.id === state.currentSnapshotId) card.setAttribute("aria-current", "true");
      preview.className = "history-preview";
      image.alt = "";
      image.src = url;
      image.onload = image.onerror = () => URL.revokeObjectURL(url);
      preview.append(image);
      meta.className = "history-meta";
      title.textContent = snapshotName(item);
      detail.textContent = `${new Intl.DateTimeFormat(state.language === "zh" ? "zh-CN" : "en", { dateStyle: "short", timeStyle: "short" }).format(item.createdAt)} · ${item.tileCount} ${t("snapshotTiles")}`;
      actions.className = "history-actions";
      load.textContent = t("loadSnapshot");
      load.onclick = () => runSnapshotAction(() => loadSnapshot(item.id));
      remove.className = "history-delete";
      remove.textContent = t("deleteSnapshot");
      remove.onclick = () => runSnapshotAction(() => deleteSnapshot(item.id));
      actions.append(load, remove);
      meta.append(title, detail, actions);
      card.append(preview, meta);
      list.append(card);
    }
  }
  async function refreshSnapshots() {
    snapshotItems = await allSnapshots();
    renderSnapshotList();
  }
  async function runSnapshotAction(action) {
    try {
      await action();
    } catch (error) {
      setStatus(`${t("snapshotError")}${error.message}`);
    }
  }
  function openHistoryPanel() {
    const panel = document.querySelector("#historyPanel"),
      backdrop = document.querySelector("#historyBackdrop"),
      button = document.querySelector("#historyBtn");
    backdrop.hidden = false;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    button.setAttribute("aria-expanded", "true");
    refreshSnapshots().catch((error) => setStatus(`${t("snapshotError")}${error.message}`));
  }
  function closeHistoryPanel() {
    const panel = document.querySelector("#historyPanel"),
      backdrop = document.querySelector("#historyBackdrop"),
      button = document.querySelector("#historyBtn");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      if (!panel.classList.contains("open")) backdrop.hidden = true;
    }, 220);
  }
  function recordBefore(tx, ty) {
    const k = key(tx, ty);
    if (!state.historyBefore.has(k)) state.historyBefore.set(k, cloneCanvas(tiles.get(k)));
  }
  function unionLocalBounds(current, next) {
    if (!current) return next;
    const x = Math.min(current.x, next.x),
      y = Math.min(current.y, next.y),
      right = Math.max(current.x + current.w, next.x + next.w),
      bottom = Math.max(current.y + current.h, next.y + next.h);
    return { x, y, w: right - x, h: bottom - y };
  }
  function extendInkBounds(k, next) {
    if (!state.inkBounds.has(k)) return;
    state.inkBounds.set(k, unionLocalBounds(state.inkBounds.get(k), next));
  }
  function lineIntersectsRect(a, b, rect) {
    let t0 = 0,
      t1 = 1;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      tests = [
        [-dx, a.x - rect.x],
        [dx, rect.x + rect.w - a.x],
        [-dy, a.y - rect.y],
        [dy, rect.y + rect.h - a.y],
      ];
    for (const [p, q] of tests) {
      if (!p) {
        if (q < 0) return false;
        continue;
      }
      const ratio = q / p;
      if (p < 0) t0 = Math.max(t0, ratio);
      else t1 = Math.min(t1, ratio);
      if (t0 > t1) return false;
    }
    return true;
  }
  function stroke(a, b, erase = false, size = state.pen, userChange = false) {
    if (!valid(a) || !valid(b)) return;
    const pad = size / 2 + 2,
      x = Math.min(a.x, b.x) - pad,
      y = Math.min(a.y, b.y) - pad,
      w = Math.abs(a.x - b.x) + pad * 2,
      h = Math.abs(a.y - b.y) + pad * 2;
    const x0 = Math.max(0, Math.floor(x / TILE)),
      y0 = Math.max(0, Math.floor(y / TILE)),
      x1 = Math.min(Math.ceil(SIZE / TILE) - 1, Math.floor((x + w) / TILE)),
      y1 = Math.min(Math.ceil(SIZE / TILE) - 1, Math.floor((y + h) / TILE));
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const expanded = { x: tx * TILE - pad, y: ty * TILE - pad, w: TILE + pad * 2, h: TILE + pad * 2 };
        if (!lineIntersectsRect(a, b, expanded)) continue;
        const existing = tile(tx, ty, false);
        if (erase && !existing) continue;
        recordBefore(tx, ty);
        const c = existing || tile(tx, ty),
          q = c.getContext("2d");
        q.save();
        q.globalCompositeOperation = erase ? "destination-out" : "source-over";
        q.strokeStyle = state.inkColor;
        q.lineWidth = size;
        q.lineCap = q.lineJoin = "round";
        q.beginPath();
        q.moveTo(a.x - tx * TILE, a.y - ty * TILE);
        q.lineTo(b.x - tx * TILE, b.y - ty * TILE);
        q.stroke();
        q.restore();
        const k = key(tx, ty);
        if (erase) state.inkBounds.delete(k);
        else {
          const local = {
            x: Math.max(0, Math.min(a.x, b.x) - tx * TILE - pad),
            y: Math.max(0, Math.min(a.y, b.y) - ty * TILE - pad),
            w: Math.min(TILE, Math.max(a.x, b.x) - tx * TILE + pad) - Math.max(0, Math.min(a.x, b.x) - tx * TILE - pad),
            h: Math.min(TILE, Math.max(a.y, b.y) - ty * TILE + pad) - Math.max(0, Math.min(a.y, b.y) - ty * TILE - pad),
          };
          extendInkBounds(k, local);
        }
      }
    if (userChange) {
      mergeDirty(a.x, a.y, pad);
      mergeDirty(b.x, b.y, pad);
    }
  }
  function dot(p, erase = false, size = state.pen, userChange = false) {
    stroke(p, { x: p.x + 0.01, y: p.y + 0.01 }, erase, size, userChange);
  }
  function pressureWidth(e) {
    if (e.pointerType !== "pen" || !Number.isFinite(e.pressure) || e.pressure <= 0) return state.pen;
    return Math.max(3, Math.min(16, state.pen * (0.72 + e.pressure * 0.7)));
  }
  function logicalWidth(cssWidth) {
    const maximum = state.mode === "eraser" ? 1600 : 320;
    return Math.max(1, Math.min(maximum, cssWidth / Math.max(0.03, state.scale)));
  }
  function drawPreview(s) {
    ctx.strokeStyle = s.erase ? "#dc262666" : `${state.inkColor}88`;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.a.x, s.a.y);
    ctx.lineTo(s.b.x, s.b.y);
    ctx.stroke();
  }
  function save() {
    if (!state.historyBefore.size) return;
    const changes = [];
    for (const [k, before] of state.historyBefore) {
      let current = tiles.get(k);
      if (current && state.inkBounds.get(k) === undefined) {
        const [tx, ty] = k.split(",").map(Number),
          ink = inkBox(current, Math.min(TILE, SIZE - tx * TILE), Math.min(TILE, SIZE - ty * TILE));
        if (ink) state.inkBounds.set(k, ink);
        else {
          tiles.delete(k);
          state.inkBounds.delete(k);
          current = null;
        }
      }
      changes.push({ k, before, after: cloneCanvas(current) });
    }
    state.historyBefore.clear();
    state.history.push(changes);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.future = [];
  }
  function applyHistory(changes, side) {
    for (const change of changes) {
      const value = change[side];
      if (value) tiles.set(change.k, cloneCanvas(value));
      else tiles.delete(change.k);
      state.inkBounds.delete(change.k);
    }
    render();
  }
  function undo() {
    save();
    const change = state.history.pop();
    if (!change) return;
    invalidateRecognition();
    state.future.push(change);
    applyHistory(change, "before");
  }
  function redo() {
    const change = state.future.pop();
    if (!change) return;
    invalidateRecognition();
    state.history.push(change);
    applyHistory(change, "after");
  }
  function sameBox(a, b) {
    return a && b && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.w - b.w) < 0.01 && Math.abs(a.h - b.h) < 0.01;
  }
  function selectionHasChanges(selection) {
    return Boolean(selection?.color) || !sameBox(selection?.box, selection?.originalBox);
  }
  function recolorSelectionImage(image, color) {
    const recolored = offscreen(image.width, image.height),
      context = recolored.getContext("2d");
    context.drawImage(image, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = color;
    context.fillRect(0, 0, recolored.width, recolored.height);
    return recolored;
  }
  function traceSelectionPath(context, points, offsetX = 0, offsetY = 0, close = true) {
    if (!points.length) return;
    context.beginPath();
    context.moveTo(points[0].x - offsetX, points[0].y - offsetY);
    for (let index = 1; index < points.length; index++) context.lineTo(points[index].x - offsetX, points[index].y - offsetY);
    if (close) context.closePath();
  }
  function drawSelection(selection) {
    const unit = 1 / state.scale,
      size = 14 * unit;
    if (selection.phase === "lasso") {
      ctx.save();
      ctx.fillStyle = "#2679b81a";
      ctx.strokeStyle = "#2679b8";
      ctx.lineWidth = 1.5 * unit;
      ctx.setLineDash([7 * unit, 6 * unit]);
      traceSelectionPath(ctx, selection.points);
      ctx.fill("evenodd");
      ctx.stroke();
      ctx.restore();
      return;
    }
    for (const fragment of selection.fragments) {
      const target = SELECT.mapFragment(fragment, selection.originalBox, selection.box);
      ctx.drawImage(fragment.renderImage || fragment.image, target.x, target.y, target.w, target.h);
    }
    ctx.save();
    ctx.strokeStyle = "#2679b8";
    ctx.lineWidth = 1.8 * unit;
    ctx.setLineDash([7 * unit, 6 * unit]);
    ctx.strokeRect(selection.box.x, selection.box.y, selection.box.w, selection.box.h);
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.beginPath();
    drawResizeHandle(ctx, selection.box, size);
    ctx.stroke();
    ctx.restore();
    drawMoveHandle(ctx, selection.box, size, true);
    drawDraftActions(ctx, selection.box, size);
  }
  function captureSelection(points) {
    const box = SELECT.polygonBounds(points, SIZE);
    if (!box || points.length < 3 || SELECT.pathLength(points, state.scale) < 12 || box.w * state.scale < 4 || box.h * state.scale < 4) {
      setStatusKey("selectionTooSmall");
      return false;
    }
    const fragments = [];
    let originalBox = null;
    forTiles(
      box.x,
      box.y,
      box.w,
      box.h,
      (canvas, tx, ty) => {
        const tileBox = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE },
          part = intersection(tileBox, box);
        if (!part) return;
        const clipped = offscreen(part.w, part.h, true),
          clippedContext = clipped.getContext("2d", { willReadFrequently: true });
        clippedContext.save();
        traceSelectionPath(clippedContext, points, part.x, part.y);
        clippedContext.clip("evenodd");
        clippedContext.drawImage(canvas, part.x - tileBox.x, part.y - tileBox.y, part.w, part.h, 0, 0, part.w, part.h);
        clippedContext.restore();
        const ink = inkBox(clipped);
        if (!ink) return;
        const image = offscreen(ink.w, ink.h);
        image.getContext("2d").drawImage(clipped, ink.x, ink.y, ink.w, ink.h, 0, 0, ink.w, ink.h);
        const fragment = { image, x: part.x + ink.x, y: part.y + ink.y, w: ink.w, h: ink.h };
        fragments.push(fragment);
        originalBox = SELECT.unionBox(originalBox, fragment);
      },
      false,
    );
    if (!fragments.length) {
      state.selection = null;
      setStatusKey("selectionEmpty");
      render();
      return false;
    }
    save();
    invalidateRecognition();
    state.userRevision++;
    const beforeTiles = new Map();
    forTiles(
      box.x,
      box.y,
      box.w,
      box.h,
      (canvas, tx, ty) => {
        const tileKey = key(tx, ty),
          before = cloneCanvas(canvas);
        beforeTiles.set(tileKey, before);
        state.historyBefore.set(tileKey, before);
      },
      false,
    );
    forTiles(
      box.x,
      box.y,
      box.w,
      box.h,
      (canvas, tx, ty) => {
        recordBefore(tx, ty);
        const tileContext = canvas.getContext("2d");
        tileContext.save();
        tileContext.globalCompositeOperation = "destination-out";
        tileContext.fillStyle = "#000";
        traceSelectionPath(tileContext, points, tx * TILE, ty * TILE);
        tileContext.fill("evenodd");
        tileContext.restore();
        state.inkBounds.delete(key(tx, ty));
      },
      false,
    );
    state.selection = {
      phase: "active",
      originalBox,
      box: { ...originalBox },
      fragments,
      beforeTiles,
      color: null,
    };
    state.selectionGesture = null;
    setStatusKey("selectionReady");
    render();
    return true;
  }
  function restoreSelectionSource(selection) {
    for (const [tileKey, before] of selection.beforeTiles) {
      if (before) tiles.set(tileKey, cloneCanvas(before));
      else tiles.delete(tileKey);
      state.inkBounds.delete(tileKey);
    }
    state.historyBefore.clear();
  }
  function cancelSelection(silent = false) {
    const selection = state.selection;
    if (!selection) return false;
    if (selection.phase === "active") restoreSelectionSource(selection);
    state.selection = null;
    state.selectionGesture = null;
    setCanvasCursor("crosshair");
    render();
    if (!silent) setStatusKey("selectionCancelled");
    return true;
  }
  function commitSelection() {
    const selection = state.selection;
    if (!selection) return false;
    if (selection.phase !== "active") {
      state.selection = null;
      state.selectionGesture = null;
      render();
      return false;
    }
    if (!selectionHasChanges(selection)) {
      cancelSelection(true);
      setStatusKey("selectionCommitted");
      return false;
    }
    state.selection = null;
    state.selectionGesture = null;
    for (const fragment of selection.fragments) {
      const target = SELECT.mapFragment(fragment, selection.originalBox, selection.box);
      blitSized(fragment.renderImage || fragment.image, target.x, target.y, target.w, target.h);
    }
    state.userRevision++;
    save();
    setCanvasCursor("crosshair");
    render();
    setStatusKey("selectionCommitted");
    return true;
  }
  function applySelectionColor(color) {
    const selection = state.selection;
    if (!selection || selection.phase !== "active" || selection.color === color) return false;
    selection.color = color;
    for (const fragment of selection.fragments) fragment.renderImage = recolorSelectionImage(fragment.image, color);
    render();
    setStatusKey("selectionRecolored");
    return true;
  }
  function selectionHit(selection, event) {
    return SELECT.hitTest(selection.box, clientPoint(event), 14 / state.scale);
  }
  function beginSelectionLasso(event, point) {
    state.selection = { phase: "lasso", points: [SELECT.clipPoint(point, SIZE)], box: null };
    state.selectionGesture = { id: event.pointerId, hit: "lasso" };
    setCanvasCursor("crosshair");
    requestRender();
  }
  function beginSelectionTransform(event, hit) {
    const point = clientPoint(event);
    state.selectionGesture = {
      id: event.pointerId,
      hit,
      startPoint: point,
      startBox: { ...state.selection.box },
    };
    setCanvasCursor(hit === "resize" ? "nwse-resize" : "grabbing");
  }
  function addLassoPoint(selection, point, minimumDistance) {
    if (!SELECT.shouldAddPoint(selection.points, point, minimumDistance)) return false;
    if (selection.points.length >= MAX_LASSO_POINTS) selection.points = selection.points.filter((_, index) => index % 2 === 0);
    selection.points.push(point);
    return true;
  }
  function updateSelectionGesture(event) {
    const gesture = state.selectionGesture,
      selection = state.selection;
    if (!gesture || !selection || gesture.id !== event.pointerId) return false;
    const point = clientPoint(event);
    if (gesture.hit === "lasso") {
      const clipped = SELECT.clipPoint(point, SIZE);
      addLassoPoint(selection, clipped, 2 / state.scale);
      selection.box = SELECT.polygonBounds(selection.points, SIZE);
    } else if (gesture.hit === "move") selection.box = SELECT.moveBox(gesture.startBox, point.x - gesture.startPoint.x, point.y - gesture.startPoint.y, SIZE);
    else if (gesture.hit === "resize") selection.box = SELECT.resizeBox(gesture.startBox, point, 24 / state.scale, SIZE);
    requestRender();
    return true;
  }
  function finishSelectionGesture(event) {
    const gesture = state.selectionGesture,
      selection = state.selection;
    if (!gesture || gesture.id !== event.pointerId) return false;
    state.selectionGesture = null;
    setCanvasCursor("crosshair");
    if (gesture.hit === "lasso") {
      if (selection && event.type !== "pointercancel") {
        const point = SELECT.clipPoint(clientPoint(event), SIZE);
        addLassoPoint(selection, point, 0.5 / state.scale);
      }
      const points = selection?.points || [];
      state.selection = null;
      if (event.type !== "pointercancel") captureSelection(points);
      else requestRender();
      return true;
    }
    if (selection) selection.changed = selectionHasChanges(selection);
    requestRender();
    return true;
  }
  function handleSelectionPointerDown(event, point) {
    const selection = state.selection;
    if (selection?.phase === "active") {
      const hit = selectionHit(selection, event);
      if (hit === "cancel") {
        cancelSelection();
        return true;
      }
      if (hit === "accept") {
        commitSelection();
        return true;
      }
      if (hit) {
        beginSelectionTransform(event, hit);
        return true;
      }
      commitSelection();
    } else if (selection) cancelSelection(true);
    beginSelectionLasso(event, point);
    return true;
  }
  function discardPendingForNewAI() {
    if (!state.pending) return;
    const pending = state.pending;
    state.pending = null;
    state.pendingGesture = null;
    updateBatchActions();
    render();
    pending.resolve?.(pending.acceptedItems ? { acceptedCount: pending.acceptedItems } : AI_SUPERSEDED);
  }
  function supersedeActiveAI(reason) {
    const active = state.activeAI;
    if (active && !active.superseded) {
      active.superseded = true;
      active.controller.abort();
      if (state.activeAI === active) {
        state.activeAI = null;
        setBusy(false);
      }
      if (!active.dirtyRestored && active.recognitionGeneration === state.recognitionGeneration) {
        restoreDirty(active.dirtySnapshot);
        active.dirtyRestored = true;
        state.autoEligible = Boolean(state.dirty);
      }
      debug("ai-deferred", { requestId: state.lastRequestId, reason });
    }
    discardPendingForNewAI();
  }
  function launchAutomaticAI(reason) {
    if (!state.auto || !state.dirty || !state.autoEligible || state.drawing) return;
    supersedeActiveAI(reason);
    requestAI("auto");
  }
  function schedule(delay = state.autoDelayMs) {
    clearTimeout(state.timer);
    state.timer = 0;
    if (!state.auto || !state.dirty || !state.autoEligible) return;
    state.timer = setTimeout(() => {
      state.timer = 0;
      launchAutomaticAI("new-stroke-deadline");
    }, Math.max(0, delay));
  }
  function inkBox(c, scanWidth = c.width, scanHeight = c.height) {
    const width = Math.max(0, Math.min(c.width, Math.floor(scanWidth))),
      height = Math.max(0, Math.min(c.height, Math.floor(scanHeight)));
    if (!width || !height) return null;
    const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    let x0 = width,
      y0 = height,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (d[i + 3] && !(d[i] > 248 && d[i + 1] > 248 && d[i + 2] > 248)) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  function intersection(a, b) {
    const x = Math.max(a.x, b.x),
      y = Math.max(a.y, b.y),
      right = Math.min(a.x + a.w, b.x + b.w),
      bottom = Math.min(a.y + a.h, b.y + b.h);
    return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y } : null;
  }
  async function requestAI(action) {
    const automatic = action === "auto",
      revision = state.userRevision,
      recognitionGeneration = state.recognitionGeneration,
      aiColor = state.aiColor,
      dirtySnapshot = state.dirty ? { ...state.dirty } : null,
      latestBox = dirtySnapshot || state.lastUserBox,
      hotspotCount = state.hotspotTrail.length,
      packed = latestBox ? buildViewportImage(state.hotspotTrail.slice(0, hotspotCount), latestBox) : null;
    if (!packed) {
      discardUncapturableInput(hotspotCount, Boolean(dirtySnapshot));
      setStatusKey(latestBox ? "cannotCapture" : "noInk");
      return;
    }
    const requestBox = packed.changedBox;
    state.dirty = null;
    state.autoEligible = false;
    const controller = new AbortController(),
      run = { controller, dirtySnapshot, recognitionGeneration, superseded: false, dirtyRestored: false };
    state.activeAI = run;
    setBusy(true);
    setStatusKey("observing");
    const timeout = setTimeout(() => controller.abort(), state.aiRequestTimeoutMs);
    try {
      const res = await fetch("/api/ai/command", {
          signal: controller.signal,
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...packed,
            trigger: automatic ? "user_paused" : "manual",
            userAction: action,
            canvasSize: { w: SIZE, h: SIZE },
            uiTheme: state.theme,
            persona: {
              research: "Rigorous mathematical-physics research and teaching mentor. Prioritize assumptions, derivations, units, physical interpretation, proofs, and verifiable code or numerical checks when useful. Be concise but academically precise; never claim to literally be Einstein unless asked for roleplay.",
              scifi: "Pragmatic futuristic engineering copilot. Prioritize programming, debugging, algorithms, architecture, systems thinking, quantitative tradeoffs, and plausible emerging technology. Give concise, actionable answers rather than decorative sci-fi prose.",
              arcane: "Warm interdisciplinary knowledge guide. Favor intuition, memorable analogies, creative synthesis, conceptual connections across science and humanities, and exploratory alternatives while keeping facts and reasoning precise.",
            }[state.theme],
          }),
        }),
        data = await res.json();
      if (run.superseded || state.activeAI !== run) throw Error(AI_SUPERSEDED);
      rememberRequest(data.requestId);
      if (!res.ok) {
        const error = Error(data.error || `HTTP ${res.status}`);
        error.status = res.status;
        throw error;
      }
      const rawCount = Array.isArray(data.commands) ? data.commands.length : 0,
        commands = normalizeCommandPlacements(validate(data.commands || [], aiColor), packed, requestBox),
        meta = { requestId: data.requestId };
      debug("ai-response", {
        ...meta,
        intent: data.intent || "none",
        rawCount,
        attempts: data.attempts || 1,
      });
      debug("commands-validated", {
        ...meta,
        rawCount,
        validCount: commands.length,
        rejectedCount: rawCount - commands.length,
        tools: commands.map((c) => c.tool),
      });
      if (state.userRevision !== revision) {
        if (state.recognitionGeneration === recognitionGeneration) {
          restoreDirty(dirtySnapshot);
          state.autoEligible = Boolean(state.dirty);
        }
        setStatusKey("deferred");
        debug("ai-deferred", { ...meta, reason: "user-revision-changed" });
        return;
      }
      if (commands.length) {
        setStatusKey("writing");
        if (commands.length === 1 && !["draw", "erase"].includes(commands[0].tool)) {
          if (state.userRevision !== revision) throw Error(AI_CANCELLED);
          await animate(commands[0], revision, meta, run);
        } else {
          const items = [];
          for (const c of commands) {
            if (state.userRevision !== revision) throw Error(AI_CANCELLED);
            items.push(await preparePendingItem(c, revision, meta, run));
            checkAI(revision, run);
          }
          resolvePendingItemOverlaps(items, meta);
          checkAI(revision, run);
          const outcome = await startPendingBatch(items, revision, meta);
          if (outcome === AI_CANCELLED) throw Error(AI_CANCELLED);
          if (outcome === AI_SUPERSEDED) throw Error(AI_SUPERSEDED);
          if (!outcome?.acceptedCount) throw Error(AI_REJECTED);
          debug("tool-complete", { ...meta, batch: true, acceptedCount: outcome.acceptedCount, discardedCount: commands.length - outcome.acceptedCount });
        }
        if (!run.inputConsumed) {
          state.lastUserBox = requestBox;
          if (hotspotCount) state.hotspotTrail.splice(0, hotspotCount);
          run.inputConsumed = true;
        }
        save();
        if (data.message) setStatus(data.message);
        else setStatusKey("aiDone");
      } else {
        state.lastUserBox = requestBox;
        if (hotspotCount) state.hotspotTrail.splice(0, hotspotCount);
        setStatusKey("ready");
      }
    } catch (e) {
      if (run.superseded) {
        debug("ai-deferred", { requestId: state.lastRequestId, reason: "request-superseded" });
      } else if (e.message === AI_REJECTED) {
        if (!run.inputConsumed && state.recognitionGeneration === recognitionGeneration) {
          state.lastUserBox = requestBox;
          if (hotspotCount) state.hotspotTrail.splice(0, hotspotCount);
        }
        setStatusKey("draftRejected");
      } else if (e.message === AI_SUPERSEDED) {
        if (!run.inputConsumed && state.recognitionGeneration === recognitionGeneration) {
          state.lastUserBox = requestBox;
          if (hotspotCount) state.hotspotTrail.splice(0, hotspotCount);
        }
        setStatusKey("ready");
      } else if (state.userRevision !== revision) {
        if (!run.inputConsumed && state.recognitionGeneration === recognitionGeneration) {
          restoreDirty(dirtySnapshot);
          state.autoEligible = Boolean(state.dirty);
        }
        setStatusKey("deferred");
        debug("ai-deferred", { requestId: state.lastRequestId, reason: "stale-request-error" });
      } else if (e.message === AI_CANCELLED) {
        if (!run.inputConsumed && state.recognitionGeneration === recognitionGeneration) {
          restoreDirty(dirtySnapshot);
          state.autoEligible = Boolean(state.dirty);
        }
        setStatusKey("deferred");
        debug("ai-deferred", {
          requestId: state.lastRequestId,
          reason: "animation-cancelled",
        });
      } else {
        const timedOut = e.name === "AbortError",
          message = timedOut ? t("timeout") : e.message;
        if (!run.inputConsumed && state.recognitionGeneration === recognitionGeneration) {
          restoreDirty(dirtySnapshot);
          state.autoEligible = false;
        }
        setStatus(`${t("aiError")}${message}`);
        debug("ai-error", {
          requestId: state.lastRequestId,
          action,
          error: timedOut ? "timeout" : Number.isInteger(e.status) ? "http-error" : "request-error",
        });
      }
    } finally {
      clearTimeout(timeout);
      if (state.activeAI === run) {
        state.activeAI = null;
        setBusy(false);
      }
    }
  }
  function viewportRect() {
    const r = view.getBoundingClientRect(),
      x = Math.max(0, -state.panX / state.scale),
      y = Math.max(0, -state.panY / state.scale),
      right = Math.min(SIZE, (r.width - state.panX) / state.scale),
      bottom = Math.min(SIZE, (r.height - state.panY) / state.scale);
    return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y } : null;
  }
  function visibleInkBounds(visible) {
    let bounds = null;
    for (const [k] of tiles) {
      const [tx, ty] = k.split(",").map(Number),
        tileBox = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE },
        part = intersection(tileBox, visible);
      if (!part) continue;
      let ink = state.inkBounds.get(k);
      if (ink === undefined) {
        const c = tiles.get(k);
        ink = c ? inkBox(c, Math.min(TILE, SIZE - tx * TILE), Math.min(TILE, SIZE - ty * TILE)) : null;
        state.inkBounds.set(k, ink);
      }
      if (!ink) continue;
      const found = intersection({ x: tileBox.x + ink.x, y: tileBox.y + ink.y, w: ink.w, h: ink.h }, visible);
      if (!found) continue;
      bounds = bounds
        ? {
            x: Math.min(bounds.x, found.x),
            y: Math.min(bounds.y, found.y),
            w: Math.max(bounds.x + bounds.w, found.x + found.w) - Math.min(bounds.x, found.x),
            h: Math.max(bounds.y + bounds.h, found.y + found.h) - Math.min(bounds.y, found.y),
          }
        : found;
    }
    return bounds;
  }
  function mapHotspots(sourceRect, imageSize, points) {
    const columns = 8,
      rows = 8,
      cellW = sourceRect.w / columns,
      cellH = sourceRect.h / rows,
      result = [];
    for (const point of points) {
      if (point.x < sourceRect.x || point.x > sourceRect.x + sourceRect.w || point.y < sourceRect.y || point.y > sourceRect.y + sourceRect.h) continue;
      const col = Math.min(columns - 1, Math.max(0, Math.floor((point.x - sourceRect.x) / cellW))),
        row = Math.min(rows - 1, Math.max(0, Math.floor((point.y - sourceRect.y) / cellH))),
        previous = result.at(-1);
      if (previous && previous.cell[0] === col && previous.cell[1] === row) continue;
      result.push({
        cell: [col, row],
        imageRect: {
          x: Math.round((col * imageSize.w) / columns),
          y: Math.round((row * imageSize.h) / rows),
          w: Math.ceil(imageSize.w / columns),
          h: Math.ceil(imageSize.h / rows),
        },
      });
    }
    return {
      columns,
      rows,
      order: "oldest-to-newest",
      attention: "use only to refine reading order inside latestInput.imageRect",
      hotspots: result.slice(-64),
    };
  }
  function captureRectFor(latestBox, visible) {
    // Retained dirty ink from a failed request must never expand the next capture beyond what the user can currently see.
    return visible;
  }
  function buildViewportImage(hotspotPoints, latestBox) {
    const visible = viewportRect();
    if (!visible) return null;
    const captureRect = captureRectFor(latestBox, visible),
      ink = visibleInkBounds(captureRect);
    if (!ink) return null;
    const margin = Math.max(120, Math.min(640, 160 / state.scale)),
      left = Math.max(captureRect.x, ink.x - margin),
      top = Math.max(captureRect.y, ink.y - margin),
      right = Math.min(captureRect.x + captureRect.w, ink.x + ink.w + margin),
      bottom = Math.min(captureRect.y + captureRect.h, ink.y + ink.h + margin),
      sourceRect = { x: left, y: top, w: right - left, h: bottom - top },
      // Keep ceil(source * scale) inside the server limits despite floating-point drift.
      imageScale = Math.min(1, MAX_ATLAS_WIDTH / sourceRect.w, MAX_ATLAS_HEIGHT / sourceRect.h) * (1 - Number.EPSILON * 4),
      imageSize = {
        w: Math.max(1, Math.min(MAX_ATLAS_WIDTH, Math.ceil(sourceRect.w * imageScale))),
        h: Math.max(1, Math.min(MAX_ATLAS_HEIGHT, Math.ceil(sourceRect.h * imageScale))),
      },
      out = offscreen(imageSize.w, imageSize.h),
      q = out.getContext("2d");
    const latestVisible = intersection(latestBox, sourceRect);
    if (!latestVisible) return null;
    q.fillStyle = "#fff";
    q.fillRect(0, 0, out.width, out.height);
    q.setTransform(imageScale, 0, 0, imageScale, -sourceRect.x * imageScale, -sourceRect.y * imageScale);
    q.globalAlpha = 0.42;
    forTiles(sourceRect.x, sourceRect.y, sourceRect.w, sourceRect.h, (c, tx, ty) => q.drawImage(c, tx * TILE, ty * TILE), false);
    q.globalAlpha = 1;
    q.save();
    q.beginPath();
    q.rect(latestVisible.x, latestVisible.y, latestVisible.w, latestVisible.h);
    q.clip();
    forTiles(latestVisible.x, latestVisible.y, latestVisible.w, latestVisible.h, (c, tx, ty) => q.drawImage(c, tx * TILE, ty * TILE), false);
    q.restore();
    const focusInset = FOCUS_INSET_ENABLED ? drawFocusInset(out, latestVisible, sourceRect, imageScale) : null,
      hotspotGrid = mapHotspots(sourceRect, imageSize, hotspotPoints);
    debug("atlas-built", {
      scope: "visible-content",
      visibleRect: visible,
      captureRect,
      sourceRect,
      imageSize,
      imageScale: Number(imageScale.toFixed(4)),
      latestBox: latestVisible,
      focusInset,
      hotspots: hotspotGrid.hotspots.length,
    });
    return {
      atlasImage: out.toDataURL("image/png"),
      atlasSize: imageSize,
      visibleRect: visible,
      captureRect,
      sourceRect,
      imageScale,
      changedBox: latestVisible,
      focusInset,
      hotspotGrid,
    };
  }
  function drawFocusInset(out, latestBox, sourceRect, mainScale) {
    const largeInput = latestBox.w > 1800 || latestBox.h > 1200,
      padding = largeInput ? Math.max(40, Math.min(120, Math.max(latestBox.w, latestBox.h) * 0.04)) : Math.max(50, Math.min(280, Math.max(latestBox.w, latestBox.h) * 0.18)),
      w = Math.min(sourceRect.w, Math.max(220, latestBox.w + padding * 2)),
      h = Math.min(sourceRect.h, Math.max(160, latestBox.h + padding * 2)),
      x = Math.max(sourceRect.x, Math.min(sourceRect.x + sourceRect.w - w, latestBox.x + latestBox.w / 2 - w / 2)),
      y = Math.max(sourceRect.y, Math.min(sourceRect.y + sourceRect.h - h, latestBox.y + latestBox.h / 2 - h / 2)),
      focusRect = { x, y, w, h },
      targetW = largeInput ? Math.min(1500, out.width * 0.72) : 640,
      targetH = largeInput ? Math.min(1000, out.height * 0.82) : 420,
      focusScale = Math.min(3, targetW / w, targetH / h, Math.max(0.01, (out.width - 24) / w), Math.max(0.01, (out.height - 24) / h)),
      latestPixels = { w: latestBox.w * mainScale, h: latestBox.h * mainScale };
    if (focusScale <= mainScale * 1.05 || (!largeInput && focusScale <= mainScale * 1.35 && latestPixels.w >= 180 && latestPixels.h >= 100)) return null;
    const contentW = Math.max(1, Math.ceil(w * focusScale)),
      contentH = Math.max(1, Math.ceil(h * focusScale)),
      latestCenter = {
        x: (latestBox.x + latestBox.w / 2 - sourceRect.x) * mainScale,
        y: (latestBox.y + latestBox.h / 2 - sourceRect.y) * mainScale,
      },
      insetPadding = 12,
      positions = [
        { x: insetPadding, y: insetPadding },
        { x: out.width - contentW - insetPadding, y: insetPadding },
        { x: insetPadding, y: out.height - contentH - insetPadding },
        { x: out.width - contentW - insetPadding, y: out.height - contentH - insetPadding },
      ].filter((position) => position.x >= insetPadding && position.y >= insetPadding),
      distance = (position) => Math.hypot(position.x + contentW / 2 - latestCenter.x, position.y + contentH / 2 - latestCenter.y),
      position = positions.sort((a, b) => distance(b) - distance(a))[0];
    if (!position) return null;
    const q = out.getContext("2d");
    q.save();
    q.setTransform(1, 0, 0, 1, 0, 0);
    q.fillStyle = "#fff";
    q.fillRect(position.x - 5, position.y - 5, contentW + 10, contentH + 10);
    q.beginPath();
    q.rect(position.x, position.y, contentW, contentH);
    q.clip();
    q.setTransform(focusScale, 0, 0, focusScale, position.x - focusRect.x * focusScale, position.y - focusRect.y * focusScale);
    q.globalAlpha = 0.32;
    forTiles(focusRect.x, focusRect.y, focusRect.w, focusRect.h, (c, tx, ty) => q.drawImage(c, tx * TILE, ty * TILE), false);
    q.globalAlpha = 1;
    q.save();
    q.beginPath();
    q.rect(latestBox.x, latestBox.y, latestBox.w, latestBox.h);
    q.clip();
    forTiles(latestBox.x, latestBox.y, latestBox.w, latestBox.h, (c, tx, ty) => q.drawImage(c, tx * TILE, ty * TILE), false);
    q.restore();
    q.restore();
    q.save();
    q.setTransform(1, 0, 0, 1, 0, 0);
    q.strokeStyle = "#64748b";
    q.lineWidth = 2;
    q.strokeRect(position.x - 4, position.y - 4, contentW + 8, contentH + 8);
    q.restore();
    return {
      sourceRect: focusRect,
      imageRect: { x: position.x, y: position.y, w: contentW, h: contentH },
      imageScale: focusScale,
      purpose: "magnified duplicate of latestInput for handwriting transcription only",
    };
  }
  function containsRect(outer, inner) {
    const epsilon = 0.001;
    return inner.x >= outer.x - epsilon && inner.y >= outer.y - epsilon && inner.x + inner.w <= outer.x + outer.w + epsilon && inner.y + inner.h <= outer.y + outer.h + epsilon;
  }
  const n = (v, min = 0, max = SIZE) => Number.isFinite(v) && v >= min && v <= max;
  function matchedFontSize(value) {
    const screenReadable = 42 / Math.max(0.03, state.scale);
    return Math.max(24, Math.min(650, Math.max(+value || 180, screenReadable)));
  }
  function matchedTextFontSize(value, text) {
    const size = matchedFontSize(value),
      characters = Array.from(String(text).replace(/\s/g, "")).length;
    return characters < 10 ? size : Math.max(24, size * 0.5);
  }
  function normalizeCommandPlacements(commands, packed, latestBox) {
    if (commands.length !== 1) return commands;
    const capture = packed.captureRect,
      padding = Math.max(80, Math.min(320, latestBox.h * 0.15)),
      command = commands[0];
    if (command.tool !== "write_text" && command.tool !== "draw_formula") return commands;
    const width = command.tool === "write_text" ? command.maxWidth : command.fontSize,
      height = command.tool === "write_text" ? command.fontSize * command.lineHeight * 2 : command.fontSize * 1.8,
      farAbove = command.y + Math.max(command.fontSize || 100, 120) < capture.y,
      suspiciousCanvasTop = command.y < capture.y + Math.max(200, capture.h * 0.04) && command.y + Math.max(command.fontSize || 100, 120) < latestBox.y - Math.max(400, capture.h * 0.12),
      farOutside = command.y > capture.y + capture.h || command.x > capture.x + capture.w || command.x + width < capture.x;
    if (!farAbove && !suspiciousCanvasTop && !farOutside) return commands;
    const next = { ...command },
      preferredY = Math.max(capture.y, Math.min(capture.y + capture.h - Math.min(height, capture.h), latestBox.y + latestBox.h + padding));
    next.x = Math.max(capture.x, Math.min(capture.x + capture.w - Math.min(width, capture.w), latestBox.x));
    next.y = Math.max(0, Math.min(SIZE - height, preferredY));
    if (next.tool === "write_text") next.maxWidth = Math.max(next.fontSize, Math.min(next.maxWidth, SIZE - next.x));
    return [next];
  }
  function validate(cmds, aiColor = state.aiColor) {
    if (!Array.isArray(cmds)) return [];
    let plotPixels = 0;
    const validated = cmds
      .slice(0, 16)
      .map((c) => (c && typeof c === "object" ? { ...c, tool: c.tool || c.type || c.name } : c))
      .filter((c) => c && ["write_text", "draw_formula", "plot_function", "draw", "erase"].includes(c.tool))
      .map((c) => {
        c = { ...c };
        if (c.tool === "write_text") {
          if (!n(c.x) || !n(c.y) || typeof c.text !== "string" || !Number.isFinite(c.maxWidth)) return null;
          c.text = c.text.slice(0, 1000);
          c.fontSize = matchedTextFontSize(c.fontSize, c.text);
          c.maxWidth = Math.max(c.fontSize, Math.min(SIZE - c.x, c.maxWidth));
          c.lineHeight = Math.max(1, Math.min(2.2, +c.lineHeight || 1.35));
          c.color = aiColor;
          if (c.maxWidth < c.fontSize) return null;
          c.y = Math.min(c.y, Math.max(0, SIZE - c.fontSize * c.lineHeight * 2));
        }
        if (c.tool === "draw_formula") {
          if (!n(c.x) || !n(c.y) || typeof c.latex !== "string") return null;
          c.latex = c.latex.slice(0, 500);
          c.fontSize = matchedFontSize(c.fontSize);
          c.color = aiColor;
          const estimatedWidth = Math.min(5000, Math.max(c.fontSize, c.latex.length * c.fontSize * 0.72));
          c.x = Math.min(c.x, Math.max(0, SIZE - estimatedWidth));
          c.y = Math.min(c.y, Math.max(0, SIZE - c.fontSize * 1.8));
        }
        if (c.tool === "plot_function" && (!n(c.x) || !n(c.y) || !n(c.w, 240, 6000) || !n(c.h, 180, 6000) || c.w * c.h > 8000000 || Math.max(c.w / c.h, c.h / c.w) > 6 || plotPixels + c.w * c.h > 12000000 || c.x + c.w > SIZE || c.y + c.h > SIZE || typeof c.expression !== "string" || c.expression.length > 180)) return null;
        if (c.tool === "plot_function") {
          c.expression = normalizePlotExpression(c.expression);
          try {
            compileExpression(c.expression);
          } catch {
            return null;
          }
          c.color = aiColor;
          plotPixels += c.w * c.h;
        }
        if (c.tool === "draw") {
          const normalized = DRAW?.normalize(c, SIZE);
          if (!normalized) return null;
          c = { ...normalized, color: aiColor };
        }
        if (c.tool === "erase") {
          if (c.mode === "path") {
            if (!Array.isArray(c.points) || c.points.length < 1 || c.points.length > 200 || !c.points.every(point)) return null;
            c.size = Math.max(2, Math.min(300, +c.size || 80));
            const xs = c.points.map((p) => p[0]),
              ys = c.points.map((p) => p[1]);
            if (Math.max(...xs) - Math.min(...xs) > 3000 || Math.max(...ys) - Math.min(...ys) > 3000) return null;
          } else {
            c.mode = "rect";
            if (!n(c.x) || !n(c.y) || !n(c.w, 1, 2000) || !n(c.h, 1, 2000) || c.x + c.w > SIZE || c.y + c.h > SIZE) return null;
          }
        }
        return c;
      })
      .filter(Boolean);
    return validated;
  }
  function point(v) {
    return Array.isArray(v) && v.length === 2 && n(v[0]) && n(v[1]);
  }
  function offscreen(w, h, readback = false) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    if (readback) c.getContext("2d", { willReadFrequently: true });
    return c;
  }
  function checkAI(revision, run = null) {
    if (state.userRevision !== revision) throw Error(AI_CANCELLED);
    if (run && (run.superseded || state.activeAI !== run)) throw Error(AI_SUPERSEDED);
  }
  async function animate(c, revision, meta, run) {
    debug("tool-start", {
      ...meta,
      tool: c.tool,
      x: c.x,
      y: c.y,
      fontSize: c.fontSize,
      maxWidth: c.maxWidth,
    });
    try {
      checkAI(revision, run);
      if (c.tool === "erase") {
        const bounds = eraseBounds(c),
          item={ command: c, erase: true, bounds, image: eraseMask(c, bounds) };
        const accepted = await startPendingBatch([item], revision, meta);
        if (accepted === AI_CANCELLED) throw Error(AI_CANCELLED);
        if (accepted === AI_SUPERSEDED) throw Error(AI_SUPERSEDED);
        if (!accepted) throw Error(AI_REJECTED);
      } else {
        let image,
          x = c.x,
          y = c.y;
        if (c.tool === "write_text") {
          image = textImage(c.text, c.fontSize, c.color, c.maxWidth, c.lineHeight);
        } else if (c.tool === "draw_formula") {
          image = await formulaImage(c.latex, c.fontSize, c.color);
        } else if (c.tool === "plot_function") {
          image = plot(c);
        } else if (c.tool === "draw") {
          const made = DRAW.render(c, offscreen, c.color);
          image = made.image;
          x = made.x;
          y = made.y;
        }
        if (image) {
          checkAI(revision, run);
          x = Math.max(0, Math.min(x, SIZE - Math.min(image.logicalWidth || image.width, SIZE)));
          y = Math.max(0, Math.min(y, SIZE - Math.min(image.logicalHeight || image.height, SIZE)));
          const accepted = await startPending(image, x, y, revision, meta, c);
          if (accepted === AI_CANCELLED) throw Error(AI_CANCELLED);
          if (accepted === AI_SUPERSEDED) throw Error(AI_SUPERSEDED);
          if (!accepted) throw Error(AI_REJECTED);
        }
      }
      debug("tool-complete", { ...meta, tool: c.tool, x: c.x, y: c.y });
    } catch (error) {
      if (![AI_CANCELLED, AI_REJECTED, AI_SUPERSEDED].includes(error.message)) debug("tool-error", { ...meta, tool: c.tool, error: error.message });
      throw error;
    }
  }
  async function preparePendingItem(c, revision, meta, run) {
    debug("tool-start", { ...meta, tool: c.tool, x: c.x, y: c.y, fontSize: c.fontSize, maxWidth: c.maxWidth, batch: true });
    checkAI(revision, run);
    if (c.tool === "erase") {
      const bounds = eraseBounds(c);
      return { command: c, erase: true, bounds, image: eraseMask(c, bounds) };
    }
    let image,
      x = c.x,
      y = c.y;
    if (c.tool === "write_text") image = textImage(c.text, c.fontSize, c.color, c.maxWidth, c.lineHeight);
    else if (c.tool === "draw_formula") image = await formulaImage(c.latex, c.fontSize, c.color);
    else if (c.tool === "plot_function") image = plot(c);
    else if (c.tool === "draw") {
      const made = DRAW.render(c, offscreen, c.color);
      image = made.image;
      x = made.x;
      y = made.y;
    }
    checkAI(revision, run);
    if (!image) throw Error(`Unable to prepare ${c.tool}`);
    const logicalWidth = c.tool === "write_text" ? c.maxWidth : image.logicalWidth || image.width,
      logicalHeight = image.logicalHeight || image.height;
    return {
      command: c,
      image,
      textCommand: c.tool === "write_text" ? { ...c } : null,
      x: Math.max(0, Math.min(x, SIZE - Math.min(logicalWidth, SIZE))),
      y: Math.max(0, Math.min(y, SIZE - Math.min(logicalHeight, SIZE))),
      layoutWidth: logicalWidth,
      layoutHeight: logicalHeight,
    };
  }
  function resolvePendingItemOverlaps(items, meta) {
    const gap = Math.max(40, 14 / Math.max(0.03, state.scale)),
      flow = items
        .filter((item) => ["write_text", "draw_formula"].includes(item.command.tool))
        .sort((a, b) => a.y - b.y || a.x - b.x),
      placed = [],
      fixed = items
        .filter((item) => !["write_text", "draw_formula", "draw"].includes(item.command.tool))
        .map((item) => item.erase ? item.bounds : { x: item.x, y: item.y, w: item.layoutWidth, h: item.layoutHeight });
    for (const item of flow) {
      const width = item.image.logicalWidth || item.image.width,
        height = item.image.logicalHeight || item.image.height;
      let y = item.y;
      for (let pass = 0; pass < items.length; pass++) {
        const collisions = [...fixed, ...placed].filter((prior) => {
          const horizontalOverlap = Math.min(item.x + width, prior.x + prior.w) - Math.max(item.x, prior.x),
            verticalOverlap = Math.min(y + height, prior.y + prior.h) - Math.max(y, prior.y);
          return horizontalOverlap > 0 && verticalOverlap > 0;
        });
        if (!collisions.length) break;
        y = Math.max(...collisions.map((prior) => prior.y + prior.h)) + gap;
      }
      const originalY = item.y;
      item.y = Math.max(0, Math.min(SIZE - height, y));
      if (item.y !== originalY) debug("tool-layout-adjusted", { ...meta, tool: item.command.tool, x: item.x, originalY, y: item.y, width, height });
      placed.push({ x: item.x, y: item.y, w: width, h: height });
    }
  }
  function textRasterMetrics(text, f, maxWidth = 900, lineHeight = 1.35) {
    const content = text.slice(0, 800),
      family = state.aiFont || "ui-rounded, system-ui, sans-serif";
    maxWidth = Math.max(f, Math.min(SIZE, maxWidth));
    const probe = offscreen(1, 1).getContext("2d");
    probe.font = `${f}px ${family}`;
    const layout = layoutText(content, probe, maxWidth),
      lines = layout.lines,
      widths = layout.widths,
      rowHeight = f * lineHeight,
      naturalWidth = Math.ceil(Math.min(maxWidth, Math.max(...widths)) + 8),
      naturalHeight = Math.ceil(lines.length * rowHeight + 8),
      rasterScale = Math.min(1, 4096 / naturalWidth, 4096 / naturalHeight, Math.sqrt(12000000 / (naturalWidth * naturalHeight))),
      rasterWidth=Math.max(1,Math.ceil(naturalWidth*rasterScale)),rasterHeight=Math.max(1,Math.ceil(naturalHeight*rasterScale));
    return{family,lines,widths,rowHeight,naturalWidth,naturalHeight,rasterScale,rasterWidth,rasterHeight,pixels:rasterWidth*rasterHeight};
  }
  function textImage(text, f, color, maxWidth = 900, lineHeight = 1.35) {
    const metrics=textRasterMetrics(text,f,maxWidth,lineHeight),
      {family,lines,widths,rowHeight,naturalWidth,naturalHeight,rasterScale,rasterWidth,rasterHeight}=metrics,
      image = offscreen(rasterWidth,rasterHeight),
      q = image.getContext("2d");
    q.font = `${f * rasterScale}px ${family}`;
    q.fillStyle = color || "#2563eb";
    q.textBaseline = "top";
    lines.forEach((value, i) => q.fillText(value, 2 * rasterScale, (2 + i * rowHeight) * rasterScale));
    image.revealRows = widths;
    image.revealRowHeight = rowHeight;
    image.naturalHeight = naturalHeight;
    image.naturalWidth = naturalWidth;
    image.logicalWidth = naturalWidth;
    image.logicalHeight = naturalHeight;
    return image;
  }
  function layoutText(content, context, maxWidth) {
    const lines = [],
      words = content.replace(/\r/g, "").split(/(\n|\s+)/),
      push = (line) => {
        if (line || !lines.length) lines.push(line);
      };
    let line = "";
    for (const word of words) {
      if (word === "\n") {
        lines.push(line);
        line = "";
        continue;
      }
      const candidate = line + word;
      if (context.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (context.measureText(word).width <= maxWidth) {
        push(line.trimEnd());
        line = word.trimStart();
        continue;
      }
      for (const char of word) {
        if (context.measureText(line + char).width > maxWidth && line) {
          push(line);
          line = char;
        } else line += char;
      }
    }
    push(line.trimEnd());
    return { lines, widths: lines.map((value) => Math.max(1, context.measureText(value).width)) };
  }
  async function formulaImage(latex, fontSize, color) {
    if (window.MathJax?.tex2svgPromise)
      try {
        const node = await window.MathJax.tex2svgPromise(latex, {
          display: false,
          containerWidth: SIZE,
        });
        const svg = node.querySelector("svg");
        if (!svg) throw Error("No MathJax SVG");
        const viewBox = (svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number),
          ratio = viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0 ? viewBox[2] / viewBox[3] : Math.max(0.7, latex.length * 0.65),
          h = Math.max(1, Math.ceil(fontSize * 1.35)),
          w = Math.max(1, Math.ceil(h * ratio));
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("width", String(w));
        svg.setAttribute("height", String(h));
        svg.setAttribute("color", color || "#2563eb");
        svg.setAttribute("fill", "currentColor");
        const xml = new XMLSerializer().serializeToString(svg),
          img = new Image(),
          url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
        try {
          img.src = url;
          await img.decode();
          const image = offscreen(w, h);
          image.getContext("2d").drawImage(img, 0, 0, w, h);
          return image;
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.warn("MathJax formula fallback", error);
      }
    return textImage(formulaText(latex), fontSize, color);
  }
  function formulaText(s) {
    return s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)").replace(/[\\{}]/g, "");
  }
  async function reveal(im, x, y, revision, duration = 1200) {
    const rows = im.revealRows || [im.width],
      rowHeight = im.revealRowHeight || im.height,
      total = rows.reduce((sum, width) => sum + width, 0),
      steps = Math.max(28, Math.min(180, Math.ceil(duration / 28)));
    for (let i = 1; i <= steps; i++) {
      checkAI(revision);
      const distance = (total * i) / steps;
      let consumed = 0,
        current = 0,
        currentWidth = 0;
      while (current < rows.length && consumed + rows[current] < distance) {
        consumed += rows[current];
        current++;
      }
      if (current < rows.length) currentWidth = Math.max(0, distance - consumed);
      render();
      ctx.save();
      ctx.translate(state.panX, state.panY);
      ctx.scale(state.scale, state.scale);
      ctx.beginPath();
      for (let row = 0; row < current; row++) ctx.rect(x, y + row * rowHeight, im.width, rowHeight);
      if (current < rows.length) ctx.rect(x, y + current * rowHeight, currentWidth, rowHeight);
      ctx.clip();
      ctx.drawImage(im, x, y);
      ctx.restore();
      await wait(duration / steps);
    }
    checkAI(revision);
    blit(im, x, y);
    render();
  }
  function blit(im, x, y, scale = 1) {
    blitStretched(im, x, y, scale, scale);
  }
  function blitStretched(im, x, y, scaleX, scaleY) {
    blitSized(im, x, y, im.width * scaleX, im.height * scaleY);
  }
  function blitSized(im, x, y, w, h) {
    const x0 = Math.max(0, Math.floor(x / TILE)),
      y0 = Math.max(0, Math.floor(y / TILE)),
      x1 = Math.min(Math.ceil(SIZE / TILE) - 1, Math.ceil((x + w) / TILE) - 1),
      y1 = Math.min(Math.ceil(SIZE / TILE) - 1, Math.ceil((y + h) / TILE) - 1);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        recordBefore(tx, ty);
        const t = tile(tx, ty);
        t.getContext("2d").drawImage(im, x - tx * TILE, y - ty * TILE, w, h);
        const local = intersection({ x: x - tx * TILE, y: y - ty * TILE, w, h }, { x: 0, y: 0, w: TILE, h: TILE });
        if (local) extendInkBounds(key(tx, ty), local);
      }
  }
  function blitClipped(im, x, y, w, h, clipW, clipH) {
    forTiles(x, y, clipW, clipH, (canvas, tx, ty) => {
      recordBefore(tx, ty);
      const tileContext = canvas.getContext("2d"),
        local = intersection({ x: x - tx * TILE, y: y - ty * TILE, w: clipW, h: clipH }, { x: 0, y: 0, w: TILE, h: TILE });
      if (!local) return;
      tileContext.save();
      tileContext.beginPath();
      tileContext.rect(local.x, local.y, local.w, local.h);
      tileContext.clip();
      tileContext.drawImage(im, x - tx * TILE, y - ty * TILE, w, h);
      tileContext.restore();
      extendInkBounds(key(tx, ty), local);
    });
  }
  function draftBounds(p) {
    if (p.items) return batchBounds(p);
    return {
      x: p.x,
      y: p.y,
      w: (p.textCommand ? p.layoutWidth : p.image.logicalWidth || p.image.width) * p.scale,
      h: (p.textCommand ? p.layoutHeight : p.image.logicalHeight || p.image.height) * p.scale,
    };
  }
  function pendingItemBounds(item) {
    const width = item.erase ? item.bounds.w : item.textCommand ? item.layoutWidth : item.image.logicalWidth || item.image.width,
      height = item.erase ? item.bounds.h : item.textCommand ? item.layoutHeight : item.image.logicalHeight || item.image.height;
    return { x: item.x, y: item.y, w: width * item.scaleX, h: height * item.scaleY };
  }
  function batchBounds(p) {
    const boxes = p.items.map(pendingItemBounds),
      left = Math.min(...boxes.map((box) => box.x)),
      top = Math.min(...boxes.map((box) => box.y)),
      right = Math.max(...boxes.map((box) => box.x + box.w)),
      bottom = Math.max(...boxes.map((box) => box.y + box.h));
    return { x: left, y: top, w: right - left, h: bottom - top };
  }
  function drawPending(p) {
    if (p.items) return drawPendingBatch(p);
    const b = draftBounds(p),
      progress = p.revealProgress ?? 1,
      rows = p.image.revealRows || [p.image.width],
      rowHeight = p.image.revealRowHeight || p.image.height,
      total = rows.reduce((sum, width) => sum + width, 0),
      distance = total * progress;
    let consumed = 0,
      current = 0,
      currentWidth = 0;
    while (current < rows.length && consumed + rows[current] < distance) {
      consumed += rows[current];
      current++;
    }
    if (current < rows.length) currentWidth = Math.max(0, distance - consumed);
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();
    ctx.beginPath();
    for (let row = 0; row < current; row++) ctx.rect(b.x, b.y + row * rowHeight * p.scale, b.w, rowHeight * p.scale);
    if (current < rows.length) ctx.rect(b.x, b.y + current * rowHeight * p.scale, currentWidth * p.scale, rowHeight * p.scale);
    ctx.clip();
    const imageWidth = (p.image.logicalWidth || p.image.width) * p.scale,
      imageHeight = (p.image.logicalHeight || p.image.height) * p.scale;
    ctx.drawImage(p.image, b.x, b.y, imageWidth, imageHeight);
    ctx.restore();
    if (progress < 1) {
      const tipX = b.x + currentWidth * p.scale,
        tipY = b.y + Math.min(current, rows.length - 1) * rowHeight * p.scale + rowHeight * p.scale * 0.72,
        unit = 1 / state.scale;
      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 * unit;
      ctx.lineCap = "round";
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(tipX - 7 * unit, tipY + 5 * unit);
      ctx.lineTo(tipX + 2 * unit, tipY - 4 * unit);
      ctx.stroke();
      ctx.restore();
      drawMoveHandle(ctx, b, 14 / state.scale, true);
      return;
    }
    const s = 14 / state.scale;
    ctx.save();
    ctx.strokeStyle = "#72b7e599";
    ctx.lineWidth = 1.5 / state.scale;
    ctx.setLineDash([7 / state.scale, 7 / state.scale]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
    ctx.strokeStyle = "#2679b8";
    ctx.lineWidth = 1.8 / state.scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(b.x - s * 0.55, b.y - s * 0.55);
    ctx.lineTo(b.x - s * 0.12, b.y - s * 0.12);
    ctx.moveTo(b.x - s * 0.12, b.y - s * 0.55);
    ctx.lineTo(b.x - s * 0.55, b.y - s * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x + b.w + s * 0.12, b.y - s * 0.34);
    ctx.lineTo(b.x + b.w + s * 0.3, b.y - s * 0.12);
    ctx.lineTo(b.x + b.w + s * 0.62, b.y - s * 0.58);
    ctx.stroke();
    ctx.beginPath();
    drawResizeHandle(ctx, b, s);
    ctx.stroke();
    drawMoveHandle(ctx, b, s, true);
    if (p.textCommand) {
      ctx.beginPath();
      ctx.moveTo(b.x + b.w + s * 0.08, b.y + b.h / 2 - s * 0.48);
      ctx.lineTo(b.x + b.w + s * 0.08, b.y + b.h / 2 + s * 0.48);
      ctx.moveTo(b.x + b.w / 2 - s * 0.48, b.y + b.h + s * 0.08);
      ctx.lineTo(b.x + b.w / 2 + s * 0.48, b.y + b.h + s * 0.08);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawPendingBatch(p) {
    const batch = batchBounds(p),
      unit = 1 / state.scale,
      s = 14 * unit;
    p.items.forEach((item, index) => {
      const box = pendingItemBounds(item);
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      if (item.erase) {
        ctx.globalAlpha = 0.18;
        ctx.drawImage(item.image, box.x, box.y, box.w, box.h);
      } else if (item.textCommand) {
        const imageWidth = (item.image.logicalWidth || item.image.width) * item.scaleX,
          imageHeight = (item.image.logicalHeight || item.image.height) * item.scaleY;
        ctx.drawImage(item.image, box.x, box.y, imageWidth, imageHeight);
      } else ctx.drawImage(item.image, box.x, box.y, box.w, box.h);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = index === p.selectedIndex ? "#2679b8" : "#72b7e577";
      ctx.lineWidth = (index === p.selectedIndex ? 2 : 1.2) * unit;
      ctx.setLineDash(index === p.selectedIndex ? [] : [6 * unit, 6 * unit]);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.restore();
      drawMoveHandle(ctx, box, s, index === p.selectedIndex);
      drawDraftActions(ctx, box, s);
    });
    if (p.items.length > 1) {
      ctx.save();
      ctx.strokeStyle = "#2679b866";
      ctx.lineWidth = 1.4 * unit;
      ctx.setLineDash([8 * unit, 7 * unit]);
      ctx.strokeRect(batch.x, batch.y, batch.w, batch.h);
      ctx.setLineDash([]);
      drawBatchMoveHandle(ctx, batch, s);
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = "#2679b8";
    ctx.lineWidth = 1.8 * unit;
    ctx.lineCap = "round";
    const selected = p.items[p.selectedIndex];
    if (selected) {
      const selectedBox = pendingItemBounds(selected);
      ctx.beginPath();
      drawResizeHandle(ctx, selectedBox, s);
      ctx.moveTo(selectedBox.x + selectedBox.w + s * 0.08, selectedBox.y + selectedBox.h / 2 - s * 0.48);
      ctx.lineTo(selectedBox.x + selectedBox.w + s * 0.08, selectedBox.y + selectedBox.h / 2 + s * 0.48);
      ctx.moveTo(selectedBox.x + selectedBox.w / 2 - s * 0.48, selectedBox.y + selectedBox.h + s * 0.08);
      ctx.lineTo(selectedBox.x + selectedBox.w / 2 + s * 0.48, selectedBox.y + selectedBox.h + s * 0.08);
      ctx.stroke();
    }
    ctx.restore();
  }
  function draftActionPoints(box, s) {
    return {
      "item-cancel": { x: box.x - s * 0.42, y: box.y - s * 0.42 },
      "item-accept": { x: box.x + box.w + s * 0.42, y: box.y - s * 0.42 },
    };
  }
  function drawDraftActions(context, box, s) {
    const actions = draftActionPoints(box, s),
      radius = s * 0.34;
    context.save();
    context.lineWidth = 1.8 / state.scale;
    context.lineCap = context.lineJoin = "round";
    for (const [action, point] of Object.entries(actions)) {
      context.fillStyle = "#fffdf5ee";
      context.strokeStyle = action === "item-cancel" ? "#dc2626" : "#16a34a";
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      if (action === "item-cancel") {
        context.moveTo(point.x - radius * 0.46, point.y - radius * 0.46);
        context.lineTo(point.x + radius * 0.46, point.y + radius * 0.46);
        context.moveTo(point.x + radius * 0.46, point.y - radius * 0.46);
        context.lineTo(point.x - radius * 0.46, point.y + radius * 0.46);
      } else {
        context.moveTo(point.x - radius * 0.5, point.y);
        context.lineTo(point.x - radius * 0.12, point.y + radius * 0.38);
        context.lineTo(point.x + radius * 0.55, point.y - radius * 0.48);
      }
      context.stroke();
    }
    context.restore();
  }
  function drawResizeHandle(context, b, s) {
    context.moveTo(b.x + b.w - s * 0.52, b.y + b.h);
    context.lineTo(b.x + b.w, b.y + b.h - s * 0.52);
    context.moveTo(b.x + b.w - s * 0.28, b.y + b.h);
    context.lineTo(b.x + b.w, b.y + b.h - s * 0.28);
  }
  function drawMoveHandle(context, b, s, selected) {
    const x = b.x + b.w / 2,
      y = b.y - s * 0.46,
      radius = s * 0.34;
    context.save();
    context.fillStyle = selected ? "#eef8ff" : "#eef8ffcc";
    context.strokeStyle = selected ? "#2679b8" : "#72b7e5";
    context.lineWidth = 1.5 / state.scale;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(x - radius * 0.55, y);
    context.lineTo(x + radius * 0.55, y);
    context.moveTo(x, y - radius * 0.55);
    context.lineTo(x, y + radius * 0.55);
    context.stroke();
    context.restore();
  }
  function batchMovePoint(box, s) {
    const above = box.y - s * 1.85;
    return { x: box.x + box.w / 2, y: above >= 0 ? above : Math.min(SIZE - s * 0.55, Math.max(s * 0.55, box.y + s * 0.8)) };
  }
  function drawBatchMoveHandle(context, box, s) {
    const point = batchMovePoint(box, s),
      radius = s * 0.44;
    context.save();
    context.fillStyle = "#2679b8";
    context.strokeStyle = "#eef8ff";
    context.lineWidth = 1.8 / state.scale;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.strokeStyle = "#fff";
    context.lineWidth = 1.5 / state.scale;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(point.x - radius * 0.55, point.y);
    context.lineTo(point.x + radius * 0.55, point.y);
    context.moveTo(point.x, point.y - radius * 0.55);
    context.lineTo(point.x, point.y + radius * 0.55);
    context.moveTo(point.x - radius * 0.55, point.y);
    context.lineTo(point.x - radius * 0.3, point.y - radius * 0.2);
    context.moveTo(point.x - radius * 0.55, point.y);
    context.lineTo(point.x - radius * 0.3, point.y + radius * 0.2);
    context.moveTo(point.x + radius * 0.55, point.y);
    context.lineTo(point.x + radius * 0.3, point.y - radius * 0.2);
    context.moveTo(point.x + radius * 0.55, point.y);
    context.lineTo(point.x + radius * 0.3, point.y + radius * 0.2);
    context.moveTo(point.x, point.y - radius * 0.55);
    context.lineTo(point.x - radius * 0.2, point.y - radius * 0.3);
    context.moveTo(point.x, point.y - radius * 0.55);
    context.lineTo(point.x + radius * 0.2, point.y - radius * 0.3);
    context.moveTo(point.x, point.y + radius * 0.55);
    context.lineTo(point.x - radius * 0.2, point.y + radius * 0.3);
    context.moveTo(point.x, point.y + radius * 0.55);
    context.lineTo(point.x + radius * 0.2, point.y + radius * 0.3);
    context.stroke();
    context.restore();
  }
  function pendingHit(p, e, moveOnly = false) {
    const q = clientPoint(e),
      b = draftBounds(p),
      s = 14 / state.scale;
    if (p.items) {
      const controlRadius = Math.max(s * 0.8, 9 / state.scale),
        handleRadius = Math.max(s * 0.72, 8 / state.scale),
        controls = [],
        addControl = (hit, point, radius, itemIndex, z) => {
          const distance = Math.hypot(q.x - point.x, q.y - point.y);
          if (distance <= radius) controls.push({ hit, itemIndex, distance, z });
        };
      const selected = p.items[p.selectedIndex];
      if (selected && !moveOnly) {
        const box = pendingItemBounds(selected),
          handles = [
            { hit: "resize", point: { x: box.x + box.w, y: box.y + box.h } },
            { hit: "width", point: { x: box.x + box.w + s * 0.08, y: box.y + box.h / 2 } },
            { hit: "height", point: { x: box.x + box.w / 2, y: box.y + box.h + s * 0.08 } },
          ];
        handles.forEach((handle, index) => addControl(handle.hit, handle.point, handleRadius, p.selectedIndex, p.items.length * 10 + 20 + index));
      }
      if (p.items.length > 1) {
        const batchPoint = batchMovePoint(b, s);
        addControl("batch-move", batchPoint, Math.max(s * 0.8, 10 / state.scale), null, p.items.length * 10 + 10);
      }
      for (let index = p.items.length - 1; index >= 0; index--) {
        const box = pendingItemBounds(p.items[index]);
        if (!moveOnly) Object.entries(draftActionPoints(box, s)).forEach(([hit, point], actionIndex) => addControl(hit, point, controlRadius, index, index * 10 + 2 + actionIndex));
        const movePoint = { x: box.x + box.w / 2, y: box.y - s * 0.46 };
        addControl("move-handle", movePoint, handleRadius, index, index * 10 + 1);
      }
      controls.sort((a, b) => a.distance - b.distance || b.z - a.z);
      if (controls[0]) return { hit: controls[0].hit, itemIndex: controls[0].itemIndex };
      for (let index = p.items.length - 1; index >= 0; index--) {
        const box = pendingItemBounds(p.items[index]);
        if (q.x >= box.x && q.x <= box.x + box.w && q.y >= box.y && q.y <= box.y + box.h) return { hit: "move", itemIndex: index };
      }
      return null;
    }
    const moveHandle = { x: b.x + b.w / 2, y: b.y - s * 0.46 };
    if (Math.hypot(q.x - moveHandle.x, q.y - moveHandle.y) <= Math.max(s * 0.8, 9 / state.scale)) return "move-handle";
    if (moveOnly) return q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h ? "move" : null;
    const points = {
        cancel: { x: b.x - s * 0.4, y: b.y - s * 0.4 },
        accept: { x: b.x + b.w + s * 0.4, y: b.y - s * 0.4 },
        resize: { x: b.x + b.w, y: b.y + b.h },
      };
    if (p.textCommand || p.items) {
      points.width = { x: b.x + b.w + s * 0.08, y: b.y + b.h / 2 };
      points.height = { x: b.x + b.w / 2, y: b.y + b.h + s * 0.08 };
    }
    for (const [name, v] of Object.entries(points)) if (Math.hypot(q.x - v.x, q.y - v.y) <= Math.max(s * 1.8, 18 / state.scale)) return name;
    return q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h ? "move" : null;
  }
  function acceptPending() {
    const p = state.pending;
    if (!p) return;
    if (p.revision !== state.userRevision && state.userRevision !== p.latestUserRevision) {
      rejectPending();
      setStatusKey("canvasChanged");
      return;
    }
    const acceptedCount = p.items ? (p.acceptedItems || 0) + p.items.length : 1;
    if (p.items) {
      commitPendingBatch(p);
      consumePendingInput(p);
    }
    else if (p.textCommand) {
      const box = draftBounds(p);
      blitClipped(p.image, p.x, p.y, (p.image.logicalWidth || p.image.width) * p.scale, (p.image.logicalHeight || p.image.height) * p.scale, box.w, box.h);
    }
    else blitSized(p.image, p.x, p.y, (p.image.logicalWidth || p.image.width) * p.scale, (p.image.logicalHeight || p.image.height) * p.scale);
    state.pending = null;
    state.pendingGesture = null;
    updateBatchActions();
    save();
    render();
    setStatusKey("merged");
    p.resolve?.(p.items ? { acceptedCount } : true);
  }
  function acceptPendingItem(index) {
    const p = state.pending,
      item = p?.items?.[index];
    if (!item) return;
    if (p.revision !== state.userRevision && state.userRevision !== p.latestUserRevision) {
      rejectPending();
      setStatusKey("canvasChanged");
      return;
    }
    commitPendingItem(item);
    p.acceptedItems = (p.acceptedItems || 0) + 1;
    consumePendingInput(p);
    removePendingItem(p, index);
    save();
    finishPendingItemAction(p, "itemAccepted");
  }
  function rejectPendingItem(index) {
    const p = state.pending;
    if (!p?.items?.[index]) return;
    removePendingItem(p, index);
    finishPendingItemAction(p, "itemDiscarded");
  }
  function removePendingItem(p, index) {
    const selected = p.items[p.selectedIndex],
      removedSelected = selected === p.items[index];
    p.items.splice(index, 1);
    if (removedSelected) p.selectedIndex = Math.max(0, Math.min(index, p.items.length - 1));
    else p.selectedIndex = Math.max(0, p.items.indexOf(selected));
    state.pendingGesture = null;
  }
  function consumePendingInput(p) {
    if (p.inputConsumed) return;
    p.inputConsumed = true;
    if (state.activeAI) {
      state.activeAI.dirtyRestored = true;
      state.activeAI.inputConsumed = true;
    }
    state.lastUserBox = p.latestBox;
    if (p.hotspotEnd) {
      const end = state.hotspotTrail.indexOf(p.hotspotEnd);
      if (end >= 0) state.hotspotTrail.splice(0, end + 1);
    }
  }
  function finishPendingItemAction(p, statusKey) {
    if (p.items.length) {
      setStatusKey(statusKey);
      updateBatchActions();
      render();
      return;
    }
    state.pending = null;
    state.pendingGesture = null;
    updateBatchActions();
    render();
    const accepted = Boolean(p.acceptedItems);
    setStatusKey(accepted ? "merged" : "draftRejected");
    p.resolve?.(p.acceptedItems ? { acceptedCount: p.acceptedItems } : false);
  }
  function rejectPending() {
    if (!state.pending) return;
    const p = state.pending;
    state.pending = null;
    state.pendingGesture = null;
    updateBatchActions();
    render();
    const accepted = Boolean(p.acceptedItems);
    setStatusKey(accepted ? "merged" : "draftRejected");
    p.resolve?.(p.items && p.acceptedItems ? { acceptedCount: p.acceptedItems } : false);
  }
  function fadePendingForContinuedInput() {
    const p = state.pending;
    if (!p || p.fading) return;
    p.fading = true;
    p.fadeProgress = 0;
    state.pendingGesture = null;
    updateBatchActions();
    setStatusKey("draftFading");
    const started = performance.now(),
      duration = 560;
    function step(now) {
      if (state.pending !== p) return;
      p.fadeProgress = Math.min(1, (now - started) / duration);
      render();
      if (p.fadeProgress < 1) {
        requestAnimationFrame(step);
        return;
      }
      state.pending = null;
      updateBatchActions();
      render();
      p.resolve?.(p.acceptedItems ? { acceptedCount: p.acceptedItems } : AI_SUPERSEDED);
    }
    requestAnimationFrame(step);
  }
  function notePendingContinuedInput(drawing) {
    const p = state.pending;
    if (!p || p.fading) return;
    p.latestUserRevision = state.userRevision;
    const meaningful = drawing.screenDistance >= 7 || drawing.bbox.w * drawing.bbox.h >= 36;
    if (!meaningful) return;
    p.continuedStrokes = (p.continuedStrokes || 0) + 1;
    p.continuedDistance = (p.continuedDistance || 0) + drawing.screenDistance;
    if (p.continuedStrokes >= 2) fadePendingForContinuedInput();
  }
  function cancelPendingForRevision() {
    if (!state.pending) return;
    const p = state.pending;
    state.pending = null;
    state.pendingGesture = null;
    updateBatchActions();
    render();
    p.resolve?.(AI_CANCELLED);
  }
  function startPending(image, x, y, revision, meta, command) {
    return new Promise((resolve) => {
      const rows = image.revealRows || [image.width],
        distance = rows.reduce((sum, width) => sum + width, 0),
        duration = Math.max(900, Math.min(6200, distance * 0.7));
      state.pending = {
        image,
        x,
        y,
        scale: 1,
        textCommand: command.tool === "write_text" ? { ...command } : null,
        layoutWidth: command.tool === "write_text" ? command.maxWidth : image.logicalWidth || image.width,
        layoutHeight: command.tool === "write_text" ? image.logicalHeight || image.height : image.logicalHeight || image.height,
        heightLocked: false,
        revealProgress: 0,
        revision,
        meta,
        resolve,
      };
      updateBatchActions();
      const p = state.pending,
        started = performance.now();
      function step(now) {
        if (!state.pending || state.pending !== p) return;
        p.revealProgress = Math.min(1, (now - started) / duration);
        render();
        if (p.revealProgress < 1) requestAnimationFrame(step);
        else setStatusKey("draftReady");
      }
      requestAnimationFrame(step);
    });
  }
  function startPendingBatch(items, revision, meta) {
    return new Promise((resolve) => {
      state.pending = {
        items: items.map((item) => ({ ...item, x: item.erase ? item.bounds.x : item.x, y: item.erase ? item.bounds.y : item.y, scaleX: 1, scaleY: 1 })),
        selectedIndex: 0,
        revealProgress: 1,
        revision,
        meta,
        latestBox: state.activeAI?.dirtySnapshot || state.lastUserBox,
        hotspotEnd: state.hotspotTrail.at(-1) || null,
        resolve,
      };
      updateBatchActions();
      setStatusKey("batchDraftReady");
      render();
    });
  }
  function commitPendingBatch(p) {
    for (const item of p.items) commitPendingItem(item);
  }
  function commitPendingItem(item) {
    const box = pendingItemBounds(item);
    if (item.erase) eraseWithMask(item.image, box.x, box.y, box.w, box.h);
    else if (item.textCommand) blitClipped(item.image, item.x, item.y, (item.image.logicalWidth || item.image.width) * item.scaleX, (item.image.logicalHeight || item.image.height) * item.scaleY, box.w, box.h);
    else blitSized(item.image, box.x, box.y, (item.image.logicalWidth || item.image.width) * item.scaleX, (item.image.logicalHeight || item.image.height) * item.scaleY);
  }
  function beginPendingGesture(e, hit, itemIndex = null) {
    const p = state.pending,
      q = clientPoint(e);
    if (p.items && itemIndex != null) p.selectedIndex = itemIndex;
    const gesture = {
      id: e.pointerId,
      hit,
      itemIndex,
      last: q,
      armed: hit !== "move" || e.pointerType === "mouse",
      startX: q.x,
      startY: q.y,
    };
    if (p.items && hit === "batch-move") {
      gesture.batchStartBounds = batchBounds(p);
      gesture.itemStarts = p.items.map((item) => ({ x: item.x, y: item.y }));
    }
    state.pendingGesture = gesture;
    if (state.pendingGesture.armed) {
      state.pendingGesture.armed = true;
      setCanvasCursor(hit === "resize" ? "nwse-resize" : hit === "width" ? "ew-resize" : hit === "height" ? "ns-resize" : "grabbing");
      render();
      return;
    }
    state.pendingGesture.timer = setTimeout(() => {
      if (state.pendingGesture?.id === e.pointerId) {
        state.pendingGesture.armed = true;
        setCanvasCursor(hit === "resize" ? "nwse-resize" : hit === "width" ? "ew-resize" : hit === "height" ? "ns-resize" : "grabbing");
      }
    }, 260);
  }
  function updatePendingGesture(e) {
    const g = state.pendingGesture,
      p = state.pending;
    if (!g || !p || g.id !== e.pointerId) return false;
    const q = clientPoint(e);
    if (p.items) {
      if (g.hit === "batch-move") {
        if (g.armed) {
          const box = g.batchStartBounds,
            dx = Math.max(-box.x, Math.min(SIZE - box.x - box.w, q.x - g.startX)),
            dy = Math.max(-box.y, Math.min(SIZE - box.y - box.h, q.y - g.startY));
          p.items.forEach((item, index) => {
            item.x = g.itemStarts[index].x + dx;
            item.y = g.itemStarts[index].y + dy;
          });
        }
        g.last = q;
        if (g.armed) render();
        return true;
      }
      const item = p.items[g.itemIndex],
        box = item ? pendingItemBounds(item) : null;
      if (!item || !box) return false;
      if ((g.hit === "move" || g.hit === "move-handle") && g.armed) {
        item.x = Math.max(0, Math.min(SIZE - box.w, item.x + q.x - g.last.x));
        item.y = Math.max(0, Math.min(SIZE - box.h, item.y + q.y - g.last.y));
      } else if (g.hit === "resize" && g.armed) {
        const baseWidth = box.w / item.scaleX,
          baseHeight = box.h / item.scaleY,
          minimum = Math.max(40 / baseWidth, 40 / baseHeight),
          maximum = Math.min((SIZE - item.x) / baseWidth, (SIZE - item.y) / baseHeight),
          next = Math.max(minimum, Math.min(maximum, Math.max((q.x - item.x) / baseWidth, (q.y - item.y) / baseHeight)));
        item.scaleX = item.scaleY = next;
      } else if (g.hit === "width" && g.armed) {
        if (item.textCommand) {
          const layoutWidth=Math.max(item.textCommand.fontSize,Math.min((SIZE-item.x)/item.scaleX,(q.x-item.x)/item.scaleX));
          item.layoutWidth=layoutWidth;
          item.image=textImage(item.textCommand.text,item.textCommand.fontSize,item.textCommand.color,item.layoutWidth,item.textCommand.lineHeight);
          if(!item.heightLocked)item.layoutHeight=item.image.logicalHeight||item.image.height;
        } else {
          const baseWidth = box.w / item.scaleX;
          item.scaleX = Math.max(40 / baseWidth, Math.min((SIZE - item.x) / baseWidth, (q.x - item.x) / baseWidth));
        }
      } else if (g.hit === "height" && g.armed) {
        if (item.textCommand) {
          item.layoutHeight = Math.max(item.textCommand.fontSize * item.textCommand.lineHeight + 8, Math.min((SIZE - item.y) / item.scaleY, (q.y - item.y) / item.scaleY));
          item.heightLocked = true;
        } else {
          const baseHeight = box.h / item.scaleY;
          item.scaleY = Math.max(40 / baseHeight, Math.min((SIZE - item.y) / baseHeight, (q.y - item.y) / baseHeight));
        }
      }
      g.last = q;
      if (g.armed) render();
      return true;
    }
    if ((g.hit === "move" || g.hit === "move-handle") && g.armed) {
      const b = draftBounds(p);
      p.x = Math.max(0, Math.min(SIZE - b.w, p.x + q.x - g.last.x));
      p.y = Math.max(0, Math.min(SIZE - b.h, p.y + q.y - g.last.y));
    } else if (g.hit === "resize" && g.armed) {
      const minimum = 40,
        baseWidth = p.textCommand ? p.layoutWidth : p.image.logicalWidth || p.image.width,
        baseHeight = p.textCommand ? p.layoutHeight : p.image.logicalHeight || p.image.height,
        ratio = Math.max(minimum / baseWidth, minimum / baseHeight),
        maxScale = Math.max(ratio, Math.min((SIZE - p.x) / baseWidth, (SIZE - p.y) / baseHeight)),
        next = Math.max(ratio, Math.min(maxScale, (q.x - p.x) / baseWidth));
      p.scale = next;
    } else if (g.hit === "width" && g.armed && p.textCommand) {
      const layoutWidth=Math.max(p.textCommand.fontSize,Math.min(SIZE-p.x,(q.x-p.x)/p.scale));
      p.layoutWidth=layoutWidth;
      p.image=textImage(p.textCommand.text,p.textCommand.fontSize,p.textCommand.color,p.layoutWidth,p.textCommand.lineHeight);
      if(!p.heightLocked)p.layoutHeight=p.image.logicalHeight||p.image.height;
    } else if (g.hit === "height" && g.armed && p.textCommand) {
      p.layoutHeight = Math.max(p.textCommand.fontSize * p.textCommand.lineHeight + 8, Math.min(SIZE - p.y, (q.y - p.y) / p.scale));
      p.heightLocked = true;
    }
    g.last = q;
    if (g.armed) render();
    return true;
  }
  function eraseRect(x, y, w, h) {
    forTiles(
      x,
      y,
      w,
      h,
      (t, tx, ty) => {
        recordBefore(tx, ty);
        t.getContext("2d").clearRect(x - tx * TILE, y - ty * TILE, w, h);
        state.inkBounds.delete(key(tx, ty));
      },
      false,
    );
  }
  function eraseMask(c, bounds) {
    const image = offscreen(Math.max(1, bounds.w), Math.max(1, bounds.h)),
      context = image.getContext("2d");
    context.fillStyle = "#dc2626";
    context.strokeStyle = "#dc2626";
    if (c.mode === "path") {
      context.lineWidth = c.size;
      context.lineCap = context.lineJoin = "round";
      context.beginPath();
      c.points.forEach(([x, y], index) => {
        const px = x - bounds.x,
          py = y - bounds.y;
        if (index) context.lineTo(px, py);
        else context.moveTo(px, py);
      });
      if (c.points.length === 1) context.lineTo(c.points[0][0] - bounds.x + 0.01, c.points[0][1] - bounds.y + 0.01);
      context.stroke();
    } else context.fillRect(0, 0, image.width, image.height);
    return image;
  }
  function eraseWithMask(image, x, y, w, h) {
    forTiles(
      x,
      y,
      w,
      h,
      (canvas, tx, ty) => {
        recordBefore(tx, ty);
        const context = canvas.getContext("2d");
        context.save();
        context.globalCompositeOperation = "destination-out";
        context.drawImage(image, x - tx * TILE, y - ty * TILE, w, h);
        context.restore();
        state.inkBounds.delete(key(tx, ty));
      },
      false,
    );
  }
  function eraseBounds(c) {
    if (c.mode !== "path") return { x: c.x, y: c.y, w: c.w, h: c.h };
    const xs = c.points.map((p) => p[0]),
      ys = c.points.map((p) => p[1]),
      pad = c.size / 2;
    return {
      x: Math.max(0, Math.min(...xs) - pad),
      y: Math.max(0, Math.min(...ys) - pad),
      w: Math.min(SIZE, Math.max(...xs) + pad) - Math.max(0, Math.min(...xs) - pad),
      h: Math.min(SIZE, Math.max(...ys) + pad) - Math.max(0, Math.min(...ys) - pad),
    };
  }
  async function previewErase(c, revision) {
    const b = eraseBounds(c);
    for (let i = 1; i <= 12; i++) {
      checkAI(revision);
      render();
      ctx.save();
      ctx.translate(state.panX, state.panY);
      ctx.scale(state.scale, state.scale);
      ctx.fillStyle = "rgba(220,38,38,.16)";
      ctx.fillRect(b.x, b.y, (b.w * i) / 12, b.h);
      ctx.restore();
      await wait(22);
    }
  }
  function commitErasePath(c) {
    const pts = c.points.map(([x, y]) => ({ x, y }));
    if (pts.length === 1) pts.push({ ...pts[0] });
    for (let i = 1; i < pts.length; i++) stroke(pts[i - 1], pts[i], true, c.size, false);
  }
  function compileExpression(source) {
    const text = normalizePlotExpression(source)
      .trim()
      .replace(/^y\s*=\s*/i, "");
    if (!text || text.length > 180 || !/^[\d\sA-Za-z_+\-*/^().]+$/.test(text)) throw Error("Unsupported expression");
    const tokens = [],
      re = /\s*(\d*\.?\d+(?:e[+\-]?\d+)?|[A-Za-z_]+|[()+\-*/^])/gy;
    let at = 0,
      m;
    while ((m = re.exec(text))) {
      if (m.index !== at) throw Error("Invalid token");
      tokens.push(m[1]);
      at = re.lastIndex;
    }
    if (at !== text.length || tokens.length > 100) throw Error("Expression too complex");
    let i = 0;
    const funcs = {
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      sqrt: Math.sqrt,
      abs: Math.abs,
      exp: Math.exp,
      log: Math.log,
      ln: Math.log,
    };
    function take(v) {
      if (tokens[i] === v) {
        i++;
        return true;
      }
      return false;
    }
    function primary() {
      const t = tokens[i++];
      if (t === "(") {
        const v = add();
        if (!take(")")) throw Error("Unclosed parenthesis");
        return v;
      }
      if (/^\d|^\./.test(t || "")) return () => Number(t);
      if (t === "x") return (x) => x;
      if (t === "pi") return () => Math.PI;
      if (t === "e") return () => Math.E;
      if (funcs[t]) {
        if (!take("(")) throw Error("Function needs parentheses");
        const arg = add();
        if (!take(")")) throw Error("Unclosed function");
        return (x) => funcs[t](arg(x));
      }
      throw Error("Unknown identifier");
    }
    function unary() {
      if (take("+")) return unary();
      if (take("-")) {
        const v = unary();
        return (x) => -v(x);
      }
      return primary();
    }
    function power() {
      let left = unary();
      if (take("^")) {
        const right = power(),
          old = left;
        left = (x) => old(x) ** right(x);
      }
      return left;
    }
    function multiply() {
      let left = power();
      while (tokens[i] === "*" || tokens[i] === "/") {
        const op = tokens[i++],
          right = power(),
          old = left;
        left = op === "*" ? (x) => old(x) * right(x) : (x) => old(x) / right(x);
      }
      return left;
    }
    function add() {
      let left = multiply();
      while (tokens[i] === "+" || tokens[i] === "-") {
        const op = tokens[i++],
          right = multiply(),
          old = left;
        left = op === "+" ? (x) => old(x) + right(x) : (x) => old(x) - right(x);
      }
      return left;
    }
    const result = add();
    if (i !== tokens.length) throw Error("Unexpected expression tail");
    return result;
  }
  function normalizePlotExpression(source) {
    return String(source || "")
      .trim()
      .replace(/[−–—]/g, "-")
      .replace(/[×·]/g, "*")
      .replace(/÷/g, "/")
      .replace(/π/gi, "pi")
      .replace(/√\s*\(([^()]*)\)/g, "sqrt($1)")
      .replace(/√\s*([A-Za-z0-9_.]+)/g, "sqrt($1)")
      .replace(/(\d|\)|x(?![A-Za-z_])|pi(?![A-Za-z_])|e(?![A-Za-z_]))\s*(?=x|pi|e(?![+\-]?\d)|sin|cos|tan|sqrt|abs|exp|log|ln|\()/gi, "$1*");
  }
  function plot(c) {
    const o = offscreen(c.w, c.h),
      q = o.getContext("2d"),
      minSide = Math.min(c.w, c.h),
      tickFont = Math.max(10, Math.min(96, minSide * 0.032)),
      titleFont = Math.max(11, Math.min(112, minSide * 0.041)),
      margin = {
        left: Math.max(42, minSide * 0.105),
        right: Math.max(24, minSide * 0.06),
        top: Math.max(42, minSide * 0.12),
        bottom: Math.max(38, minSide * 0.1),
      },
      area = {
        left: margin.left,
        top: margin.top,
        right: c.w - margin.right,
        bottom: c.h - margin.bottom,
      },
      plotWidth = Math.max(1, area.right - area.left),
      plotHeight = Math.max(1, area.bottom - area.top),
      gridWidth = Math.max(0.75, Math.min(5, minSide * 0.002)),
      axisWidth = Math.max(1.5, Math.min(9, minSide * 0.004)),
      curveWidth = Math.max(2.2, Math.min(13, minSide * 0.006));
    let evaluate;
    try {
      evaluate = compileExpression(c.expression);
    } catch {
      return o;
    }
    const view = plotView(evaluate),
      { xMin, xMax, yMin, yMax } = view,
      xPixel = (x) => area.left + ((x - xMin) / (xMax - xMin)) * plotWidth,
      yPixel = (y) => area.bottom - ((y - yMin) / (yMax - yMin)) * plotHeight,
      axisX = Math.max(area.left, Math.min(area.right, xPixel(0))),
      axisY = Math.max(area.top, Math.min(area.bottom, yPixel(0))),
      xStep = nicePlotStep(xMax - xMin, Math.max(2, plotWidth / 72)),
      yStep = nicePlotStep(yMax - yMin, Math.max(2, plotHeight / 52)),
      xTicks = plotTicks(xMin, xMax, xStep),
      yTicks = plotTicks(yMin, yMax, yStep);

    q.save();
    q.lineCap = q.lineJoin = "round";
    q.strokeStyle = "rgba(148, 163, 184, 0.34)";
    q.lineWidth = gridWidth;
    q.beginPath();
    for (const x of xTicks) {
      if (Math.abs(x) > xStep * 1e-9) {
        const px = xPixel(x);
        q.moveTo(px, area.top);
        q.lineTo(px, area.bottom);
      }
    }
    for (const y of yTicks) {
      if (Math.abs(y) > yStep * 1e-9) {
        const py = yPixel(y);
        q.moveTo(area.left, py);
        q.lineTo(area.right, py);
      }
    }
    q.stroke();

    q.strokeStyle = "#475569";
    q.fillStyle = "#475569";
    q.lineWidth = axisWidth;
    q.beginPath();
    q.moveTo(area.left, axisY);
    q.lineTo(area.right, axisY);
    q.moveTo(axisX, area.bottom);
    q.lineTo(axisX, area.top);
    q.stroke();
    const arrow = Math.max(6, Math.min(24, tickFont * 0.62));
    q.beginPath();
    q.moveTo(area.right, axisY);
    q.lineTo(area.right - arrow, axisY - arrow * 0.55);
    q.lineTo(area.right - arrow, axisY + arrow * 0.55);
    q.closePath();
    q.moveTo(axisX, area.top);
    q.lineTo(axisX - arrow * 0.55, area.top + arrow);
    q.lineTo(axisX + arrow * 0.55, area.top + arrow);
    q.closePath();
    q.fill();

    const tickLength = Math.max(4, Math.min(18, tickFont * 0.42));
    q.font = `500 ${tickFont}px ui-sans-serif, system-ui, sans-serif`;
    q.textBaseline = axisY > area.bottom - tickFont * 1.8 ? "bottom" : "top";
    q.textAlign = "center";
    q.beginPath();
    for (const x of xTicks) {
      const px = xPixel(x);
      q.moveTo(px, axisY - tickLength / 2);
      q.lineTo(px, axisY + tickLength / 2);
    }
    for (const y of yTicks) {
      const py = yPixel(y);
      q.moveTo(axisX - tickLength / 2, py);
      q.lineTo(axisX + tickLength / 2, py);
    }
    q.stroke();
    for (const x of xTicks) {
      if (Math.abs(x) > xStep * 1e-9) q.fillText(formatPlotTick(x, xStep), xPixel(x), axisY + (q.textBaseline === "top" ? tickLength * 0.7 : -tickLength * 0.7));
    }
    q.textAlign = axisX < area.left + tickFont * 3 ? "left" : "right";
    q.textBaseline = "middle";
    for (const y of yTicks) {
      if (Math.abs(y) > yStep * 1e-9) q.fillText(formatPlotTick(y, yStep), axisX + (q.textAlign === "left" ? tickLength * 0.8 : -tickLength * 0.8), yPixel(y));
    }
    q.textAlign = "left";
    q.textBaseline = "bottom";
    q.font = `600 ${titleFont}px ui-sans-serif, system-ui, sans-serif`;
    q.fillText("x", area.right - titleFont * 0.35, Math.max(area.top + titleFont, axisY - titleFont * 0.28));
    q.fillText("y", Math.min(area.right - titleFont, axisX + titleFont * 0.28), area.top + titleFont * 0.9);
    const title = `y = ${normalizePlotExpression(c.expression).replace(/^y\s*=\s*/i, "")}`;
    q.fillStyle = c.color || "#2563eb";
    q.textBaseline = "top";
    q.fillText(fitCanvasText(q, title, plotWidth), area.left, Math.max(2, (margin.top - titleFont) / 2));

    q.save();
    q.beginPath();
    q.rect(area.left, area.top, plotWidth, plotHeight);
    q.clip();
    q.strokeStyle = c.color || "#2563eb";
    q.lineWidth = curveWidth;
    q.beginPath();
    let joined = false,
      previousPy = 0,
      previousX = 0;
    const sampleStep = Math.max(0.5, Math.min(2, 900 / plotWidth));
    for (let px = area.left; px <= area.right; px += sampleStep) {
      const x = xMin + ((px - area.left) / plotWidth) * (xMax - xMin);
      let y;
      try {
        y = evaluate(x);
      } catch {
        y = NaN;
      }
      const py = yPixel(y),
        visibleEnough = Number.isFinite(py) && py > area.top - plotHeight * 2 && py < area.bottom + plotHeight * 2,
        midpointY = joined ? evaluate((previousX + x) / 2) : y,
        discontinuity = joined && (!Number.isFinite(midpointY) || Math.abs(py - previousPy) > plotHeight * 0.75 || Math.abs(yPixel(midpointY) - (py + previousPy) / 2) > plotHeight * 0.5);
      if (visibleEnough) {
        if (!joined) {
          q.moveTo(px, py);
          joined = true;
        } else if (discontinuity) q.moveTo(px, py);
        else q.lineTo(px, py);
        previousPy = py;
        previousX = x;
      } else joined = false;
    }
    q.stroke();
    q.restore();
    q.restore();
    return o;
  }
  function plotView(evaluate) {
    for (const extent of [5, 10, 100, 1000, 10000]) {
      const values = [];
      for (let i = 0; i <= 240; i++) {
        const y = evaluate(-extent + (i / 240) * extent * 2);
        if (Number.isFinite(y)) values.push(y);
      }
      if (values.length < 8) continue;
      if (extent === 5 && values.some((y) => y >= -10 && y <= 10)) return { xMin: -5, xMax: 5, yMin: -10, yMax: 10 };
      values.sort((a, b) => a - b);
      let low = values[Math.floor(values.length * 0.02)],
        high = values[Math.ceil(values.length * 0.98) - 1];
      if (low === high) {
        const padding = Math.max(1, Math.abs(low) * 0.1);
        low -= padding;
        high += padding;
      } else {
        const padding = (high - low) * 0.1;
        low -= padding;
        high += padding;
      }
      const step = nicePlotStep(high - low, 8);
      return { xMin: -extent, xMax: extent, yMin: Math.floor(low / step) * step, yMax: Math.ceil(high / step) * step };
    }
    return { xMin: -5, xMax: 5, yMin: -10, yMax: 10 };
  }
  function nicePlotStep(range, targetTicks) {
    const rough = Math.max(Number.MIN_VALUE, range / Math.max(1, targetTicks)),
      power = 10 ** Math.floor(Math.log10(rough)),
      normalized = rough / power,
      factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return factor * power;
  }
  function plotTicks(min, max, step) {
    const values = [],
      first = Math.ceil((min - step * 1e-9) / step) * step;
    for (let value = first; value <= max + step * 1e-9 && values.length < 40; value += step) values.push(Math.abs(value) < step * 1e-9 ? 0 : value);
    return values;
  }
  function formatPlotTick(value, step) {
    const digits = Math.max(0, Math.min(6, -Math.floor(Math.log10(step))));
    return Number(value.toFixed(digits)).toString();
  }
  function fitCanvasText(context, text, maxWidth) {
    if (context.measureText(text).width <= maxWidth) return text;
    let low = 0,
      high = text.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (context.measureText(`${text.slice(0, middle)}...`).width <= maxWidth) low = middle;
      else high = middle - 1;
    }
    return `${text.slice(0, low)}...`;
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function isMousePan(e) {
    return e.pointerType === "mouse" && (e.button === 1 || e.altKey);
  }
  function finishDrawing(pointerType) {
    if (!state.drawing) return;
    const d = state.drawing;
    state.drawing = null;
    const shouldRequest = !d.erase;
    if (shouldRequest) {
      for (const point of d.trail) state.hotspotTrail.push(point);
      if (state.hotspotTrail.length > 512) state.hotspotTrail.splice(0, state.hotspotTrail.length - 512);
    }
    notePendingContinuedInput(d);
    state.autoEligible ||= shouldRequest;
    if (shouldRequest && state.autoEligible) schedule();
    save();
    debug("stroke-summary", {
      pointerType,
      points: d.points,
      screenDistance: Math.round(d.screenDistance),
      logicalBbox: d.bbox,
      scale: Number(state.scale.toFixed(3)),
      widthCss: {
        min: Number(d.widthMin.toFixed(2)),
        max: Number(d.widthMax.toFixed(2)),
      },
    });
    if (shouldRequest && !state.pending?.fading) setStatusKey(state.pending?.items ? "batchDraftReady" : state.pending ? "draftReady" : "ready");
  }
  screen.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try {
      screen.setPointerCapture(e.pointerId);
    } catch {}
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === "touch") {
      state.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.touches.size >= 2) {
        if (state.pendingGesture) {
          clearTimeout(state.pendingGesture.timer);
          state.pendingGesture = null;
        }
        finishDrawing("pen");
        beginTouchGesture();
        return;
      }
    }
    if (isMousePan(e)) {
      state.panGesture = {
        id: e.pointerId,
        last: { x: e.clientX, y: e.clientY },
      };
      setCanvasCursor("grabbing");
      setNavigating(true);
      return;
    }
    if (state.pending) {
      if (state.pending.fading) {
        if (e.pointerType === "touch") {
          state.panGesture = {
            id: e.pointerId,
            last: { x: e.clientX, y: e.clientY },
          };
          return;
        }
      }
      const result = state.pending.fading ? null : pendingHit(state.pending, e, state.pending.revealProgress < 1),
        hit = typeof result === "string" ? result : result?.hit,
        itemIndex = result && typeof result === "object" ? result.itemIndex : null;
      if (hit && !(e.pointerType === "pen" && hit === "move")) {
        if (hit === "accept") return acceptPending();
        if (hit === "cancel") return rejectPending();
        if (hit === "item-accept") return acceptPendingItem(itemIndex);
        if (hit === "item-cancel") return rejectPendingItem(itemIndex);
        beginPendingGesture(e, hit, itemIndex);
        return;
      }
      if (e.pointerType === "touch") {
        state.panGesture = {
          id: e.pointerId,
          last: { x: e.clientX, y: e.clientY },
        };
        return;
      }
    }
    if (state.mode === "select" && e.pointerType !== "touch") {
      if (state.pending) {
        setStatusKey("pendingConfirm");
        return;
      }
      const point = clientPoint(e);
      if (!valid(point)) {
        setStatusKey("outsideCanvas");
        return;
      }
      handleSelectionPointerDown(e, point);
      return;
    }
    if (e.pointerType === "touch") {
      state.panGesture = {
        id: e.pointerId,
        last: { x: e.clientX, y: e.clientY },
      };
      setNavigating(true);
      return;
    }
    const p = clientPoint(e);
    if (!valid(p)) {
      setStatusKey("outsideCanvas");
      debug("stroke-outside-canvas", {
        x: Math.round(p.x),
        y: Math.round(p.y),
        scale: Number(state.scale.toFixed(3)),
      });
      return;
    }
    supersedeActiveAI("user-input-started");
    clearTimeout(state.timer);
    state.timer = 0;
    const erasing = state.mode === "eraser";
    if (erasing) invalidateRecognition();
    const cssSize = erasing ? state.eraser : pressureWidth(e),
      size = logicalWidth(cssSize);
    state.userRevision++;
    state.drawing = {
      id: e.pointerId,
      last: p,
      size,
      start: p,
      points: 1,
      screenDistance: 0,
      widthMin: cssSize,
      widthMax: cssSize,
      bbox: { x: p.x, y: p.y, w: 0, h: 0 },
      trail: [p],
      erase: erasing,
    };
    dot(p, erasing, size, !erasing);
    requestRender();
  });
  screen.addEventListener("pointermove", (e) => {
    e.preventDefault();
    const old = state.pointers.get(e.pointerId);
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === "touch") state.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.pendingGesture?.id === e.pointerId) {
      updatePendingGesture(e);
      return;
    }
    if (state.selectionGesture?.id === e.pointerId) {
      updateSelectionGesture(e);
      const point = clientPoint(e);
      coords.textContent = `x ${Math.round(point.x)} · y ${Math.round(point.y)} · ${Math.round(state.scale * 100)}%`;
      return;
    }
    if (e.pointerType === "touch") {
      if (state.touches.size >= 2) {
        updateTouchGesture();
        return;
      }
      if (state.panGesture?.id === e.pointerId && old) {
        moveCanvas(e.clientX - old.x, e.clientY - old.y);
        state.panGesture.last = { x: e.clientX, y: e.clientY };
        setNavigating(true);
      }
      return;
    }
    if (state.panGesture?.id === e.pointerId) {
      if (old) {
        moveCanvas(e.clientX - old.x, e.clientY - old.y);
        setNavigating(true);
      }
      return;
    }
    if (!state.drawing || state.drawing.id !== e.pointerId) return;
    const p = clientPoint(e),
      a = state.drawing.last,
      d = state.drawing,
      cssSize = d.erase ? state.eraser : pressureWidth(e),
      size = logicalWidth(cssSize);
    state.userRevision++;
    stroke(a, p, d.erase, size, !d.erase);
    d.last = p;
    d.size = size;
    d.points++;
    d.screenDistance += old ? Math.hypot(e.clientX - old.x, e.clientY - old.y) : 0;
    if (d.points % 8 === 0) d.trail.push(p);
    d.widthMin = Math.min(d.widthMin, cssSize);
    d.widthMax = Math.max(d.widthMax, cssSize);
    const x1 = Math.min(d.bbox.x, p.x),
      y1 = Math.min(d.bbox.y, p.y),
      x2 = Math.max(d.bbox.x + d.bbox.w, p.x),
      y2 = Math.max(d.bbox.y + d.bbox.h, p.y);
    d.bbox = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    requestRender();
    coords.textContent = `x ${Math.round(p.x)} · y ${Math.round(p.y)} · ${Math.round(state.scale * 100)}%`;
  });
  function end(e) {
    state.pointers.delete(e.pointerId);
    if (e.pointerType === "touch") state.touches.delete(e.pointerId);
    if (state.pendingGesture?.id === e.pointerId) {
      clearTimeout(state.pendingGesture.timer);
      if (state.pendingGesture.armed) setCanvasCursor("crosshair");
      state.pendingGesture = null;
      if (e.pointerType === "touch") {
        state.touchGesture = null;
        if (state.touches.size === 1) {
          const [id, p] = state.touches.entries().next().value;
          state.panGesture = { id, last: p };
        } else state.panGesture = null;
        if (!state.touches.size) setNavigating(false);
      }
      return;
    }
    if (state.selectionGesture?.id === e.pointerId) {
      finishSelectionGesture(e);
      return;
    }
    if (e.pointerType === "touch") {
      state.touchGesture = null;
      if (state.touches.size === 1) {
        const [id, p] = state.touches.entries().next().value;
        state.panGesture = { id, last: p };
      } else state.panGesture = null;
      if (!state.touches.size) setNavigating(false);
      return;
    }
    if (state.panGesture?.id === e.pointerId) {
      state.panGesture = null;
      setCanvasCursor("crosshair");
      setNavigating(false);
      return;
    }
    if (state.drawing?.id === e.pointerId) finishDrawing(e.pointerType);
  }
  screen.addEventListener("pointerup", end);
  screen.addEventListener("pointercancel", end);
  screen.addEventListener("contextmenu", (e) => e.preventDefault());
  view.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = view.getBoundingClientRect(),
        factor = e.deltaY < 0 ? 1.12 : 0.89,
        n = Math.max(0.03, Math.min(2, state.scale * factor)),
        px = e.clientX - r.left,
        py = e.clientY - r.top;
      state.panX = px - ((px - state.panX) * n) / state.scale;
      state.panY = py - ((py - state.panY) * n) / state.scale;
      state.scale = n;
      updateCoordinates();
      requestRender();
      wheelNavigating();
    },
    { passive: false },
  );
  document.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        if (state.mode === "select" && b.dataset.mode !== "select" && state.selection) commitSelection();
        state.mode = b.dataset.mode;
        document.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("active", x === b));
        setCanvasCursor("crosshair");
      }),
  );
  document.querySelector("#penSize").oninput = (e) => {
    state.pen = +e.target.value;
    document.querySelector("#penSizeValue").textContent = `${state.pen} px`;
  };
  document.querySelector("#aiFont").onchange = (e) => {
    state.aiFont = e.target.value;
  };
  function closeColorOrbs(except = null) {
    document.querySelectorAll("[data-color-control]").forEach((control) => {
      if (control === except) return;
      const trigger = control.querySelector(".color-orb-trigger"),
        focusedInside = control.contains(document.activeElement) && document.activeElement !== trigger;
      control.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      control.querySelector(".color-orbit").setAttribute("aria-hidden", "true");
      control.querySelectorAll(".orbit-swatch").forEach((button) => button.setAttribute("tabindex", "-1"));
      if (focusedInside) trigger.focus();
    });
  }
  document.querySelectorAll("[data-color-control]").forEach((control) => {
    const trigger = control.querySelector(".color-orb-trigger"),
      orbit = control.querySelector(".color-orbit"),
      type = control.dataset.colorControl;
    trigger.onclick = (event) => {
      event.stopPropagation();
      const open = !control.classList.contains("open");
      closeColorOrbs(control);
      control.classList.toggle("open", open);
      trigger.setAttribute("aria-expanded", String(open));
      orbit.setAttribute("aria-hidden", String(!open));
      control.querySelectorAll(".orbit-swatch").forEach((button) => button.setAttribute("tabindex", open ? "0" : "-1"));
    };
    control.querySelectorAll(".orbit-swatch").forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        const color = type === "ink" ? button.dataset.inkColor : button.dataset.aiColor;
        if (type === "ink") {
          state.inkColor = color;
          applySelectionColor(color);
        }
        else state.aiColor = color;
        trigger.classList.remove(...Object.values(COLOR_CLASS));
        trigger.classList.add(COLOR_CLASS[color]);
        control.querySelectorAll(".orbit-swatch").forEach((item) => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-checked", String(active));
        });
        closeColorOrbs();
      };
    });
  });
  document.querySelectorAll(".orbit-swatch").forEach((button) => {
    button.setAttribute("role", "menuitemradio");
    button.setAttribute("tabindex", "-1");
    button.setAttribute("aria-checked", String(button.classList.contains("active")));
  });
  document.addEventListener("click", () => closeColorOrbs());
  document.querySelector("#rejectBatch").onclick = rejectPending;
  document.querySelector("#acceptBatch").onclick = acceptPending;
  document.querySelector("#auto").onclick = () => {
    if (state.auto) setAutoEnabled(false);
    else setAutoEnabled(true, true);
  };
  document.querySelector("#autoDelayRange").oninput = (event) => {
    state.autoDelayMs = Math.round(Math.max(0, Math.min(10, Number(event.target.value))) * 1000);
    localStorage.setItem("penecho-auto-delay-ms", String(state.autoDelayMs));
    updateAutoControl();
    schedule();
    keepAutoDelayControlOpen();
  };
  document.querySelector("#autoDelayPopover").addEventListener("pointerdown", keepAutoDelayControlOpen);
  document.addEventListener("pointerdown", (event) => {
    if (!document.querySelector("#autoControl").contains(event.target)) hideAutoDelayControl();
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.onclick = () => {
      state.language = button.dataset.language;
      localStorage.setItem("penecho-language", state.language);
      applyLanguage();
    };
  });
  document.querySelector("#theme").onchange = (e) => applyTheme(e.target.value);
  document.querySelector("#gridToggle").onclick = () => {
    state.gridVisible = !state.gridVisible;
    localStorage.setItem(state.theme === "research" ? "penecho-research-grid" : "penecho-grid", String(state.gridVisible));
    updateGridButton();
    requestRender();
  };
  document.querySelector("#fullscreenBtn").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      setStatus(`${t("aiError")}${error.message}`);
    }
  };
  document.querySelector("#newCanvasBtn").onclick = openNewCanvasDialog;
  document.querySelector("#historyBtn").onclick = openHistoryPanel;
  document.querySelector("#historyClose").onclick = closeHistoryPanel;
  document.querySelector("#historyBackdrop").onclick = closeHistoryPanel;
  document.querySelector("#historySave").onclick = () => runSnapshotAction(saveSnapshot);
  document.querySelector("#historyNew").onclick = openNewCanvasDialog;
  document.querySelector("#newCanvasClose").onclick = () => document.querySelector("#newCanvasDialog").close("cancel");
  document.querySelector("#newCanvasCancel").onclick = () => document.querySelector("#newCanvasDialog").close("cancel");
  document.querySelector("#newDiscard").onclick = startBlankCanvas;
  document.querySelector("#newSaveCopy").onclick = () => completeNewCanvas("new");
  document.querySelector("#newOverwrite").onclick = () => completeNewCanvas("overwrite");
  document.querySelector("#newCanvasDialog").addEventListener("cancel", (event) => {
    if (event.currentTarget.dataset.busy === "true") event.preventDefault();
  });
  document.querySelector("#historyName").addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSnapshotAction(saveSnapshot);
  });
  document.querySelector("#newSnapshotName").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      completeNewCanvas("new");
    }
  });
  document.addEventListener("fullscreenchange", () => {
    updateFullscreenButton();
    requestAnimationFrame(fit);
  });
  document.querySelector("#debugBtn").onclick = (e) => {
    const panel = document.querySelector("#debugPanel");
    panel.hidden = !panel.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
    e.currentTarget.classList.toggle("active", !panel.hidden);
  };
  document.querySelectorAll("[data-action]").forEach(
    (b) =>
      (b.onclick = () => {
        const a = b.dataset.action;
        if (state.pending && a !== "clear") {
          setStatusKey("pendingConfirm");
          return;
        }
        if (a === "undo") {
          if (state.selection) commitSelection();
          state.userRevision++;
          undo();
        } else if (a === "redo") {
          if (state.selection) commitSelection();
          state.userRevision++;
          redo();
        } else if (a === "clear") {
          if (confirm(t("clearConfirm"))) {
            if (state.selection) commitSelection();
            state.userRevision++;
            invalidateRecognition();
            state.historyBefore.clear();
            for (const [k, c] of tiles) state.historyBefore.set(k, cloneCanvas(c));
            tiles.clear();
            state.inkBounds.clear();
            cancelPendingForRevision();
            save();
            render();
          }
        } else invokeAIAction(a);
      }),
  );
  embodiment.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse" || e.pointerType === "pen") openRadialMenu();
  });
  embodiment.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    if (!state.radialGesture) {
      state.radialCloseTimer = setTimeout(closeRadialMenu, 2000);
    }
  });
  aiOrb.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openRadialMenu();
    state.radialGesture = { id: e.pointerId, moved: false, selected: null };
    try {
      aiOrb.setPointerCapture(e.pointerId);
    } catch {}
  });
  aiOrb.addEventListener("pointermove", (e) => {
    const gesture = state.radialGesture;
    if (!gesture || gesture.id !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const r = aiOrb.getBoundingClientRect(),
      distance = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    if (distance > 12) gesture.moved = true;
    gesture.selected = gesture.moved ? chooseRadialAction(e.clientX, e.clientY) : null;
  });
  function finishRadialGesture(e) {
    const gesture = state.radialGesture;
    if (!gesture || gesture.id !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const selected = gesture.selected;
    state.radialGesture = null;
    state.radialSuppressClickUntil = performance.now() + 450;
    if (selected) {
      invokeAIAction(selected.dataset.aiAction);
      closeRadialMenu();
      return;
    }
    if (gesture.moved) {
      closeRadialMenu();
    }
  }
  aiOrb.addEventListener("pointerup", finishRadialGesture);
  aiOrb.addEventListener("pointercancel", (e) => {
    if (state.radialGesture?.id !== e.pointerId) return;
    state.radialGesture = null;
    state.radialSuppressClickUntil = performance.now() + 450;
    closeRadialMenu();
  });
  aiOrb.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (performance.now() < state.radialSuppressClickUntil) return;
    if (embodiment.classList.contains("menu-open")) closeRadialMenu();
    else openRadialMenu();
  });
  document.querySelectorAll(".radial-action").forEach((button) => {
    button.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      clearTimeout(state.radialCloseTimer);
      openRadialMenu();
    });
    button.addEventListener("pointerleave", (e) => {
      if ((e.pointerType !== "mouse" && e.pointerType !== "pen") || state.radialGesture) return;
      state.radialCloseTimer = setTimeout(closeRadialMenu, 2000);
    });
    button.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    });
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      invokeAIAction(button.dataset.aiAction);
      closeRadialMenu();
    });
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.querySelector("#newCanvasDialog").open) return;
    if (e.key === "Escape" && state.selection) {
      cancelSelection();
      return;
    }
    if (e.key === "Enter" && state.selection?.phase === "active" && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) {
      commitSelection();
      return;
    }
    if (e.key === "Escape" && !document.querySelector("#autoDelayPopover").hidden) {
      hideAutoDelayControl();
      document.querySelector("#auto").focus();
      return;
    }
    if (e.key === "Escape" && document.querySelector("#historyPanel").classList.contains("open")) {
      closeHistoryPanel();
      document.querySelector("#historyBtn").focus();
      return;
    }
    if (e.key === "Escape" && embodiment.classList.contains("menu-open")) {
      state.radialGesture = null;
      closeRadialMenu();
      aiOrb.focus();
      return;
    }
    if (e.key === "Alt" && !state.drawing && !state.pending) setCanvasCursor("grab");
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Alt" && !state.panGesture && !state.drawing && !state.pending) setCanvasCursor("crosshair");
  });
  new ResizeObserver(fit).observe(view);
  document.querySelectorAll(".radial-action").forEach((button) => button.setAttribute("tabindex", "-1"));
  applyLanguage();
  applyTheme(state.theme);
  refreshSnapshots().catch(() => {});
  fit();
})();
