import { SCALE } from './constants';

export const SHOWCASE_URL = 'https://db.vdveen.online/showcase';

/**
 * Publishes a batch to the client approval site (meta-ad-showcase), straight
 * into PocketBase via the dev server, see showcase-pocketbase.js. Live as soon
 * as it's written. A new campaign is not yet in the client's campaign list;
 * showInClientList() puts it there.
 *
 * @param {object} brand
 * @param {Array<{ canvas: HTMLCanvasElement, filename: string, name: string }>} items
 * @param {{ id: string, ratio: string }} format
 * @param {{ campaign?: string, copy?: object }} [options] campaign gives the
 *   batch its own link; copy is the Meta copy shown with the ads.
 */
export async function publishToShowcase(brand, items, format, { campaign = '', copy = null } = {}) {
  const client = brand.showcaseSlug || brand.id;
  const campaignSlug = normalizeSlug(campaign);
  const idPrefix = campaignSlug ? `${client}-${campaignSlug}` : client;

  const target = await post(
    '/__showcase/campaign',
    JSON.stringify({ client, clientName: brand.name, campaign: campaignSlug, campaignName: campaign || undefined, copy }),
    'application/json'
  );

  let replaced = 0;
  for (const { canvas, filename, name } of items) {
    // The format goes into the id so 1:1 and 9:16 versions of the same ad sit side by side.
    const base = filename.replace(/\.png$/, '');
    const params = new URLSearchParams({
      campaignId: target.id,
      // Only a-z, 0-9, '.', '_' and '-': spaces or accents in a file name would make the id invalid.
      // Ids that were valid already stay exactly the same, so existing approvals keep matching.
      id: `${idPrefix}-${base}-${format.id}`.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'),
      name: name || '',
      format: format.ratio,
      brand: brand.name,
    });
    const result = await post(`/__showcase/ad?${params}`, await toShowcaseJpeg(canvas), 'image/jpeg');
    if (result.replaced) replaced += 1;
  }

  return {
    campaignId: target.id,
    created: target.created,
    listed: target.listed,
    url: `${SHOWCASE_URL}/${target.link}/`,
    added: items.length - replaced,
    replaced,
  };
}

/** Puts a campaign in the client's campaign list (in_lijst = on). */
export function showInClientList(campaignId) {
  return post(`/__showcase/show?campaignId=${encodeURIComponent(campaignId)}`, null, 'application/json');
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
