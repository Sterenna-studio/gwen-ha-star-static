#!/usr/bin/env node
// BZH Universe - generateur statique Markdown -> HTML.
// Zero dependance externe. Pour chaque *.md, ecrit un *.html frere (memes
// chemins relatifs), reecrit les liens internes .md -> .html, et applique un
// gabarit style coherent avec l'ecosysteme Nitro / Gwen Ha Star.
//
//   node tools/md-to-html.mjs
//
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IGNORE_DIRS = new Set(['.git', '.github', 'node_modules', 'tools']);
// Sentinelle ASCII pour proteger les spans `code` (jamais present dans les docs)
const PH_OPEN = '@@CODE';
const PH_CLOSE = 'CODE@@';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!IGNORE_DIRS.has(name)) walk(full, out);
    } else if (name.toLowerCase().endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function rewriteHref(url) {
  if (/^(https?:|mailto:|tel:|#|\/\/)/i.test(url)) return url;
  return url.replace(/\.md(#.*)?$/i, '.html$1');
}

function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${escapeHtml(c)}</code>`);
    return `${PH_OPEN}${codes.length - 1}${PH_CLOSE}`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, url, title) => {
    const href = rewriteHref(url.trim());
    const ext = /^https?:/i.test(href);
    const t = title ? ` title="${escapeHtml(title)}"` : '';
    const attrs = ext ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}"${t}${attrs}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
       .replace(/__([^_]+)__/g, '<strong>$1</strong>')
       .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
       .replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');
  s = s.replace(/@@CODE(\d+)CODE@@/g, (_, i) => codes[+i]);
  return s;
}

function renderList(items) {
  let i = 0;
  function build(minIndent) {
    const ordered = items[i].ordered;
    let out = `<${ordered ? 'ol' : 'ul'}>`;
    while (i < items.length && items[i].indent >= minIndent) {
      const cur = items[i];
      if (cur.indent > minIndent) { out += build(cur.indent); continue; }
      i++;
      let li = `<li>${inline(cur.text)}`;
      if (i < items.length && items[i].indent > cur.indent) li += build(items[i].indent);
      li += '</li>';
      out += li;
    }
    return out + `</${ordered ? 'ol' : 'ul'}>`;
  }
  return build(items[0].indent);
}

function renderTable(rows) {
  const cells = (line) =>
    line.replace(/^\s*\|?|\|?\s*$/g, '').split('|').map((c) => c.trim());
  const header = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  let h = '<table><thead><tr>';
  for (const c of header) h += `<th>${inline(c)}</th>`;
  h += '</tr></thead><tbody>';
  for (const r of body) {
    h += '<tr>';
    for (let k = 0; k < header.length; k++) h += `<td>${inline(r[k] ?? '')}</td>`;
    h += '</tr>';
  }
  return h + '</tbody></table>';
}

const isTableSep = (l) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes('-');

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let out = '';
  let i = 0;
  let firstH1 = null;

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }

    const fence = line.match(/^\s*```+\s*([\w-]*)\s*$/);
    if (fence) {
      const lang = fence[1];
      i++;
      const buf = [];
      while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const cls = lang ? ` class="lang-${lang}"` : '';
      out += `<pre><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`;
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      const level = h[1].length;
      const txt = h[2];
      if (level === 1 && firstH1 === null) firstH1 = txt;
      const id = txt.toLowerCase().replace(/[^\wÀ-ſ]+/g, '-').replace(/^-+|-+$/g, '');
      out += `<h${level} id="${id}">${inline(txt)}</h${level}>`;
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out += '<hr>'; i++; continue; }

    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const rows = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) rows.push(lines[i++]);
      out += renderTable(rows);
      continue;
    }

    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out += `<blockquote>${mdToHtml(buf.join('\n')).html}</blockquote>`;
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        items.push({ indent: m[1].length, ordered: /\d+\./.test(m[2]), text: m[3] });
        i++;
      }
      out += renderList(items);
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*```+/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    out += `<p>${inline(para.join(' '))}</p>`;
  }

  return { html: out, title: firstH1 };
}

const CSS = `
:root{--bg:#070b14;--ink:#dcefff;--muted:#7fa8bd;--cyan:#00ffcc;--pink:#ff3df2;--border:rgba(0,255,204,.16)}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:radial-gradient(circle at 18% 0%,rgba(0,255,204,.06),transparent 40%),radial-gradient(circle at 90% 10%,rgba(255,61,242,.05),transparent 38%),var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.65;font-size:16px}
.topbar{position:sticky;top:0;z-index:10;display:flex;gap:14px;align-items:center;padding:10px 20px;background:rgba(7,11,20,.86);backdrop-filter:blur(8px);border-bottom:1px solid var(--border);font-family:ui-monospace,"Share Tech Mono",monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
.topbar a{color:var(--cyan);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:999px;transition:.16s}
.topbar a:hover{border-color:var(--cyan);box-shadow:0 0 16px rgba(0,255,204,.18)}
.topbar .crumb{color:var(--muted);letter-spacing:.08em;text-transform:none;margin-left:auto;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
main{max-width:820px;margin:0 auto;padding:36px 22px 90px}
h1,h2,h3,h4,h5,h6{font-family:"Exo 2",system-ui,sans-serif;line-height:1.25;margin:1.8em 0 .6em;color:#eafcff}
h1{font-size:2rem;margin-top:.2em;background:linear-gradient(90deg,var(--cyan),var(--pink));-webkit-background-clip:text;background-clip:text;color:transparent}
h2{font-size:1.45rem;padding-bottom:.25em;border-bottom:1px solid var(--border)}
h3{font-size:1.18rem;color:var(--cyan)}
a{color:var(--cyan)}a:hover{color:#fff}
p{margin:.85em 0}
ul,ol{margin:.7em 0;padding-left:1.4em}li{margin:.28em 0}
code{font-family:ui-monospace,"Share Tech Mono",monospace;background:rgba(0,255,204,.08);border:1px solid var(--border);border-radius:5px;padding:.1em .4em;font-size:.88em;color:#9affe9}
pre{background:#060a12;border:1px solid var(--border);border-radius:12px;padding:16px;overflow:auto;box-shadow:inset 0 0 30px rgba(0,255,204,.04)}
pre code{background:none;border:0;padding:0;color:#bfe9ff}
blockquote{margin:1em 0;padding:.4em 1.1em;border-left:3px solid var(--pink);background:rgba(255,61,242,.06);border-radius:0 10px 10px 0;color:#f3d9ff}
table{border-collapse:collapse;width:100%;margin:1.2em 0;font-size:.94em}
th,td{border:1px solid var(--border);padding:8px 12px;text-align:left}
th{background:rgba(0,255,204,.08);color:#eafcff;font-family:ui-monospace,monospace;letter-spacing:.04em}
tr:nth-child(even) td{background:rgba(255,255,255,.018)}
hr{border:0;height:1px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);margin:2.2em 0}
footer{max-width:820px;margin:0 auto;padding:18px 22px 60px;color:var(--muted);font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.1em;border-top:1px solid var(--border)}
`;

function page({ title, body, hubLink, indexLink, crumb }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - BZH Universe</title>
<style>${CSS}</style>
</head>
<body>
<nav class="topbar">
  <a href="${hubLink}">HUB</a>
  <a href="${indexLink}">Index</a>
  <span class="crumb">${escapeHtml(crumb)}</span>
</nav>
<main>
${body}
</main>
<footer>BZH CHRONICLES - genere depuis Markdown - ne pas editer le .html, modifier le .md source</footer>
</body>
</html>
`;
}

const files = walk(ROOT);
let count = 0;
for (const file of files) {
  const relPath = relative(ROOT, file).split(sep).join('/');
  const { html, title } = mdToHtml(readFileSync(file, 'utf8'));
  const depth = relPath.split('/').length - 1;
  const prefix = '../'.repeat(depth);
  const outPath = file.replace(/\.md$/i, '.html');
  const pageTitle = title || relPath.replace(/.*\//, '').replace(/\.md$/i, '');
  writeFileSync(
    outPath,
    page({
      title: pageTitle,
      body: html,
      hubLink: prefix + 'hub/index.html',
      indexLink: prefix + 'docs/00-index.html',
      crumb: relPath,
    }),
    'utf8',
  );
  count++;
}
console.log(`OK ${count} fichiers Markdown convertis en HTML.`);
