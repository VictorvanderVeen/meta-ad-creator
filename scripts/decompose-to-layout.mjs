#!/usr/bin/env node
/**
 * Turns a Canva "separate image layers" result into an Ad Creator layout.
 *
 * Input:
 *   --canva <file>   JSON from Canva read-design (design_content), or just its page object
 *   --assets <dir>   folder with the exported PNGs, one per media, named <mediaId>.png
 *   --id <slug>      layout id, e.g. "papiertje-hartje"
 *   --name <text>    name shown in the template list
 *   --desc <text>    optional description
 *   --font <family>  Google Font that matches the design's lettering (default: Rubik)
 *   --fields <map>   optional override, e.g. "LBabc=headline,LBdef=subtext,LBghi=cta_text"
 *
 * Output:
 *   src/layouts/<id>.json  and  public/layouts/<id>/{foto,sticker-N}.png
 *
 * Field guessing (check the result, override with --fields when wrong):
 *   headline = text with the largest font size
 *   cta_text = the lowest remaining text that sits on a sticker (the button)
 *   subtext  = the first remaining text; any further texts become extra_N
 * A small sticker just right of the CTA text (e.g. an arrow) becomes a
 * trailing sticker that moves with the end of the CTA text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) throw new Error(`Onverwacht argument: ${argv[i]}`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  for (const req of ['canva', 'assets', 'id', 'name']) {
    if (!args[req]) throw new Error(`--${req} ontbreekt`);
  }
  if (!/^[a-z0-9-]+$/.test(args.id)) throw new Error('--id: alleen kleine letters, cijfers en streepjes');
  return args;
}

function findPage(json) {
  if (json.design_content?.pages) return json.design_content.pages[0];
  if (json.pages) return json.pages[0];
  if (json.document?.page) return json.document.page;
  if (json.elements && json.dimensions) return json;
  throw new Error('Geen Canva-pagina gevonden in --canva');
}

const round = (n) => Math.round(n * 10) / 10;
const centre = (e) => ({ x: e.left + e.width / 2, y: e.top + e.height / 2 });
const inside = (p, e) => p.x >= e.left && p.x <= e.left + e.width && p.y >= e.top && p.y <= e.top + e.height;

function isLight(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

function assignFields(texts, stickers, override) {
  const fields = new Map();
  if (override) {
    for (const pair of override.split(',')) {
      const [id, field] = pair.split('=');
      fields.set(id.trim(), field.trim());
    }
    return fields;
  }
  const rest = [...texts];
  const fontSize = (t) => t.textRegions[0].formatting.fontSize;

  rest.sort((a, b) => fontSize(b) - fontSize(a));
  fields.set(rest.shift().id, 'headline');

  const onSticker = rest
    .filter((t) => stickers.some((s) => inside(centre(t), s)))
    .sort((a, b) => b.top - a.top);
  // Prefer light text on a sticker (white on a button); else the lowest one.
  const cta = onSticker.find((t) => isLight(t.textRegions[0].formatting.color)) || onSticker[0];
  if (cta) {
    fields.set(cta.id, 'cta_text');
    rest.splice(rest.indexOf(cta), 1);
  }

  rest.sort((a, b) => a.top - b.top);
  rest.forEach((t, i) => fields.set(t.id, i === 0 ? 'subtext' : `extra_${i}`));
  return fields;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const page = findPage(JSON.parse(fs.readFileSync(args.canva, 'utf8')));
  const { width: dw, height: dh } = page.dimensions;

  const stickers = page.elements.filter((e) => e.fill?.media?.type === 'image');
  const texts = page.elements.filter((e) => e.type === 'text' && e.textRegions?.length);
  if (!texts.length) throw new Error('Geen tekstlagen gevonden: Canva heeft de tekst niet herkend');

  const fields = assignFields(texts, stickers, args.fields);
  const ctaEl = texts.find((t) => fields.get(t.id) === 'cta_text');

  // A small sticker hugging the right part of the CTA text box = trailing sticker.
  const trailing = ctaEl && stickers.find((s) => {
    const c = centre(s);
    return s.width * s.height < ctaEl.width * ctaEl.height * 0.25
      && c.y >= ctaEl.top && c.y <= ctaEl.top + ctaEl.height
      && c.x > ctaEl.left + ctaEl.width * 0.5;
  });

  const outDir = path.join(ROOT, 'public/layouts', args.id);
  fs.mkdirSync(outDir, { recursive: true });
  const publicPath = (file) => `/layouts/${args.id}/${file}`;
  const copyAsset = (mediaId, file) => {
    const src = path.join(args.assets, `${mediaId}.png`);
    if (!fs.existsSync(src)) throw new Error(`Bestand ontbreekt: ${src}`);
    fs.copyFileSync(src, path.join(outDir, file));
    return publicPath(file);
  };

  const photoId = page.background?.media?.mediaId;
  const layers = [];
  let n = 0;
  for (const el of page.elements) {
    if (el === trailing) continue;
    if (stickers.includes(el)) {
      n += 1;
      const layer = {
        type: 'sticker', id: `sticker-${n}`, src: copyAsset(el.fill.media.mediaId, `sticker-${n}.png`),
        x: round(el.left), y: round(el.top), w: round(el.width), h: round(el.height),
      };
      if (el.rotation) layer.rotation = round(el.rotation);
      layers.push(layer);
    } else if (texts.includes(el)) {
      const f = el.textRegions[0].formatting;
      const field = fields.get(el.id);
      const layer = {
        type: 'text', field, sourceText: el.textRegions.map((r) => r.characters).join(''),
        x: round(el.left), y: round(el.top), w: round(el.width), h: round(el.height),
        rotation: round(el.rotation || 0),
        fontSize: round(f.fontSize), minFontSize: round(f.fontSize * 0.6),
        lineHeight: Math.round(f.lineHeight * 100) / 100, color: f.color,
        valign: field === 'headline' ? 'top' : 'middle',
      };
      if (el === ctaEl && trailing) {
        layer.trailingSticker = {
          src: copyAsset(trailing.fill.media.mediaId, 'trailing.png'),
          w: round(trailing.width), h: round(trailing.height), gap: 6,
        };
      }
      layers.push(layer);
    }
  }

  // Keep the design against the side where the text is when the format is wider/taller.
  const textCentreX = texts.reduce((sum, t) => sum + centre(t).x, 0) / texts.length;
  const anchorX = textCentreX < dw * 0.4 ? 0 : textCentreX > dw * 0.6 ? 1 : 0.5;

  const font = args.font || 'Rubik';
  const layout = {
    id: args.id,
    name: args.name,
    description: args.desc || 'Gedecomposeerd ontwerp',
    source: `Canva separate-image-layers, ${new Date().toISOString().slice(0, 10)}`,
    designSize: { width: dw, height: dh },
    anchor: { x: anchorX, y: 0.5 },
    font: { family: font, fallback: `'${font}', 'Helvetica Neue', Arial, sans-serif` },
    defaultPhoto: photoId ? copyAsset(photoId, 'foto.png') : null,
    layers,
  };

  const jsonPath = path.join(ROOT, 'src/layouts', `${args.id}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(layout, null, 2)}\n`);

  console.log(`Layout geschreven: ${path.relative(ROOT, jsonPath)}`);
  for (const l of layers) {
    console.log(l.type === 'text'
      ? `  tekst  ${l.field.padEnd(9)} "${l.sourceText}"${l.trailingSticker ? '  (+ trailing sticker)' : ''}`
      : `  sticker ${l.id}  ${l.w}×${l.h}`);
  }
  if (!fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes(`family=${font.replace(/ /g, '+')}`)) {
    console.log(`\n⚠ Font "${font}" staat nog niet in de Google Fonts-link in index.html`);
  }
}

try {
  main();
} catch (err) {
  console.error(`Fout: ${err.message}`);
  process.exit(1);
}
