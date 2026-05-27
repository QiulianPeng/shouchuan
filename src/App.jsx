import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const blessingOptions = [
  {
    id: 'love',
    name: '姻缘',
    short: '缘',
    hint: '愿有良人，心意相通',
  },
  {
    id: 'career',
    name: '事业',
    short: '业',
    hint: '愿步步稳进，所行有成',
  },
  {
    id: 'wealth',
    name: '财运',
    short: '财',
    hint: '愿财路顺遂，收支有余',
  },
  {
    id: 'study',
    name: '学业',
    short: '学',
    hint: '愿心无旁骛，考运稳稳',
  },
]

const signs = [
  {
    id: 18,
    level: '小吉',
    poem: '云开月渐明，风静水初平。心中若有愿，缓行亦有成。',
    summary: '事情正在慢慢变清晰，不必急着求一个立刻的答案。',
    blessing: '愿你心有所定，路有所向。',
    advice: {
      love: '感情上适合真诚表达，但不必逼对方马上回应。温柔一点，关系会更容易靠近。',
      career: '事业上宜稳扎稳打，把手里的事做扎实，比频繁换方向更有利。',
      wealth: '财运宜守不宜冒进，适合整理账目、控制冲动消费。',
      study: '学习上适合复盘旧知识，先补短板，再谈突破。',
    },
  },
  {
    id: 7,
    level: '上吉',
    poem: '春风入旧门，花影照前尘。若问前程事，贵在一念真。',
    summary: '好运在靠近，但关键在于你是否真心面对自己的选择。',
    blessing: '愿你所念真诚，所遇皆暖。',
    advice: {
      love: '感情有转暖之象，适合主动释放善意，但不要用试探代替沟通。',
      career: '事业上有新机会出现，适合展示能力，也适合争取资源。',
      wealth: '财运有起色，但要分清机会和诱惑，别被短期收益冲昏头。',
      study: '学业状态回升，适合定一个清晰目标，坚持几天就能看到变化。',
    },
  },
  {
    id: 32,
    level: '中平',
    poem: '山路多回转，行人莫问迟。灯火三更后，方知月满时。',
    summary: '现在不是最快的时候，但每一步都在累积后劲。',
    blessing: '愿你慢慢走，也终能抵达。',
    advice: {
      love: '感情上不要急着定输赢，先看对方的实际行动，也看自己的真实感受。',
      career: '事业上会有反复，但不代表方向错了，适合耐心推进。',
      wealth: '财务上以稳为主，不适合高风险尝试。',
      study: '学习会经历瓶颈，换个方法或找人请教，会比硬扛更有效。',
    },
  },
]

const quickQuestions = [
  '这签是什么意思？',
  '我最近该主动一点吗？',
  '这件事适合现在决定吗？',
  '给我一句今日祝福',
]

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

const demoTagFallback = {
  tagId: 'mala-demo-001',
  series: '平安手串',
  temple: '静心祈福',
  blessingType: 'career',
}

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

function buildReply(question, sign, option) {
  const text = question.trim()
  const advice = sign.advice[option.id]

  if (text.includes('主动')) {
    return `${option.name}这件事可以主动一点，但主动不是催促。${advice}`
  }

  if (text.includes('决定')) {
    return `现在做决定之前，先看一眼自己最在意的结果。${sign.summary}${advice}`
  }

  if (text.includes('祝福')) {
    return `${sign.blessing}今天在「${option.name}」这件事上，记得先把自己安顿好。`
  }

  return `这支签更像是在提醒你：${sign.summary}${advice}不用急着求一个绝对答案，先做一件当下能推进的小事。${sign.blessing}`
}

