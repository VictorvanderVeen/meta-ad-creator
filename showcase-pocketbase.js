// "Zet in showcase": writes a batch straight into PocketBase on db.vdveen.online,
// the collections of meta-ad-showcase (pocketbase/pb_migrations/1793200000_showcase_ads.js).
// Live within seconds, no git, no deploy.
//
// Dev-server only. The browser cannot hold the superuser password (this repo is
// public, and the page runs client-side), so the local Vite server makes the calls.
// Credentials come from .env.local (PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD),
// which *.local in .gitignore keeps out of the repo.
//
//   POST /__showcase/campaign   body = { client, clientName, campaign, campaignName, copy }
//                                → { id, created }   creates/updates klant + campagne
//   POST /__showcase/ad?campaignId=…&id=…&name=…&format=…&brand=…   body = the jpeg
//                                → upserts on item_id; the image only goes up when it changed
//   POST /__showcase/show?campaignId=…   in_lijst = on: the campaign appears in the
//                                client's campaign list
//
// A new campaign starts with in_lijst = off: reachable via its own link (so you can
// check it), but not yet in the list the client sees.

import crypto from 'crypto'

const SLUG_RE = /^[a-z0-9-]*$/
const ID_RE = /^[a-z0-9]{15}$/

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`

function pocketbase(env) {
  const base = (env.PB_URL || '').replace(/\/$/, '')
  let token = ''

  async function api(path, { method = 'GET', json, form, retry = true } = {}) {
    if (!base || !env.PB_ADMIN_EMAIL) {
      throw new HttpError(500, 'PB_URL / PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD ontbreken in .env.local van de creator')
    }
    if (!token) await login()
    const res = await fetch(base + path, {
      method,
      headers: { Authorization: token, ...(json ? { 'Content-Type': 'application/json' } : {}) },
      body: json ? JSON.stringify(json) : form,
    })
    // Superuser tokens expire; log in again once.
    if (res.status === 401 && retry) {
      token = ''
      return api(path, { method, json, form, retry: false })
    }
    const body = res.status === 204 ? {} : await res.json().catch(() => ({}))
    if (!res.ok) throw new HttpError(502, `PocketBase ${method} ${path.split('?')[0]}: ${res.status} ${JSON.stringify(body)}`)
    return body
  }

  async function login() {
    const res = await fetch(`${base}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: env.PB_ADMIN_EMAIL, password: env.PB_ADMIN_PASSWORD }),
    })
    if (!res.ok) throw new HttpError(502, `Inloggen bij PocketBase mislukt (${res.status})`)
    token = (await res.json()).token
  }

  const records = (c) => `/api/collections/${c}/records`
  const find = async (c, filter, extra = '') =>
    (await api(`${records(c)}?perPage=500&skipTotal=1&filter=${encodeURIComponent(filter)}${extra}`)).items
  const save = (c, existing, data) =>
    existing
      ? api(`${records(c)}/${existing.id}`, { method: 'PATCH', ...data })
      : api(records(c), { method: 'POST', ...data })

  return { api, find, save, records }
}

