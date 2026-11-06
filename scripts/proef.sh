#!/bin/bash
# Renders proof variants of a layout with headless Chrome.
#   scripts/proef.sh <layout-id> [merk-id]
# Writes proeven/<layout-id>[-<merk>].png and opens it.
set -euo pipefail
cd "$(dirname "$0")/.."

LAYOUT="${1:?gebruik: scripts/proef.sh <layout-id> [merk-id]}"
BRAND="${2:-}"
PORT=5198
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="proeven/${LAYOUT}${BRAND:+-$BRAND}.png"
PAGE="proef-tmp.html"
mkdir -p proeven

FONTS=$(grep -o '<link href="https://fonts.googleapis.com/css2[^>]*>' index.html)
cat > "$PAGE" <<EOF
<!doctype html><html><head>${FONTS}
<style>body{margin:0;background:#ddd;display:flex;gap:16px;padding:16px;align-items:flex-start;font:14px sans-serif}canvas{width:400px;height:auto;display:block}</style></head><body>
<script type="module">
import { renderAd } from '/src/lib/canvasRenderer.js';
import { getBrand } from '/src/brands/index.js';
const brand = getBrand('${BRAND}') || { colors: {} };
const layout = (await import('/src/layouts/${LAYOUT}.json')).default;
const original = Object.fromEntries(layout.layers.filter((l) => l.type === 'text').map((l) => [l.field, l.sourceText || '']));
const variants = [
  ['Origineel (1:1)', original, 'feed-square'],
  ['Korte tekst (1:1)', { headline: 'Kort en krachtig.', subtext: 'Eén regel.', cta_text: 'Doe mee' }, 'feed-square'],
  ['Lange tekst (9:16)', { headline: 'Dit is een veel langere kop die moet krimpen om in het vak te passen.', subtext: 'Ook de subtekst is wat langer dan in het originele ontwerp.', cta_text: 'Lees meer over dit verhaal' }, 'story'],
];
for (const [label, data, format] of variants) {
  const d = document.createElement('div'); d.textContent = label;
  const c = document.createElement('canvas'); d.appendChild(c); document.body.appendChild(d);
  await renderAd(c, brand, { ...data, template: 'layout:${LAYOUT}', format }, {});
}
</script></body></html>
EOF

npx vite --port "$PORT" --strictPort > /dev/null 2>&1 &
VITE_PID=$!
trap 'kill $VITE_PID 2>/dev/null; rm -f "$PAGE"' EXIT
sleep 3

"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1300,820 \
  --virtual-time-budget=8000 --screenshot="$OUT" "http://localhost:$PORT/$PAGE" 2>/dev/null
echo "Proef: $OUT"
open "$OUT"
