/**
 * Ad format definitions.
 * All dimensions are the export size — canvas renders at 2x for retina.
 */

const FORMATS = {
  'feed-square': {
    id: 'feed-square',
    name: 'Feed Vierkant',
    width: 1080,
    height: 1080,
    ratio: '1:1',
    description: 'Facebook & Instagram feed',
  },
  'feed-portrait': {
    id: 'feed-portrait',
    name: 'Feed Portrait',
    width: 1080,
    height: 1350,
    ratio: '4:5',
    description: 'Instagram feed, Carousel',
  },
  'feed-landscape': {
    id: 'feed-landscape',
    name: 'Feed Landscape',
    width: 1200,
    height: 628,
    ratio: '1.91:1',
    description: 'Facebook ads, link ads',
  },
  'story': {
    id: 'story',
    name: 'Story / Reels',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    description: 'Instagram/Facebook Stories & Reels',
    safeZone: { top: 250, bottom: 250 },
  },
};

export function getFormat(id) {
  return FORMATS[id] || FORMATS['feed-square'];
}

export function getAllFormats() {
  return Object.values(FORMATS);
}

export function getFormatIds() {
  return Object.keys(FORMATS);
}

export default FORMATS;
