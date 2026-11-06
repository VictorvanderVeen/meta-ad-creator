/**
 * Layout renderer — draws "decomposed" ads.
 *
 * A layout is a JSON spec (src/layouts/*.json) produced by taking a flat
 * design apart into layers: a photo, transparent PNG stickers and live text
 * slots, each with the position/rotation from the original design. The
 * layout is defined in its own design space (designSize) and scaled
 * uniformly onto the chosen format; `anchor` decides where the design sits
 * when the format's aspect ratio differs (0 = left/top, 0.5 = centre).
 *
 * The photo always covers the full canvas, so any photo can go behind it.
 */
import { wrapText } from './textFitter';
import { tryLoadImage } from './canvasRenderer';

const layoutModules = import.meta.glob('../layouts/*.json', { eager: true });
const LAYOUTS = Object.fromEntries(
  Object.values(layoutModules).map((m) => [m.default.id, m.default])
);

export const LAYOUT_PREFIX = 'layout:';

export function getLayoutTemplates() {
  return Object.values(LAYOUTS).map((l) => ({
    id: LAYOUT_PREFIX + l.id,
    name: l.name,
    description: l.description,
  }));
}

export function isLayoutTemplate(templateId) {
  return templateId?.startsWith(LAYOUT_PREFIX);
}

// Which brand typography slot a text field uses when the brand font applies.
const FIELD_ROLE = { headline: 'heading', subtext: 'body', cta_text: 'cta' };

/**
 * The layout's own (matched) font is used, unless the layout says
 * "font": "brand" or the brand has typography.strict (its font is
 * mandatory, e.g. NSGK/Rubik). Then each text field takes the brand's
 * heading/body/cta font and weight.
 */
function resolveFonts(layout, brand) {
  const t = brand?.typography;
  if (t && (layout.font === 'brand' || t.strict)) {
    const slot = (role) => ({ name: t[`${role}Font`], family: t[`${role}Fallback`], weight: t[`${role}Weight`] || 400 });
    return { heading: slot('heading'), body: slot('body'), cta: slot('cta') };
  }
  const own = { name: layout.font.family, family: layout.font.fallback, weight: layout.font.weight || 400 };
  return { heading: own, body: own, cta: own };
}

function drawCover(ctx, img, W, H, posX, posY) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  let w, h;
  if (imgRatio > W / H) { h = H; w = h * imgRatio; } else { w = W; h = w / imgRatio; }
  ctx.drawImage(img, (W - w) * posX, (H - h) * posY, w, h);
}

// Shrinks from the design's font size until the wrapped text fits the box height.
function fitInBox(ctx, text, layer, k, font) {
  const maxW = layer.w * k;
  const maxH = layer.h * k * 1.05;
  const min = (layer.minFontSize ?? layer.fontSize * 0.6) * k;
  let size = layer.fontSize * k;
  let lines;
  for (; size >= min; size -= 1) {
    ctx.font = `${font.weight} ${size}px ${font.family}`;
    lines = wrapText(ctx, text, maxW);
    if (lines.length * size * layer.lineHeight <= maxH) break;
  }
  size = Math.max(size, min);
  ctx.font = `${font.weight} ${size}px ${font.family}`;
  return { size, lines: wrapText(ctx, text, maxW) };
}

async function drawTextLayer(ctx, layer, text, k, ox, oy, font) {
  if (!text) return;
  const { size, lines } = fitInBox(ctx, text, layer, k, font);
  const boxW = layer.w * k;
  const boxH = layer.h * k;
  const lineH = size * layer.lineHeight;
  const textH = lines.length * lineH;

  ctx.save();
  // Canva rotates around the centre of the (unrotated) box.
  ctx.translate(ox + (layer.x * k) + boxW / 2, oy + (layer.y * k) + boxH / 2);
  ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
  ctx.fillStyle = layer.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let y = -boxH / 2 + (layer.valign === 'middle' ? (boxH - textH) / 2 : 0) + lineH / 2;
  let lastLineEnd = 0;
  for (const line of lines) {
    ctx.fillText(line, -boxW / 2, y);
    lastLineEnd = -boxW / 2 + ctx.measureText(line).width;
    y += lineH;
  }

  // A sticker that follows the text (e.g. the arrow after the CTA) moves
  // with the end of the last line, so it never overlaps a longer text.
  const trail = layer.trailingSticker;
  if (trail) {
    const img = await tryLoadImage(trail.src);
    if (img) {
      const scale = size / (layer.fontSize * k);
      const w = trail.w * k * scale;
      const h = trail.h * k * scale;
      const lastLineY = y - lineH;
      ctx.drawImage(img, lastLineEnd + trail.gap * k, lastLineY - h / 2, w, h);
    }
  }
  ctx.restore();
}

export async function renderLayout(canvas, ctx, brand, adData, options, W, H) {
  const layout = LAYOUTS[adData.template.slice(LAYOUT_PREFIX.length)];
  if (!layout) return;

  const fonts = resolveFonts(layout, brand);
  await Promise.all(Object.values(fonts).map((f) =>
    document.fonts.load(`${f.weight} 40px "${f.name}"`).catch(() => null)));

  // Photo: the uploaded one, or the cleaned-up original from the decomposer.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const photo = options.adImage || await tryLoadImage(layout.defaultPhoto);
  if (photo) drawCover(ctx, photo, W, H, adData.image_position_x ?? 0.5, adData.image_position_y ?? 0.5);

  const { width: dw, height: dh } = layout.designSize;
  const k = Math.min(W / dw, H / dh);
  const ox = (W - dw * k) * (layout.anchor?.x ?? 0.5);
  const oy = (H - dh * k) * (layout.anchor?.y ?? 0.5);

  for (const layer of layout.layers) {
    if (layer.type === 'sticker') {
      const img = await tryLoadImage(layer.src);
      if (!img) continue;
      const w = layer.w * k;
      const h = layer.h * k;
      ctx.save();
      ctx.translate(ox + layer.x * k + w / 2, oy + layer.y * k + h / 2);
      ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else if (layer.type === 'text') {
      await drawTextLayer(ctx, layer, adData[layer.field], k, ox, oy, fonts[FIELD_ROLE[layer.field] || 'body']);
    }
  }
}
