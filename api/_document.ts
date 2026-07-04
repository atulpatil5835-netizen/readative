import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT_MARKUP = '<div id="root"></div>';

let cachedShell: string | null | undefined;

function readBuiltShell() {
  if (cachedShell !== undefined) return cachedShell;

  for (const candidate of [
    join(process.cwd(), "dist", "index.html"),
    join(process.cwd(), "index.html"),
  ]) {
    try {
      const source = readFileSync(candidate, "utf8");
      if (source.includes(ROOT_MARKUP)) {
        cachedShell = source;
        return cachedShell;
      }
    } catch {
      // The standalone fallback below remains crawlable if the build shell is unavailable.
    }
  }

  cachedShell = null;
  return cachedShell;
}

function removeShellMetadata(source: string) {
  return source
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\s+name=["'](?:description|robots|keywords|twitter:[^"']+)["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
}

function markHelmetManagedHead(source: string) {
  return source
    .replace(/<meta\b(?![^>]*\bdata-rh=)/gi, '<meta data-rh="true"')
    .replace(
      /<link\b(?=[^>]*\brel=["'](?:canonical|amphtml)["'])(?![^>]*\bdata-rh=)/gi,
      '<link data-rh="true"',
    )
    .replace(
      /<script\b(?=[^>]*\btype=["']application\/ld\+json["'])(?![^>]*\bdata-rh=)/gi,
      '<script data-rh="true"',
    );
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeJsonForHtml(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function renderJsonLd(schema: object | object[]) {
  return `<script type="application/ld+json">${escapeJsonForHtml(schema)}</script>`;
}

export function renderTextParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

interface AppDocumentInput {
  head: string;
  main: string;
  lang?: string;
}

export function renderAppDocument({ head, main, lang = "en" }: AppDocumentInput) {
  const shell = readBuiltShell();
  const prerenderedRoot = `<div id="root">${main}</div>`;
  const managedHead = markHelmetManagedHead(head);

  if (shell) {
    return removeShellMetadata(shell)
      .replace(/<html\s+lang=["'][^"']*["']/i, `<html lang="${escapeHtml(lang)}"`)
      .replace("</head>", `${managedHead}\n</head>`)
      .replace(ROOT_MARKUP, prerenderedRoot);
  }

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${managedHead}
</head>
<body>${prerenderedRoot}</body>
</html>`;
}

export function renderStandaloneDocument({ head, main, lang = "en" }: AppDocumentInput) {
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${head}
</head>
<body>${main}</body>
</html>`;
}

export const SEO_DOCUMENT_STYLES = `<style>
  .seo-document { min-height: 100vh; background: #f7f8fb; color: #0f172a; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .seo-shell { width: min(100% - 2rem, 70rem); margin: 0 auto; padding: 1.25rem 0 4rem; }
  .seo-nav { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; padding: .8rem 1rem; border: 1px solid #e2e8f0; border-radius: 1.1rem; background: rgba(255,255,255,.96); box-shadow: 0 12px 34px rgba(15,23,42,.06); }
  .seo-brand { color: #064e3b; font-size: 1.05rem; font-weight: 900; letter-spacing: -.02em; text-decoration: none; }
  .seo-navlinks, .seo-meta, .seo-tags { display: flex; flex-wrap: wrap; align-items: center; gap: .55rem 1rem; }
  .seo-nav a, .seo-document a { color: #047857; text-decoration-thickness: 1px; text-underline-offset: 3px; }
  .seo-nav a { font-size: .8rem; font-weight: 800; text-decoration: none; }
  .seo-hero, .seo-card { margin-top: 1rem; border: 1px solid #e2e8f0; border-radius: 1.25rem; background: #fff; box-shadow: 0 12px 34px rgba(15,23,42,.045); }
  .seo-hero { overflow: hidden; }
  .seo-hero-inner, .seo-card { padding: clamp(1.15rem, 3vw, 2.25rem); }
  .seo-kicker { margin: 0 0 .65rem; color: #059669; font-size: .72rem; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
  .seo-document h1 { margin: 0; max-width: 46rem; color: #020617; font-size: clamp(1.9rem, 5vw, 3.65rem); line-height: 1.03; letter-spacing: -.045em; }
  .seo-document h2 { margin: 0 0 .75rem; color: #0f172a; font-size: 1.1rem; }
  .seo-document h3 { margin: 0; font-size: 1rem; line-height: 1.4; }
  .seo-document p, .seo-document li { color: #475569; line-height: 1.72; }
  .seo-lede { max-width: 48rem; margin: 1rem 0 0; font-size: 1.05rem; }
  .seo-meta { margin-top: 1rem; color: #64748b; font-size: .82rem; }
  .seo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .seo-list { display: grid; gap: .8rem; margin: 0; padding: 0; list-style: none; }
  .seo-list li { border-top: 1px solid #f1f5f9; padding-top: .8rem; }
  .seo-list li:first-child { border-top: 0; padding-top: 0; }
  .seo-list a { font-weight: 800; }
  .seo-tags a { display: inline-flex; border: 1px solid #d1fae5; border-radius: 999px; background: #ecfdf5; padding: .3rem .65rem; font-size: .75rem; font-weight: 800; text-decoration: none; }
  .seo-footer { margin-top: 1rem; padding: 1.25rem; color: #64748b; font-size: .78rem; text-align: center; }
  @media (max-width: 720px) { .seo-shell { width: min(100% - 1rem, 70rem); padding-top: .5rem; } .seo-grid { grid-template-columns: 1fr; } .seo-nav { border-radius: .9rem; } }
</style>`;
