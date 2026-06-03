import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  blessingOptions,
  demoTagFallback,
  quickQuestions,
} from './data/fortuneConfig'

const isProduction = import.meta.env.PROD
const modelEndpoint = isProduction
  ? '/api/fortune'
  : import.meta.env.VITE_ORACLE_MODEL_URL?.trim() || ''
const modelKey = isProduction ? '' : import.meta.env.VITE_ORACLE_MODEL_KEY?.trim() || ''
const BAMBOO_SHAKE_MS = 1500
const SIGN_SLIDE_MS = 1700
const SIGN_HOLD_MS = 2000

function parseTagProfile() {
  if (typeof window === 'undefined') {
    return { ...demoTagFallback, isDemo: true }
  }

  const params = new URLSearchParams(window.location.search)
  const hasTagData =
    params.has('tagId') ||
    params.has('series') ||
    params.has('temple') ||
    params.has('blessingType')

  return {
    tagId: params.get('tagId') || demoTagFallback.tagId,
    series: params.get('series') || demoTagFallback.series,
    temple: params.get('temple') || demoTagFallback.temple,
    blessingType: params.get('blessingType') || demoTagFallback.blessingType,
    isDemo: !hasTagData,
  }
}

function createIntroMessage(sign, option) {
  return `你今天抽到${sign.label}，${sign.level}。这支${option.name}签提醒你：${sign.summary}`
}

function createFallbackErrorMessage() {
  return '当前 AI 解签暂不可用，请稍后再试。'
}

function SupportFooter() {
  return (
    <footer className="support-footer" aria-label="技术支持">
      <span>中智游×技术支持</span>
      <span>13967446372</span>
    </footer>
  )
}

