# Meta Ad Creator

Maakt Meta-advertenties (Facebook/Instagram) in de huisstijl van een merk. Je plakt een lijst met koppen en teksten, kiest een merk en een template, en downloadt de advertenties als PNG's in een zip.

De app draait volledig in je browser. Er is geen server, account of API-sleutel nodig.

## Starten

Je hebt [Node.js](https://nodejs.org) nodig.

```bash
npm install
npm run dev -- --open
```

Op een Mac kun je na `npm install` ook dubbelklikken op `start.command`.

## Gebruiken

1. Kies een merk.
2. Plak je advertentieteksten als CSV of TSV. De kolommen zijn `ad_name`, `headline`, `subtext`, `cta_text` en `url`.
3. Kies een template en voeg eventueel foto's toe.
4. Download de advertenties.

## Een merk toevoegen

Elk merk is één JSON-bestand in `src/brands/` met kleuren, lettertypen en logo's. De logo's staan in `public/brands/<merk>/`. Kopieer een bestaand merk, pas het aan en meld het aan in `src/brands/index.js`.

Heeft een merk een eigen opmaak nodig, dan zet je de templates in een map `src/brands/<merk>/templates/`. Zie `takecarebnb` als voorbeeld.

## Goed om te weten

- De knop "Zet in showcase" schrijft advertenties naar een map `meta-ad-showcase` die naast dit project staat. Zonder die map werkt de rest van de app gewoon.
- De logo's in `public/brands/` zijn van de betreffende organisaties. Gebruik ze alleen voor werk in hun opdracht.