async function upsertCampaign(pb, { client, clientName, campaign = '', campaignName, copy }) {
  if (!client || !SLUG_RE.test(client)) throw new HttpError(400, 'Ongeldige klantnaam')
  if (!SLUG_RE.test(campaign)) throw new HttpError(400, 'Ongeldige campagnenaam')

  const [klantRec] = await pb.find('adshowcase_klanten', `slug=${q(client)}`)
  const klant = klantRec || (await pb.save('adshowcase_klanten', null, { json: { slug: client, naam: clientName || client } }))

  const [existing] = await pb.find('adshowcase_campagnes', `klant=${q(klant.id)} && slug=${q(campaign)}`)

  // A loose set next to campaigns hides the client's campaign list (the link
  // then shows the loose set). That is what a batch without a campaign name
  // used to do by accident, so refuse it.
  if (!campaign && !existing) {
    const named = await pb.find('adshowcase_campagnes', `klant=${q(klant.id)} && slug!=""`)
    if (named.length > 0) {
      throw new HttpError(
        409,
        `${client} heeft al campagnes (${named.map((c) => c.slug).join(', ')}). Vul bovenaan, onder ` +
          '"voor de showcase", het veld Campagne in, bijvoorbeeld de campagnecode. Zonder naam verdwijnt de ' +
          'campagnelijst van de klant achter deze losse set.'
      )
    }
  }

  const fields = {
    klant: klant.id,
    slug: campaign,
    bijgewerkt: new Date().toISOString(),
    // Name and flags only when new: after that they're managed in the dashboard.
    ...(!existing && { naam: campaignName || campaign || klant.naam, actief: true, in_lijst: false }),
    // A batch without Meta copy leaves the copy alone.
    ...(copy && {
      pagina_naam: copy.pageName || '',
      kleur: copy.color || '',
      domein: copy.domain || '',
      cta: copy.cta || '',
      primaire_teksten: copy.primaryTexts || [],
      koppen: copy.headlines || [],
      beschrijvingen: copy.descriptions || [],
    }),
  }
  const rec = await pb.save('adshowcase_campagnes', existing, { json: fields })
  return { id: rec.id, created: !existing, listed: rec.in_lijst, link: campaign ? `${client}/${campaign}` : client }
}

async function upsertAd(pb, params, image) {
  const campaignId = params.get('campaignId') || ''
  const itemId = params.get('id') || ''
  if (!ID_RE.test(campaignId)) throw new HttpError(400, 'Ongeldige campagne')
  if (!/^[a-z0-9._-]+$/.test(itemId)) throw new HttpError(400, `Ongeldige ad-id: "${itemId}"`)
  if (!image.length) throw new HttpError(400, 'Geen beeld ontvangen')

  // item_id is unique across campaigns: an ad that moved campaigns comes along,
  // and keeps its client's approvals.
  const [existing] = await pb.find('adshowcase_ads', `item_id=${q(itemId)}`)
  let volgorde = existing?.campagne === campaignId ? existing.volgorde : undefined
  if (volgorde === undefined) {
    const [last] = await pb.find('adshowcase_ads', `campagne=${q(campaignId)}`, '&sort=-volgorde&perPage=1')
    volgorde = (last?.volgorde || 0) + 1
  }

  const hash = crypto.createHash('sha256').update(image).digest('hex')
  const fields = {
    campagne: campaignId,
    item_id: itemId,
    volgorde,
    naam: params.get('name') || '',
    formaat: params.get('format') || '',
    merk: params.get('brand') || '',
    bron_hash: hash,
  }
  const imageChanged = existing?.bron_hash !== hash
  let data
  if (imageChanged) {
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v))
    form.append('beeld', new Blob([image], { type: 'image/jpeg' }), `${itemId}.jpg`)
    data = { form }
  } else {
    data = { json: fields }
  }
  await pb.save('adshowcase_ads', existing, data)
  return { replaced: Boolean(existing), imageChanged }
}

export function publishToShowcase(env) {
  const pb = pocketbase(env)
  return {
    name: 'publish-to-showcase',
    configureServer(server) {
      server.middlewares.use('/__showcase', async (req, res) => {
        try {
          if (req.method !== 'POST') return sendJson(res, 405, { error: 'Alleen POST' })
          const url = new URL(req.url, 'http://localhost')

          if (url.pathname === '/campaign') {
            const body = JSON.parse((await readBody(req)).toString('utf8'))
            return sendJson(res, 200, await upsertCampaign(pb, body))
          }

          if (url.pathname === '/ad') {
            return sendJson(res, 200, await upsertAd(pb, url.searchParams, await readBody(req)))
          }

          if (url.pathname === '/show') {
            const campaignId = url.searchParams.get('campaignId') || ''
            if (!ID_RE.test(campaignId)) return sendJson(res, 400, { error: 'Ongeldige campagne' })
            await pb.api(`${pb.records('adshowcase_campagnes')}/${campaignId}`, {
              method: 'PATCH',
              json: { in_lijst: true },
            })
            return sendJson(res, 200, { ok: true })
          }

          return sendJson(res, 404, { error: 'Onbekend pad' })
        } catch (err) {
          return sendJson(res, err.status || 500, { error: err.message })
        }
      })
    },
  }
}
