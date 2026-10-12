import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const inputDir = path.join(os.homedir(), 'Desktop/meta-ad-creator-input')

// The client-approval site lives next to this project; "Zet in showcase"
// writes a batch straight into its per-client ad folder.
const showcaseAdsDir = fileURLToPath(new URL('../meta-ad-showcase/public/ads', import.meta.url))
const showcaseRepoRoot = path.dirname(path.dirname(showcaseAdsDir))

const SLUG_RE = /^[a-z0-9-]+$/
const FILE_RE = /^[a-zA-Z0-9._-]+\.(png|jpg)$/

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

// Keeps a client's campaigns.json (the archive picker in the showcase) in
// sync whenever a campaign batch is published.
function updateCampaignsIndex(clientDir, clientName, campaignSlug, campaignName) {
  const indexPath = path.join(clientDir, 'campaigns.json')
  const index = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
    : { client: clientName, campaigns: [] }
  index.client = clientName || index.client
  const entry = { slug: campaignSlug, name: campaignName || campaignSlug, updatedAt: new Date().toISOString() }
  const i = index.campaigns.findIndex((c) => c.slug === campaignSlug)
  if (i >= 0) index.campaigns[i] = entry
  else index.campaigns.push(entry)
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`)
}

// Catches the one way the showcase's two valid shapes (single campaign vs.
// an archive of campaigns) can collide: a client folder with both its own
// ads.json AND campaign subfolders. That shape makes the archive picker
// invisible (the client is treated as single-campaign instead), which is
// exactly what an accidental publish without a campaign name produces.
function conflictingClients() {
  const problems = []
  if (!fs.existsSync(showcaseAdsDir)) return problems
  for (const entry of fs.readdirSync(showcaseAdsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(showcaseAdsDir, entry.name)
    const hasOwnManifest = fs.existsSync(path.join(dir, 'ads.json'))
    const campaigns = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'ads.json')))
      .map((e) => e.name)
    if (hasOwnManifest && campaigns.length > 0) {
      problems.push(
        `${entry.name}/ heeft zowel een losse ads.json als campagnemappen (${campaigns.join(', ')}) — ` +
          `verwijder de losse ads.json of verplaats 'm naar een eigen campagnemap.`
      )
    }
  }
  return problems
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: showcaseRepoRoot, encoding: 'utf8' })
  } catch (err) {
    throw new Error(err.stderr?.toString().trim() || err.message)
  }
}

// Which client/campaign folders have pending changes, for the commit message.
function changedScopes() {
  const status = git(['status', '--porcelain', '--', 'public/ads'])
  const scopes = new Set()
  for (const line of status.split('\n')) {
    const filePath = line.slice(3).trim()
    if (!filePath) continue
    const target = filePath.includes(' -> ') ? filePath.split(' -> ')[1] : filePath
    const parts = target.split('/') // public/ads/<client>/[<campaign>/]...
    if (parts.length >= 5) scopes.add(`${parts[2]}/${parts[3]}`)
    else if (parts.length >= 3) scopes.add(parts[2])
  }
  return [...scopes].sort()
}

