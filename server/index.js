import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  blessingOptions,
  buildReply,
  demoTagFallback,
  quickQuestions,
  roadmapDefaults,
  signs,
} from './data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storageDir = path.join(__dirname, '..', '.runtime')
const storageFile = path.join(storageDir, 'prayer-log.json')
const port = Number(process.env.PORT || 8787)

async function ensureStorage() {
  if (!existsSync(storageDir)) {
    await mkdir(storageDir, { recursive: true })
  }

  if (!existsSync(storageFile)) {
    await writeFile(
      storageFile,
      JSON.stringify({ visits: [], draws: [], chats: [] }, null, 2),
      'utf8',
    )
  }
}

async function readStorage() {
  await ensureStorage()
  const raw = await readFile(storageFile, 'utf8')
  return JSON.parse(raw)
}

async function writeStorage(nextData) {
  await ensureStorage()
  await writeFile(storageFile, JSON.stringify(nextData, null, 2), 'utf8')
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  response.end(JSON.stringify(payload))
}

function normalizeTagProfile(input = {}) {
  return {
    tagId: input.tagId || demoTagFallback.tagId,
    series: input.series || demoTagFallback.series,
    temple: input.temple || demoTagFallback.temple,
    blessingType: input.blessingType || demoTagFallback.blessingType,
  }
}

function pickSign(tagId) {
  const sum = Array.from(tagId).reduce((total, char) => total + char.charCodeAt(0), 0)
  return signs[sum % signs.length]
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = ''
    request.on('data', (chunk) => {
      raw += chunk
    })
    request.on('end', () => {
      if (!raw) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function buildOraclePromptReply({ direction, sign, question }) {
  const cleanQuestion = String(question || '').trim()
  const signLabel = sign?.label || `第${sign?.id || ''}签`
  const signLevel = sign?.level || ''
  const signSummary = sign?.summary || ''
  const signVision = sign?.vision || ''

  if (cleanQuestion.includes('主动')) {
    return `就这支${direction}签来看，可以主动，但要以稳为先。${signSummary}建议你先迈出一小步，再观察回应，别把主动变成催促。`
  }

  if (cleanQuestion.includes('决定')) {
    return `这支${direction}签更适合你先看清节奏，再决定下一步。${signSummary}如果眼前的信息还不完整，就先补齐关键判断依据。`
  }

  if (cleanQuestion.includes('祝福')) {
    return `${signLabel}${signLevel ? `·${signLevel}` : ''}送你的今日祝福是：${signVision}。愿你此刻心里有底，脚下有路。`
  }

  return `你问的是「${cleanQuestion}」。从${signLabel}${signLevel ? `·${signLevel}` : ''}来看，这支${direction}签最想提醒你的是：${signSummary}把注意力放回当下最能推进的一件小事，反而更容易迎来你想要的回应。`
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: 'Missing request URL.' })
    return
  }

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  const url = new URL(request.url, `http://${request.headers.host}`)

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      mode: 'local-api',
      blessingOptions,
      quickQuestions,
      roadmapDefaults,
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/session') {
    const body = await parseJsonBody(request).catch(() => null)
    if (!body) {
      sendJson(response, 400, { error: 'Invalid JSON body.' })
      return
    }

    const storage = await readStorage()
    const tagProfile = normalizeTagProfile(body.tagProfile)
    const visit = {
      id: `visit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tagProfile,
      source: body.source || 'web',
      userAgent: body.userAgent || '',
    }

    storage.visits.push(visit)
    await writeStorage(storage)

    sendJson(response, 200, {
      ok: true,
      visitId: visit.id,
      tagProfile,
      roadmapDefaults,
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/draw') {
    const body = await parseJsonBody(request).catch(() => null)
    if (!body) {
      sendJson(response, 400, { error: 'Invalid JSON body.' })
      return
    }

    const tagProfile = normalizeTagProfile(body.tagProfile)
    const blessingType = body.blessingType || tagProfile.blessingType
    const selectedOption =
      blessingOptions.find((item) => item.id === blessingType) ||
      blessingOptions.find((item) => item.id === demoTagFallback.blessingType)

    const sign = pickSign(tagProfile.tagId)
    const storage = await readStorage()
    const draw = {
      id: `draw-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tagProfile,
      blessingType: selectedOption.id,
      signId: sign.id,
    }

    storage.draws.push(draw)
    await writeStorage(storage)

    sendJson(response, 200, {
      ok: true,
      drawId: draw.id,
      sign,
      option: selectedOption,
      message: `你今日抽到第 ${sign.id} 签，${sign.level}。${sign.summary}你可以继续问我，我会结合「${selectedOption.name}」方向为你解签。`,
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/chat') {
    const body = await parseJsonBody(request).catch(() => null)
    if (!body) {
      sendJson(response, 400, { error: 'Invalid JSON body.' })
      return
    }

    const option = blessingOptions.find((item) => item.id === body.blessingType)
    const sign = signs.find((item) => item.id === body.signId)
    const question = String(body.question || '').trim()

    if (!option || !sign || !question) {
      sendJson(response, 400, { error: 'Missing blessingType, signId, or question.' })
      return
    }

    const reply = buildReply(question, sign, option)
    const storage = await readStorage()

    storage.chats.push({
      id: `chat-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tagProfile: normalizeTagProfile(body.tagProfile),
      blessingType: option.id,
      signId: sign.id,
      question,
      reply,
    })

    await writeStorage(storage)

    sendJson(response, 200, {
      ok: true,
      reply,
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/oracle/reply') {
    const body = await parseJsonBody(request).catch(() => null)
    if (!body) {
      sendJson(response, 400, { error: 'Invalid JSON body.' })
      return
    }

    const direction = String(body.direction || '').trim()
    const sign = body.sign || {}
    const question = String(body.question || '').trim()

    if (!direction || !sign || !question) {
      sendJson(response, 400, { error: 'Missing direction, sign, or question.' })
      return
    }

    sendJson(response, 200, {
      ok: true,
      reply: buildOraclePromptReply({ direction, sign, question }),
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/summary') {
    const storage = await readStorage()
    sendJson(response, 200, {
      ok: true,
      totals: {
        visits: storage.visits.length,
        draws: storage.draws.length,
        chats: storage.chats.length,
      },
      latestVisit: storage.visits.at(-1) || null,
      latestDraw: storage.draws.at(-1) || null,
      latestChat: storage.chats.at(-1) || null,
    })
    return
  }

  sendJson(response, 404, { error: 'Not found.' })
})

server.listen(port, () => {
  console.log(`Bracelet prayer API listening on http://127.0.0.1:${port}`)
})
