"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PENECHO_MIXED_TEXT = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  const NAMED_TEX_COMMANDS = new Set([
    "alpha", "beta", "gamma", "delta", "epsilon", "theta", "lambda", "mu", "pi", "rho", "sigma", "phi", "omega",
    "Gamma", "Delta", "Theta", "Lambda", "Pi", "Sigma", "Phi", "Omega",
    "sum", "prod", "int", "oint", "lim", "sin", "cos", "tan", "log", "ln", "exp", "infty", "partial", "nabla",
  ]);

  function isEscaped(source, index) {
    let slashes = 0;
    for (let at = index - 1; at >= 0 && source[at] === "\\"; at--) slashes++;
    return slashes % 2 === 1;
  }

  function findClosing(source, marker, from) {
    let index = from;
    while ((index = source.indexOf(marker, index)) >= 0) {
      if (!isEscaped(source, index)) return index;
      index += marker.length;
    }
    return -1;
  }

  function readBalanced(source, index, open, close) {
    if (source[index] !== open) return -1;
    let depth = 0;
    for (let at = index; at < source.length; at++) {
      if (isEscaped(source, at)) continue;
      if (source[at] === open) depth++;
      else if (source[at] === close && --depth === 0) return at + 1;
    }
    return -1;
  }

  function readScriptTarget(source, index) {
    if (source[index] === "{") return readBalanced(source, index, "{", "}");
    return /[A-Za-z0-9]/.test(source[index] || "") ? index + 1 : -1;
  }

  function readScripts(source, index) {
    let at = index,
      count = 0;
    while (source[at] === "_" || source[at] === "^") {
      const end = readScriptTarget(source, at + 1);
      if (end < 0) break;
      at = end;
      count++;
    }
    return { end: at, count };
  }

  function boundary(source, index) {
    return index < 0 || index >= source.length || !/[A-Za-z0-9_]/.test(source[index]);
  }

  function bareMathAt(source, index) {
    if (isEscaped(source, index) || !boundary(source, index - 1)) return null;
    let end = -1;
    if (source.startsWith("\\frac", index)) {
      let at = index + 5;
      while (/\s/.test(source[at] || "")) at++;
      at = readBalanced(source, at, "{", "}");
      if (at < 0) return null;
      while (/\s/.test(source[at] || "")) at++;
      end = readBalanced(source, at, "{", "}");
    } else if (source.startsWith("\\sqrt", index)) {
      let at = index + 5;
      while (/\s/.test(source[at] || "")) at++;
      if (source[at] === "[") {
        at = readBalanced(source, at, "[", "]");
        if (at < 0) return null;
        while (/\s/.test(source[at] || "")) at++;
      }
      end = readBalanced(source, at, "{", "}");
    } else if (source[index] === "\\") {
      const command = /^\\([A-Za-z]+)/.exec(source.slice(index));
      if (!command || !NAMED_TEX_COMMANDS.has(command[1])) return null;
      const scripts = readScripts(source, index + command[0].length);
      end = scripts.end;
    } else if (/[A-Za-z]/.test(source[index] || "")) {
      const scripts = readScripts(source, index + 1);
      if (!scripts.count) return null;
      end = scripts.end;
    }
    if (end < 0 || !boundary(source, end)) return null;
    return { type: "math", tex: source.slice(index, end), raw: source.slice(index, end), end, display: false };
  }

  function explicitMathAt(source, index) {
    let open = null,
      close = null,
      display = false;
    if (source.startsWith("$$", index) && !isEscaped(source, index)) {
      open = close = "$$";
      display = true;
    } else if (source[index] === "$" && !isEscaped(source, index)) open = close = "$";
    else if (source.startsWith("\\(", index) && !isEscaped(source, index)) {
      open = "\\(";
      close = "\\)";
    } else if (source.startsWith("\\[", index) && !isEscaped(source, index)) {
      open = "\\[";
      close = "\\]";
      display = true;
    } else return null;
    const closing = findClosing(source, close, index + open.length);
    if (closing < 0) return { type: "literal-rest", raw: source.slice(index), end: source.length };
    const tex = source.slice(index + open.length, closing);
    if (!tex.trim()) return { type: "text", text: source.slice(index, closing + close.length), end: closing + close.length };
    if (open === "$" && (/\s/.test(tex[0]) || /\s/.test(tex.at(-1)))) return null;
    return { type: "math", tex, raw: source.slice(index, closing + close.length), end: closing + close.length, display };
  }

  function markdownAt(source, index) {
    if (isEscaped(source, index)) return null;
    if (source[index] === "`") {
      const closing = findClosing(source, "`", index + 1);
      if (closing < 0) return { type: "literal-rest", raw: source.slice(index), end: source.length };
      return { type: "code", content: source.slice(index + 1, closing), end: closing + 1 };
    }
    for (const marker of ["**", "__"]) {
      if (!source.startsWith(marker, index)) continue;
      const closing = findClosing(source, marker, index + marker.length);
      if (closing < 0) return { type: "literal-rest", raw: source.slice(index), end: source.length };
      const content = source.slice(index + marker.length, closing);
      const end = closing + marker.length,
        raw = source.slice(index, end);
      if (closing > index + marker.length && boundary(source, index - 1) && boundary(source, end) && !/\s/.test(content[0]) && !/\s/.test(content.at(-1)) && !/[*_]/.test(content[0]) && !/[*_]/.test(content.at(-1))) {
        return { type: "styled", style: "bold", content, end: closing + marker.length };
      }
      return { type: "text", text: raw, end };
    }
    if (source[index] === "*" && source[index + 1] !== "*" && boundary(source, index - 1)) {
      const closing = findClosing(source, "*", index + 1);
      const content = source.slice(index + 1, closing);
      if (closing > index + 1 && source[closing + 1] !== "*" && boundary(source, closing + 1) && !/\s/.test(content[0]) && !/\s/.test(content.at(-1))) {
        return { type: "styled", style: "italic", content, end: closing + 1 };
      }
      if (closing > index + 1) return { type: "text", text: source.slice(index, closing + 1), end: closing + 1 };
    }
    if (source[index] === "_" && boundary(source, index - 1) && source[index + 1] !== "_") {
      let closing = findClosing(source, "_", index + 1);
      while (closing > index + 1 && !boundary(source, closing + 1)) closing = findClosing(source, "_", closing + 1);
      const content = source.slice(index + 1, closing);
      if (closing > index + 1 && !/\s/.test(content[0]) && !/\s/.test(content.at(-1))) return { type: "styled", style: "italic", content, end: closing + 1 };
      if (closing > index + 1) return { type: "text", text: source.slice(index, closing + 1), end: closing + 1 };
    }
    return null;
  }

  function sameTextStyle(a, b) {
    return a.type === "text" && b.type === "text" && Boolean(a.bold) === Boolean(b.bold) && Boolean(a.italic) === Boolean(b.italic) && Boolean(a.code) === Boolean(b.code);
  }

  function appendSegment(segments, segment) {
    if (segment.type === "text" && !segment.text) return;
    const previous = segments.at(-1);
    if (previous && sameTextStyle(previous, segment)) previous.text += segment.text;
    else segments.push(segment);
  }

  function tokenizeInline(source, style = {}) {
    const segments = [];
    let plainStart = 0,
      index = 0;
    const flush = (end) => {
      if (end > plainStart) appendSegment(segments, { type: "text", text: source.slice(plainStart, end), ...style });
    };
    while (index < source.length) {
      const explicit = explicitMathAt(source, index),
        markdown = explicit ? null : markdownAt(source, index),
        bare = explicit || markdown ? null : bareMathAt(source, index),
        token = explicit || markdown || bare;
      if (!token) {
        index++;
        continue;
      }
      flush(index);
      if (token.type === "literal-rest") {
        appendSegment(segments, { type: "text", text: token.raw, ...style });
        return segments;
      }
      if (token.type === "text") appendSegment(segments, { type: "text", text: token.text, ...style });
      else if (token.type === "math") segments.push({ type: "math", tex: token.tex, raw: token.raw, display: token.display, ...style });
      else if (token.type === "code") appendSegment(segments, { type: "text", text: token.content, ...style, code: true });
      else {
        const nested = tokenizeInline(token.content, { ...style, [token.style]: true });
        nested.forEach((segment) => appendSegment(segments, segment));
      }
      index = token.end;
      plainStart = index;
    }
    flush(source.length);
    return segments;
  }

  function parseLine(raw) {
    let content = raw,
      kind = "paragraph",
      level = 0,
      fontScale = 1,
      prefix = null;
    const heading = /^(?: {0,3})(#{1,3})[\t ]+(.*)$/.exec(raw),
      bullet = /^(?: {0,3})[-+*][\t ]+(.*)$/.exec(raw),
      ordered = /^(?: {0,3})(\d{1,3})[.)][\t ]+(.*)$/.exec(raw),
      quote = /^(?: {0,3})>[\t ]?(.*)$/.exec(raw);
    if (heading) {
      kind = "heading";
      level = heading[1].length;
      fontScale = [0, 1.36, 1.2, 1.1][level];
      content = heading[2];
    } else if (bullet) {
      kind = "bullet";
      content = bullet[1];
      prefix = { type: "text", text: "\u2022 ", bold: true };
    } else if (ordered) {
      kind = "ordered";
      content = ordered[2];
      prefix = { type: "text", text: `${ordered[1]}. `, bold: true };
    } else if (quote) {
      kind = "quote";
      content = quote[1];
      prefix = { type: "text", text: "> ", italic: true };
    }
    const segments = tokenizeInline(content, kind === "heading" ? { bold: true } : kind === "quote" ? { italic: true } : {});
    if (prefix) segments.unshift(prefix);
    return { raw, kind, level, fontScale, segments };
  }

  function parse(source) {
    const value = String(source ?? ""),
      normalized = value.replace(/\r\n?/g, "\n");
    return { source: value, normalized, lines: normalized.split("\n").map(parseLine) };
  }

  return { parse, tokenizeInline, bareMathAt };
});