// Dev-server only: a browser page cannot write files itself, the local Vite
// server can. Two calls per batch:
//   POST /__showcase/ad?client=<slug>&campaign=<slug>&file=<name.jpg>   body = the image
//   POST /__showcase/manifest?client=<slug>&campaign=<slug>             body = { clientName, campaignName, ads, copy }
// `campaign` is optional: without it a batch lands straight in the client
// folder (one campaign, the shape before campaigns existed). With it, the
// batch gets its own subfolder and the client's campaigns.json is updated,
// so the showcase shows the client as an archive of campaigns.
function publishToShowcase() {
  return {
    name: 'publish-to-showcase',
    configureServer(server) {
      server.middlewares.use('/__showcase', async (req, res) => {
        try {
          if (req.method !== 'POST') return sendJson(res, 405, { error: 'Alleen POST' })
          if (!fs.existsSync(showcaseAdsDir)) {
            return sendJson(res, 500, { error: `Showcase-map niet gevonden: ${showcaseAdsDir}` })
          }

          const url = new URL(req.url, 'http://localhost')

          // Commits and pushes public/ads — the showcase's own GitHub Action
          // then builds and deploys. Separate from "Zet in showcase" on
          // purpose: that one just writes files (fast, no deploy per ad),
          // this is the one deliberate "go live" step.
          if (url.pathname === '/publish') {
            const problems = conflictingClients()
            if (problems.length > 0) return sendJson(res, 409, { error: problems.join(' ') })

            const pending = git(['status', '--porcelain', '--', 'public/ads'])
            if (!pending.trim()) return sendJson(res, 200, { ok: true, pushed: false })

            const scopes = changedScopes()
            git(['add', '-A', '--', 'public/ads'])
            git(['commit', '-m', `Ads bijgewerkt via Meta Ad Creator: ${scopes.join(', ')}`])
            git(['push'])
            const commit = git(['rev-parse', '--short', 'HEAD']).trim()
            return sendJson(res, 200, { ok: true, pushed: true, commit, scopes })
          }

          const client = url.searchParams.get('client') || ''
          const campaign = url.searchParams.get('campaign') || ''
          if (!SLUG_RE.test(client)) return sendJson(res, 400, { error: 'Ongeldige klantnaam' })
          if (campaign && !SLUG_RE.test(campaign)) return sendJson(res, 400, { error: 'Ongeldige campagnenaam' })
          const clientDir = path.join(showcaseAdsDir, client)
          const scopeDir = campaign ? path.join(clientDir, campaign) : clientDir
          fs.mkdirSync(scopeDir, { recursive: true })

          if (url.pathname === '/ad') {
            const file = url.searchParams.get('file') || ''
            if (!FILE_RE.test(file)) return sendJson(res, 400, { error: 'Ongeldige bestandsnaam' })
            fs.writeFileSync(path.join(scopeDir, file), await readBody(req))
            return sendJson(res, 200, { ok: true })
          }

          if (url.pathname === '/manifest') {
            const { clientName, campaignName, ads, copy } = JSON.parse((await readBody(req)).toString('utf8'))
            const manifestPath = path.join(scopeDir, 'ads.json')
            // Keep what is already there: a batch without Meta copy leaves the copy alone.
            const manifest = fs.existsSync(manifestPath)
              ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
              : {}
            const existing = manifest.ads || []
            // Same id = same ad: replace it in place, append the rest.
            const byId = new Map(existing.map((ad) => [ad.id, ad]))
            for (const ad of ads) {
              // A replaced ad may have had another file name (e.g. an older .png): drop it.
              const oldFile = byId.get(ad.id)?.file
              if (oldFile && oldFile !== ad.file && FILE_RE.test(oldFile)) {
                fs.rmSync(path.join(scopeDir, oldFile), { force: true })
              }
              byId.set(ad.id, ad)
            }
            const merged = [...byId.values()]
            fs.writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, client: clientName, ads: merged, ...(copy && { copy }) }, null, 2)}\n`)
            if (campaign) updateCampaignsIndex(clientDir, clientName, campaign, campaignName)
            return sendJson(res, 200, { ok: true, total: merged.length, dir: scopeDir })
          }

          return sendJson(res, 404, { error: 'Onbekend pad' })
        } catch (err) {
          return sendJson(res, 500, { error: err.message })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-input-folder',
      configureServer(server) {
        server.middlewares.use('/input', (req, res, next) => {
          const filePath = path.join(inputDir, decodeURIComponent(req.url))
          res.setHeader('Access-Control-Allow-Origin', '*')
          server.middlewares.handle(
            Object.assign(req, { url: '/@fs/' + filePath }),
            res,
            next
          )
        })
      },
    },
    publishToShowcase(),
  ],
  server: {
    fs: {
      allow: ['.', inputDir],
    },
  },
})
