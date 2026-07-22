"use strict";

const MAX_WEB_INSTRUCTION = 4000;
const MAX_WEB_HTML = 400 * 1024;
const MAX_WEB_FRAGMENT = 60 * 1024;
const MAX_WEB_SELECTOR = 500;

const WEB_SYSTEM_PROMPT = `You are the web interface builder for PenEcho. You produce complete, self-contained, static web pages.

Output rules (strict):
- Return ONLY one complete standalone HTML document, starting with <!doctype html> and ending with </html>. No markdown fences, no commentary before or after the document.
- Put all CSS inline in a single <style> element in <head>. Never reference external resources: no CDN scripts or stylesheets, no web fonts, no network images. Use system font stacks, CSS gradients and shapes, inline SVG, and emoji for visuals.
- Do not include JavaScript. The preview renders with scripts disabled, so all behavior must be pure HTML+CSS (details/summary for accordions, :hover and :focus-within states, CSS-only layout).
- Make the page responsive (flexbox/grid, relative units) and visually polished: a clear typographic hierarchy, consistent spacing, and a deliberate color palette.
- Use semantic HTML and readable structure; the user will iterate on this document, so keep the markup clean.`;

function webLanguageDirective(languageName) {
  return languageName
    ? `Write the page copy in ${languageName} unless the instruction explicitly requests another language.`
    : "Write the page copy in the language of the instruction.";
}

function buildWebPrompt({ mode, instruction, html, selector, selectedHtml, languageName }) {
  const system = `${WEB_SYSTEM_PROMPT}\n\n${webLanguageDirective(languageName)}`;
  if (mode === "edit") {
    const selectionPart = selector
      ? `The user selected the element \`${selector}\`; its current markup is:\n${selectedHtml || "(unavailable)"}\n\nApply the instruction to that selected part`
      : "Apply the instruction to the page";
    return {
      system,
      prompt: `Here is the current page document:\n\n${html}\n\n${selectionPart}, changing the rest of the document only as much as the instruction requires. Instruction: ${instruction}\n\nReturn the FULL updated document.`,
    };
  }
  return { system, prompt: `Create a web page for this request: ${instruction}` };
}

function extractHtmlDocument(text) {
  let candidate = String(text || "").trim();
  const fence = candidate.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence && /<html/i.test(fence[1])) candidate = fence[1].trim();
  const lower = candidate.toLowerCase();
  const doctype = lower.indexOf("<!doctype");
  const htmlTag = lower.indexOf("<html");
  const start = doctype >= 0 ? doctype : htmlTag;
  if (start < 0) return null;
  const end = lower.lastIndexOf("</html>");
  if (end < 0 || end <= start) return null;
  return candidate.slice(start, end + "</html>".length);
}

function validWebPayload(p) {
  if (!p || typeof p !== "object") return false;
  if (!["generate", "edit"].includes(p.mode)) return false;
  if (typeof p.instruction !== "string" || !p.instruction.trim() || p.instruction.length > MAX_WEB_INSTRUCTION) return false;
  if (p.mode === "edit" && (typeof p.html !== "string" || !p.html.trim() || p.html.length > MAX_WEB_HTML)) return false;
  if (p.mode === "generate" && p.html !== undefined && p.html !== null) return false;
  if (p.selector !== undefined && p.selector !== null && (typeof p.selector !== "string" || p.selector.length > MAX_WEB_SELECTOR)) return false;
  if (p.selectedHtml !== undefined && p.selectedHtml !== null && (typeof p.selectedHtml !== "string" || p.selectedHtml.length > MAX_WEB_FRAGMENT)) return false;
  return true;
}

module.exports = {
  MAX_WEB_INSTRUCTION,
  MAX_WEB_HTML,
  MAX_WEB_FRAGMENT,
  MAX_WEB_SELECTOR,
  WEB_SYSTEM_PROMPT,
  buildWebPrompt,
  extractHtmlDocument,
  validWebPayload,
  webLanguageDirective,
};
