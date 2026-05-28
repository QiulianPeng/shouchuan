import { useMemo, useRef, useState } from 'react'
import './App.css'
import {
  blessingOptions,
  demoTagFallback,
  fortuneSignsByOption,
  quickQuestions,
} from './data/fortuneSigns'

const bambooSticks = [
  { left: 18, top: 22, height: 84, tilt: -12, delay: 0 },
  { left: 27, top: 26, height: 78, tilt: -7, delay: 0.04 },
  { left: 36, top: 18, height: 88, tilt: -3, delay: 0.08 },
  { left: 45, top: 24, height: 82, tilt: 2, delay: 0.12 },
  { left: 54, top: 19, height: 90, tilt: 6, delay: 0.16 },
  { left: 63, top: 27, height: 76, tilt: 11, delay: 0.2 },
  { left: 72, top: 23, height: 86, tilt: -10, delay: 0.24 },
  { left: 22, top: 54, height: 78, tilt: 7, delay: 0.1 },
  { left: 34, top: 58, height: 72, tilt: -5, delay: 0.14 },
  { left: 46, top: 50, height: 88, tilt: 4, delay: 0.18 },
  { left: 58, top: 57, height: 74, tilt: -8, delay: 0.22 },
  { left: 70, top: 52, height: 84, tilt: 9, delay: 0.26 },
]

const isProduction = import.meta.env.PROD
const modelEndpoint = isProduction
  ? '/api/fortune'
  : import.meta.env.VITE_ORACLE_MODEL_URL?.trim() || ''
const modelKey = isProduction ? '' : import.meta.env.VITE_ORACLE_MODEL_KEY?.trim() || ''

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

async function requestOracleReply({ option, sign, question }) {
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
    }),
  })

  if (!response.ok) {
    throw new Error(`model-request-failed:${response.status}`)
  }

  const payload = await response.json()
  const reply = typeof payload?.reply === 'string' ? payload.reply.trim() : ''

  if (!reply) {
    throw new Error('empty-model-reply')
  }

  return reply
}

function App() {
  const tagProfile = useMemo(() => parseTagProfile(), [])
  const initialOption =
    blessingOptions.find((item) => item.id === tagProfile.blessingType) || blessingOptions[1]
  const touchStartY = useRef(null)
  const audioContextRef = useRef(null)

  const [screen, setScreen] = useState('landing')
  const [selectedOption, setSelectedOption] = useState(initialOption)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawnSign, setDrawnSign] = useState(null)
  const [currentSign, setCurrentSign] = useState(null)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [isAskingOracle, setIsAskingOracle] = useState(false)
  const [oracleError, setOracleError] = useState('')

  function handleEnterBlessing() {
    setScreen('home')
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
    const signPool = fortuneSignsByOption[optionId] || fortuneSignsByOption.career
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
    }, 820)

    window.setTimeout(() => {
      setCurrentSign(sign)
      setOracleError('')
      setMessages([{ role: 'ai', text: createIntroMessage(sign, selectedOption) }])
      setScreen('result')
    }, 1520)

    window.setTimeout(() => {
      setIsDrawing(false)
      setDrawnSign(null)
    }, 1520)
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
      const reply = await requestOracleReply({
        option: selectedOption,
        sign: currentSign,
        question: content,
      })

      setMessages((current) => [...current, { role: 'ai', text: reply }])
    } catch {
      setOracleError(createFallbackErrorMessage())
    } finally {
      setIsAskingOracle(false)
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
          <div className="phone-card">
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
                  src="/底图.jpg"
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
                        {bambooSticks.map((stick, index) => (
                          <span
                            key={`${index}-${stick.left}`}
                            className={`bamboo-stick ${isDrawing ? 'bamboo-stick-shake' : ''} ${
                              drawnSign && index === 2 ? 'bamboo-stick-fall' : ''
                            }`}
                            style={{
                              left: `${stick.left}%`,
                              top: `${stick.top}%`,
                              height: `${stick.height}px`,
                              '--stick-tilt': `${stick.tilt}deg`,
                              animationDelay: `${stick.delay}s`,
                            }}
                          />
                        ))}
                        <div className="bamboo-tube-label">求签</div>
                        <div className="bamboo-base-ring bamboo-base-ring-top" />
                        <div className="bamboo-base-ring bamboo-base-ring-bottom" />
                      </div>
                    </div>

                    {drawnSign && (
                      <div className="drawn-slip" aria-hidden="true">
                        <span>{drawnSign.label}</span>
                      </div>
                    )}
                  </div>
                </section>

                <div className="action-stack draw-action-stack">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleDrawSign}
                    disabled={isDrawing}
                  >
                    {isDrawing ? '竹筒摇签中...' : '诚心抽一签'}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
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
              <div className="screen">
                <section className="hero-block hero-block-compact">
                  <span className="hero-kicker">AI 解签</span>
                  <h2>
                    {currentSign.label} · {currentSign.level}
                  </h2>
                  <p>只有你主动提问时，问题才会发送给解签模型。</p>
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

                <div className="chat-log">
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
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