async function* streamOracleReply({ option, sign, question }) {
  if (!modelEndpoint) {
    throw new Error('missing-model-endpoint')
  }

  const response = await fetch(modelEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(modelKey ? { Authorization: `Bearer ${modelKey}` } : {}),
    },
    body: JSON.stringify({
      direction: option.name,
      sign: {
        id: sign.id,
        label: sign.label,
        direction: sign.direction,
        level: sign.level,
        attribute: sign.attribute,
        poem: sign.poem,
        summary: sign.summary,
        vision: sign.vision,
      },
      question,
      stream: true,
    }),
  })

  if (!response.ok) {
    // Non-streaming fallback response
    if (response.headers.get('content-type')?.includes('application/json')) {
      const payload = await response.json()
      const reply = typeof payload?.reply === 'string' ? payload.reply.trim() : ''
      if (reply) {
        yield reply
        return
      }
    }
    throw new Error(`model-request-failed:${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    // Non-streaming fallback
    const payload = await response.json()
    const reply = typeof payload?.reply === 'string' ? payload.reply.trim() : ''
    if (!reply) throw new Error('empty-model-reply')
    yield reply
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const TYPING_DELAY_MS = 40

  // Collect all incoming chars into a queue, drain with typing rhythm
  const charQueue = []
  let reading = true

  // Background reader: push every char into queue
  const readPromise = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') return

          try {
            const parsed = JSON.parse(data)
            const content = parsed?.choices?.[0]?.delta?.content
            if (content) {
              for (const ch of content) {
                charQueue.push(ch)
              }
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    } finally {
      reading = false
      reader.releaseLock()
    }
  })()

  // Drain queue with typing delay
  while (reading || charQueue.length > 0) {
    if (charQueue.length > 0) {
      // Yield 1-3 chars at a time for natural rhythm
      const count = Math.min(1 + Math.floor(Math.random() * 3), charQueue.length)
      let chunk = ''
      for (let i = 0; i < count; i++) {
        chunk += charQueue.shift()
      }
      yield chunk
      await new Promise((r) => setTimeout(r, TYPING_DELAY_MS))
    } else {
      // Wait for more data
      await new Promise((r) => setTimeout(r, 30))
    }
  }

  await readPromise
}

function App() {
  const tagProfile = useMemo(() => parseTagProfile(), [])
  const initialOption =
    blessingOptions.find((item) => item.id === tagProfile.blessingType) || blessingOptions[1]
  const touchStartY = useRef(null)
  const audioContextRef = useRef(null)
  const chatLogRef = useRef(null)
  const fortuneSignsRef = useRef(null)

  async function ensureSignDataLoaded() {
    if (fortuneSignsRef.current) return
    const mod = await import('./data/fortuneSignsData')
    fortuneSignsRef.current = mod.fortuneSignsByOption
  }

  const [screen, setScreen] = useState('landing')
  const [selectedOption, setSelectedOption] = useState(initialOption)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawnSign, setDrawnSign] = useState(null)
  const [currentSign, setCurrentSign] = useState(null)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [isAskingOracle, setIsAskingOracle] = useState(false)
  const [oracleError, setOracleError] = useState('')

  useEffect(() => {
    if (screen !== 'chat') {
      return
    }

    const chatLog = chatLogRef.current
    if (!chatLog) {
      return
    }

    requestAnimationFrame(() => {
      chatLog.scrollTo({
        top: chatLog.scrollHeight,
        behavior: 'smooth',
      })
    })
  }, [screen, messages, isAskingOracle])

  function handleEnterBlessing() {
    setScreen('home')
    ensureSignDataLoaded()
  }

  function playBambooRattle() {
    if (typeof window === 'undefined') {
      return
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      return
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass()
    }

    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const start = ctx.currentTime + 0.02

    const createTap = (offset, frequency, gainLevel) => {
      const oscillator = ctx.createOscillator()
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(frequency, start + offset)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(gainLevel, start + offset + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.085)

      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(start + offset)
      oscillator.stop(start + offset + 0.11)
    }

    const createRattle = () => {
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.24), ctx.sampleRate)
      const channel = buffer.getChannelData(0)
      for (let index = 0; index < channel.length; index += 1) {
        channel[index] = (Math.random() * 2 - 1) * 0.35
      }

      const source = ctx.createBufferSource()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()

      source.buffer = buffer
      filter.type = 'bandpass'
      filter.frequency.value = 860
      filter.Q.value = 1.2

      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      source.start(start)
      source.stop(start + 0.26)
    }

    createRattle()
    createTap(0.01, 160, 0.05)
    createTap(0.09, 210, 0.045)
    createTap(0.18, 190, 0.04)
  }

  function handleLandingTouchStart(event) {
    touchStartY.current = event.touches[0]?.clientY ?? null
  }

  function handleLandingTouchEnd(event) {
    if (touchStartY.current === null) {
      return
    }

    const endY = event.changedTouches[0]?.clientY ?? touchStartY.current
    if (touchStartY.current - endY > 70) {
      handleEnterBlessing()
    }

    touchStartY.current = null
  }

  function pickRandomSign(optionId) {
    const signMap = fortuneSignsRef.current || {}
    const signPool = signMap[optionId] || signMap.career || []
    return signPool[Math.floor(Math.random() * signPool.length)]
  }

  async function handleDrawSign() {
    if (isDrawing) {
      return
    }

    setIsDrawing(true)
    setDrawnSign(null)
    playBambooRattle()

    const sign = pickRandomSign(selectedOption.id)

    window.setTimeout(() => {
      setDrawnSign(sign)
      setIsDrawing(false)
    }, BAMBOO_SHAKE_MS)
  }

  function handleOpenSign() {
    if (!drawnSign) return
    setCurrentSign(drawnSign)
    setOracleError('')
    setMessages([{ role: 'ai', text: createIntroMessage(drawnSign, selectedOption) }])
    setScreen('result')
    setDrawnSign(null)
  }

  function handleOpenAiReading() {
    setOracleError('')
    setScreen('chat')
  }

  async function handleAsk(nextQuestion) {
    const content = (nextQuestion || question).trim()
    if (!content || !currentSign || isAskingOracle) {
      return
    }

    setMessages((current) => [...current, { role: 'user', text: content }])
    setQuestion('')
    setOracleError('')
    setIsAskingOracle(true)

    try {
      const stream = streamOracleReply({
        option: selectedOption,
        sign: currentSign,
        question: content,
      })

      let firstChunk = true
      for await (const chunk of stream) {
        if (firstChunk) {
          firstChunk = false
          setIsAskingOracle(false)
          setMessages((current) => [...current, { role: 'ai', text: chunk }])
        } else {
          setMessages((current) => {
            const next = [...current]
            const last = next[next.length - 1]
            next[next.length - 1] = { role: 'ai', text: last.text + chunk }
            return next
          })
        }
      }

      // If stream produced no content chunks, show fallback
      if (firstChunk) {
        setIsAskingOracle(false)
        setMessages((current) => [...current, { role: 'ai', text: createFallbackErrorMessage() }])
        setOracleError(createFallbackErrorMessage())
      }
    } catch (err) {
      setIsAskingOracle(false)
      setMessages((current) => [...current, { role: 'ai', text: createFallbackErrorMessage() + ' (' + (err?.message || '未知错误') + ')' }])
      setOracleError(createFallbackErrorMessage())
    }
  }

  function handleRestart() {
    setScreen('landing')
    setCurrentSign(null)
    setDrawnSign(null)
    setIsDrawing(false)
    setQuestion('')
    setMessages([])
    setOracleError('')
    setIsAskingOracle(false)
  }

  return (
    <div className="page-shell">
      <main className="experience-shell">
        <section className="phone-stage">
          <div className="phone-glow" />
          <div className={`phone-card ${screen === 'chat' ? 'phone-card-chat' : ''}`}>
            {screen !== 'landing' && (
              <div className="card-topbar">
                <div>
                  <span className="topbar-kicker">今日祈福</span>
                  <h1>一签一福</h1>
                </div>
                <div className="topbar-badge">{tagProfile.temple}</div>
              </div>
            )}

            {screen === 'landing' && (
              <div
                className="screen screen-landing scroll-entry-screen"
                onTouchStart={handleLandingTouchStart}
                onTouchEnd={handleLandingTouchEnd}
              >
                <img
                  className="landing-image landing-image-full"
                  src="/底图.webp"
                  alt="今日祈福封面"
                />
                <div className="landing-scroll-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="arrow-up-icon">
                    <path d="M8 14 L12 8 L16 14 M8 10 L12 4 L16 10 M8 6 L12 0 L16 6" />
                  </svg>
                </div>
                <button
                  type="button"
                  className="landing-entry-hitbox"
                  onClick={handleEnterBlessing}
                  aria-label="进入今日祈福"
                />
              </div>
            )}

            {screen === 'home' && (
              <div className="screen blessing-screen">
                <section className="hero-block blessing-hero">
                  <span className="hero-kicker">今日祈福</span>
                  <h2>请选择你今天最想被祝福的方向</h2>
                  <p>轻触其一，抽一支签，让今日所念有所回应。</p>
                </section>

                <section className="blessing-grid">
                  {blessingOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`blessing-card ${selectedOption.id === option.id ? 'blessing-card-active' : ''}`}
                      onClick={() => setSelectedOption(option)}
                    >
                      <div className="blessing-card-mark">{option.short}</div>
                      <strong>{option.name}</strong>
                      <span>{option.hint}</span>
                    </button>
                  ))}
                </section>

                <button type="button" className="primary-button" onClick={() => setScreen('draw')}>
                  为「{selectedOption.name}」抽一签
                </button>

                <SupportFooter />
              </div>
            )}

            {screen === 'draw' && (
              <div className="screen draw-screen">
                <section className="draw-heading">
                  <span className="hero-kicker">竹筒求签</span>
                  <h2>静心三秒，再摇一摇竹筒</h2>
                  <p>为「{selectedOption.name}」默念所求，轻触竹筒，等一支签缓缓落出。</p>
                </section>

                <section className="draw-stage-panel">
                  <div className={`oracle-vessel ${isDrawing ? 'oracle-vessel-active' : ''}`}>
                    <div className="vessel-shadow" />
                    <div className="bamboo-tube">
                      <div className="bamboo-tube-rim" />
                      <div className="bamboo-tube-body">
                        <div className="bamboo-tube-label">求签</div>
                        <div className="bamboo-base-ring bamboo-base-ring-top" />
                        <div className="bamboo-base-ring bamboo-base-ring-bottom" />
                      </div>
                    </div>
                  </div>
                </section>

                {drawnSign && (
                  <div className="drawn-slip-overlay" aria-hidden="true">
                    <div className="drawn-slip">
                      <span className="slip-tassel" />
                      <div className="slip-header">
                        <span className="slip-header-text">{selectedOption.name}</span>
                      </div>
                      <div className="slip-body">
                        <div className="slip-level">{drawnSign.level}</div>
                      </div>
                      <div className="slip-footer">
                        <span className="slip-seal" />
                        <span className="slip-number">{drawnSign.label}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="action-stack draw-action-stack">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={drawnSign ? handleOpenSign : handleDrawSign}
                    disabled={isDrawing}
                  >
                    {isDrawing ? '竹筒摇签中...' : drawnSign ? '开启福签' : '诚心抽一签'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setDrawnSign(null)
                      setIsDrawing(false)
                      setScreen('home')
                    }}
                  >
                    返回重选方向
                  </button>
                </div>
              </div>
            )}

            {screen === 'result' && currentSign && (
              <div className="screen">
                <section className="sign-header">
                  <span className="hero-kicker">今日灵签 · {selectedOption.name}</span>
                  <h2>
                    {currentSign.label} · {currentSign.level}
                  </h2>
                  <p className="sign-subhead">{currentSign.attribute}</p>
                  <p className="poem-block">{currentSign.poem}</p>
                </section>

                <section className="reading-card">
                  <span className="route-label">今日签意</span>
                  <p>{currentSign.summary}</p>
                  <div className="advice-card">
                    <span className="route-label">核心愿景</span>
                    <strong>{currentSign.vision}</strong>
                  </div>
                </section>

                <div className="action-stack">
                  <button type="button" className="primary-button" onClick={handleOpenAiReading}>
                    继续 AI 解签
                  </button>
                  <button type="button" className="ghost-button" onClick={handleRestart}>
                    返回封面
                  </button>
                </div>
              </div>
            )}

            {screen === 'chat' && currentSign && (
              <div className="screen chat-screen">
                <section className="hero-block hero-block-compact">
                  <span className="hero-kicker">AI 解签</span>
                  <h2>
                    {currentSign.label} · {currentSign.level}
                  </h2>

                </section>

                <div className="quick-question-row">
                  {quickQuestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="quick-question"
                      onClick={() => handleAsk(item)}
                      disabled={isAskingOracle}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {oracleError && <div className="status-banner status-banner-error">{oracleError}</div>}

                <div className="chat-log" ref={chatLogRef}>
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`chat-bubble-row ${message.role === 'user' ? 'chat-bubble-row-user' : ''}`}
                    >
                      <div
                        className={`chat-bubble ${message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))}

                  {isAskingOracle && (
                    <div className="chat-bubble-row">
                      <div className="chat-bubble chat-bubble-ai">正在请解签大师细看这一签...</div>
                    </div>
                  )}
                </div>

                <div className="chat-footer">
                  <div className="chat-composer">
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      placeholder="问问这支签想提醒你什么..."
                      disabled={isAskingOracle}
                    />
                    <button type="button" onClick={() => handleAsk()} disabled={isAskingOracle}>
                      {isAskingOracle ? '发送中' : '发送'}
                    </button>
                  </div>

                  <button type="button" className="ghost-button align-left" onClick={() => setScreen('result')}>
                    返回签文
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
