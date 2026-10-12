import { SCALE } from './constants';

/**
 * Publishes a batch to the meta-ad-showcase project (client approval site),
 * into public/ads/<slug>/ — see the publish-to-showcase plugin in
 * vite.config.js. Only works on the local dev server.
 *
 * @param {object} brand
 * @param {Array<{ canvas: HTMLCanvasElement, filename: string, name: string }>} items
 * @param {{ id: string, ratio: string }} format
 * @param {{ campaign?: string, copy?: object }} [options] campaign gives the
 *   batch its own folder and link; copy is the Meta copy shown with the ads.
 */
export async function publishToShowcase(brand, items, format, { campaign = '', copy = null } = {}) {
  const client = brand.showcaseSlug || brand.id;
  const campaignSlug = normalizeSlug(campaign);
  const idPrefix = campaignSlug ? `${client}-${campaignSlug}` : client;
  const query = `client=${encodeURIComponent(client)}${campaignSlug ? `&campaign=${encodeURIComponent(campaignSlug)}` : ''}`;
  const ads = [];

  for (const { canvas, filename, name } of items) {
    // The format goes into the file name so 1:1 and 9:16 versions of the same
    // ad can sit side by side in one client folder.
    const base = filename.replace(/\.png$/, '');
    const file = `${base}-${format.id}.jpg`;
    const blob = await toShowcaseJpeg(canvas);
    await post(`/__showcase/ad?${query}&file=${encodeURIComponent(file)}`, blob, 'image/jpeg');
    ads.push({
      id: `${idPrefix}-${base}-${format.id}`.toLowerCase(),
      file,
      name,
      format: format.ratio,
      brand: brand.name,
    });
  }

  const result = await post(
    `/__showcase/manifest?${query}`,
    JSON.stringify({ clientName: brand.name, campaignName: campaign || undefined, ads, copy }),
    'application/json'
  );
  return { slug: showcaseSlug(brand, campaign), added: ads.length, total: result.total, dir: result.dir };
}

/**
 * Commits and pushes public/ads in the showcase repo — its GitHub Action
 * then builds and deploys. Separate from publishToShowcase() on purpose:
 * that one just writes files locally (fast, no deploy per ad); this is the
 * one deliberate "go live" step, so a work-in-progress batch never ships by
 * accident.
 *
 * @returns {Promise<{ pushed: boolean, commit?: string, scopes?: string[] }>}
 */
export async function publishLive() {
  return post('/__showcase/publish', null, 'application/json');
}

function normalizeSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Link of a batch in the showcase: the client, plus the campaign when one is
 * given (its own subfolder and link, so an older campaign stays reachable).
 */
export function showcaseSlug(brand, campaign = '') {
  const client = brand.showcaseSlug || brand.id;
  const part = normalizeSlug(campaign);
  return part ? `${client}/${part}` : client;
}

// The approval site only needs a preview: the canvas is rendered at 2x for
// the real PNG export (6+ MB each), so it is scaled back to 1x and saved as
// JPEG, which is a few hundred KB.
function toShowcaseJpeg(canvas) {
  const small = document.createElement('canvas');
  small.width = Math.round(canvas.width / SCALE);
  small.height = Math.round(canvas.height / SCALE);
  const ctx = small.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  return new Promise((resolve) => small.toBlob(resolve, 'image/jpeg', 0.9));
}

async function post(url, body, contentType) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': contentType }, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Showcase gaf status ${res.status}`);
  return data;
}
