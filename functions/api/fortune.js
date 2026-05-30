async function callOracleModel({ direction, sign, question }, env) {
  const oracleApiKey = env.DASHSCOPE_API_KEY || ''
  const oracleModel = env.DASHSCOPE_MODEL || 'qwen3.6-plus'
  const oracleBaseUrl =
    env.DASHSCOPE_BASE_URL || 'https://api-token.zhongzhiyou.cn/api/v1'

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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (request.method === 'GET') {
    return new Response(JSON.stringify({ ok: true, method: 'GET', hasKey: !!env.DASHSCOPE_API_KEY }), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed', method: request.method }), {
      status: 405,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  const direction = String(body.direction || '').trim()
  const sign = body.sign || {}
  const question = String(body.question || '').trim()

  if (!direction || !question) {
    return new Response(JSON.stringify({ error: 'Missing direction, sign, or question.' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  if (!env.DASHSCOPE_API_KEY) {
    return new Response(
      JSON.stringify({
        reply: `未配置解签模型 Key。签文${sign.label}·${sign.level}提醒你：${sign.summary || ''}`,
      }),
      { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' } },
    )
  }

  const useStream = body.stream === true

  if (useStream) {
    const oracleApiKey = env.DASHSCOPE_API_KEY || ''
    const oracleModel = env.DASHSCOPE_MODEL || 'qwen3.6-plus'
    const oracleBaseUrl = env.DASHSCOPE_BASE_URL || 'https://api-token.zhongzhiyou.cn/api/v1'

    const signLabel = sign?.label || `第${sign?.id || ''}签`
    const signLevel = sign?.level || ''
    const signPoem = sign?.poem || ''
    const signSummary = sign?.summary || ''
    const signVision = sign?.vision || ''

    const systemPrompt = `你是一位温和而有智慧的签文解读者，专为用户解读求签结果。你会结合签文的方向、签诗、签意，用真诚、平实的语言回答用户的问题。回复控制在 150 字以内，语气亲切自然，不用客套开头，直接回答问题。`
    const userMessage = `我求了一支「${direction}」方向的签。\n签文：${signLabel} · ${signLevel}\n签诗：${signPoem}\n签意：${signSummary}\n愿景：${signVision}\n\n我的问题是：${question}`

    let upstream
    try {
      upstream = await fetch(`${oracleBaseUrl}/chat/completions`, {
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
          stream: true,
        }),
      })
    } catch (err) {
      console.error('[fortune] upstream fetch error:', err)
      return new Response(
        JSON.stringify({
          reply: `这支${direction}签（${signLabel}·${signLevel}）想提醒你：${signSummary || ''}（当前 AI 解签暂不可用）`,
        }),
        { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' } },
      )
    }

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => '')
      console.error(`[fortune] upstream error status=${upstream.status} body=${errorText}`)
      return new Response(
        JSON.stringify({
          reply: `这支${direction}签（${signLabel}·${signLevel}）想提醒你：${signSummary || ''}（当前 AI 解签暂不可用）`,
        }),
        { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' } },
      )
    }

    const headers = {
      ...corsHeaders(),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    }

    return new Response(upstream.body, { status: 200, headers })
  }

  try {
    const reply = await callOracleModel({ direction, sign, question }, env)
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    console.error('[fortune] Oracle model error:', error)
    return new Response(
      JSON.stringify({
        reply: `这支${direction}签（${sign.label}·${sign.level}）想提醒你：${sign.summary || '把注意力放回当下最能推进的一件小事。'}（当前 AI 解签暂不可用，以上为签文本意）`,
      }),
      { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' },
      },
    )
  }
}