async function readJson(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json()
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
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: '抽到签后，你可以继续问我这签是什么意思、最近该怎么做，或者想要一句今日祝福。',
    },
  ])
  const [apiMode, setApiMode] = useState('checking')
  const [visitId, setVisitId] = useState(null)

  useEffect(() => {
    setSelectedOption(initialOption)
  }, [initialOption])

  useEffect(() => {
    let cancelled = false

    async function bootstrapSession() {
      try {
        const health = await readJson('/api/health')
        if (cancelled) {
          return
        }

        setApiMode(health.ok ? 'live' : 'fallback')

        if (!health.ok) {
          return
        }

        const session = await readJson('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: tagProfile.isDemo ? 'demo-entry' : 'nfc-entry',
            userAgent: navigator.userAgent,
            tagProfile,
          }),
        })

        if (cancelled) {
          return
        }

        setVisitId(session.visitId || null)
      } catch {
        if (cancelled) {
          return
        }

        setApiMode('fallback')
      }
    }

    bootstrapSession()

    return () => {
      cancelled = true
    }
  }, [tagProfile])

  const currentAdvice = currentSign ? currentSign.advice[selectedOption.id] : ''

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

  async function handleDrawSign() {
    if (isDrawing) {
      return
    }

    setIsDrawing(true)
    setDrawnSign(null)
    playBambooRattle()

    try {
      let sign
      let drawMessage = ''

      if (apiMode === 'live') {
        const result = await readJson('/api/draw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitId,
            blessingType: selectedOption.id,
            tagProfile,
          }),
        })

        sign = result.sign
        drawMessage = result.message
      } else {
        sign = signs[Math.floor(Math.random() * signs.length)]
        drawMessage = `你今日抽到第 ${sign.id} 签，${sign.level}。${sign.summary}你可以继续问我，我会结合「${selectedOption.name}」方向为你解签。`
      }

      window.setTimeout(() => {
        setDrawnSign(sign)
      }, 820)

      window.setTimeout(() => {
        setCurrentSign(sign)
        setMessages([{ role: 'ai', text: drawMessage }])
        setScreen('result')
      }, 1520)
    } finally {
      window.setTimeout(() => {
        setIsDrawing(false)
        setDrawnSign(null)
      }, 1520)
    }
  }

  async function handleAsk(nextQuestion) {
    const content = (nextQuestion || question).trim()
    if (!content || !currentSign) {
      return
    }

    setMessages((current) => [...current, { role: 'user', text: content }])
    setQuestion('')

    try {
      if (apiMode === 'live') {
        const result = await readJson('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitId,
            tagProfile,
            blessingType: selectedOption.id,
            signId: currentSign.id,
            question: content,
          }),
        })

        setMessages((current) => [...current, { role: 'ai', text: result.reply }])
        return
      }
    } catch {
      setApiMode('fallback')
    }

    setMessages((current) => [
      ...current,
      { role: 'ai', text: buildReply(content, currentSign, selectedOption) },
    ])
  }

  function handleRestart() {
    setScreen('landing')
    setCurrentSign(null)
    setDrawnSign(null)
    setIsDrawing(false)
    setQuestion('')
    setMessages([
      {
        role: 'ai',
        text: '抽到签后，你可以继续问我这签是什么意思、最近该怎么做，或者想要一句今日祝福。',
      },
    ])
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
                  src="/prayer-landing-arrowless.png"
                  alt="今日祈福封面"
                />
                <div className="landing-scroll-icon" aria-hidden="true">
                  <svg className="landing-scroll-icon-svg" viewBox="0 0 24 30">
                    <path className="landing-scroll-chevron landing-scroll-chevron-1" d="M6 12 L12 6 L18 12" />
                    <path className="landing-scroll-chevron landing-scroll-chevron-2" d="M6 18 L12 12 L18 18" />
                    <path className="landing-scroll-chevron landing-scroll-chevron-3" d="M6 24 L12 18 L18 24" />
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
                        <span>第 {drawnSign.id} 签</span>
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
                    第 {currentSign.id} 签 · {currentSign.level}
                  </h2>
                  <p className="poem-block">{currentSign.poem}</p>
                </section>

                <section className="reading-card">
                  <span className="route-label">今日签意</span>
                  <p>{currentSign.summary}</p>
                  <div className="advice-card">{currentAdvice}</div>
                  <strong>{currentSign.blessing}</strong>
                </section>

                <div className="action-stack">
                  <button type="button" className="primary-button" onClick={() => setScreen('chat')}>
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
                    第 {currentSign.id} 签 · {currentSign.level}
                  </h2>
                  <p>你也可以继续追问这支签对今天的提醒。</p>
                </section>

                <div className="quick-question-row">
                  {quickQuestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="quick-question"
                      onClick={() => handleAsk(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

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
                </div>

                <div className="chat-composer">
                  <input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="问问这支签想提醒你什么..."
                  />
                  <button type="button" onClick={() => handleAsk()}>
                    发送
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
