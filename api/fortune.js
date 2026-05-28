const oracleApiKey = process.env.DASHSCOPE_API_KEY || ''
const oracleModel = process.env.DASHSCOPE_MODEL || 'qwen-turbo'
const oracleBaseUrl =
  process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'

async function callOracleModel({ direction, sign, question }) {
  const signLabel = sign?.label || `第${sign?.id || ''}签`
  const signLevel = sign?.level || ''
  const signPoem = sign?.poem || ''
  const signSummary = sign?.summary || ''
  const signVision = sign?.vision || ''

  const systemPrompt = `你是一位温和而有智慧的签文解读者，专为用户解读求签结果。
你会结合签文的方向、签诗、签意，用真诚、平实的语言回答用户的问题。
回复控制在 150 字以内，语气亲切自然，不用客套开头，直接回答问题。`

  const userMessage = `我求了一支「${direction}」方向的签。
签文：${signLabel} · ${signLevel}
签诗：${signPoem}
签意：${signSummary}
愿景：${signVision}

我的问题是：${question}`

  console.log(`[fortune] calling ${oracleModel} for direction=${direction} question="${question.slice(0, 20)}..."`)

  const response = await fetch(`${oracleBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${oracleApiKey}`,
    },
    body: JSON.stringify({
      model: oracleModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.8,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error(`[fortune] error status=${response.status} body=${errorText}`)
    throw new Error(`model-request-failed:${response.status}`)
  }

  const payload = await response.json()
  const reply = payload?.choices?.[0]?.message?.content?.trim() || ''

  console.log(`[fortune] success reply="${reply.slice(0, 40)}..."`)

  if (!reply) {
    throw new Error('empty-model-reply')
  }

  return reply
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = req.body || {}

  const direction = String(body.direction || '').trim()
  const sign = body.sign || {}
  const question = String(body.question || '').trim()

  if (!direction || !question) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(400).json({ error: 'Missing direction, sign, or question.' })
    return
  }

  if (!oracleApiKey) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json({
      reply: `未配置解签模型 Key。签文${sign.label}·${sign.level}提醒你：${sign.summary || ''}`,
    })
    return
  }

  try {
    const reply = await callOracleModel({ direction, sign, question })
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json({ reply })
  } catch (error) {
    console.error('[fortune] Oracle model error:', error)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json({
      reply: `这支${direction}签（${sign.label}·${sign.level}）想提醒你：${sign.summary || '把注意力放回当下最能推进的一件小事。'}（当前 AI 解签暂不可用，以上为签文本意）`,
    })
  }
}
