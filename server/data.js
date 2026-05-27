export const blessingOptions = [
  {
    id: 'love',
    name: '姻缘',
    short: '缘',
    hint: '愿有良人，心意相通',
    detail: '适合想确认关系、修复沟通、等待好消息的时候。',
  },
  {
    id: 'career',
    name: '事业',
    short: '业',
    hint: '愿步步稳进，所行有成',
    detail: '适合工作推进、合作谈判、职位成长与方向选择。',
  },
  {
    id: 'wealth',
    name: '财运',
    short: '财',
    hint: '愿财路顺遂，收支有余',
    detail: '适合理财节奏、收入机会、消费取舍与资金安排。',
  },
  {
    id: 'study',
    name: '学业',
    short: '学',
    hint: '愿心无旁骛，考运稳稳',
    detail: '适合备考、复盘、补短板和恢复专注力的时候。',
  },
]

export const signs = [
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

export const roadmapDefaults = [
  { id: 'source', title: '重建源码工程', note: '让页面从打包产物变成可维护项目', status: 'done' },
  { id: 'tap-link', title: '碰一碰打开祈福页', note: '先走最稳的 NFC 标签 URL 路线', status: 'done' },
  { id: 'tag-params', title: '识别标签参数', note: '按 tagId、系列、寺院或祝福类型分流', status: 'done' },
  { id: 'draw-api', title: '接抽签后端', note: '进入记录与抽签接口已接通', status: 'done' },
  { id: 'ai-api', title: '接 AI 解签', note: '当前先接规则式解签接口，后续可替换大模型', status: 'current' },
  { id: 'launch', title: '真机联调上线', note: '安卓、iPhone、NFC 标签和分享链路一起测', status: 'pending' },
]

export const quickQuestions = [
  '这签是什么意思？',
  '我最近该主动一点吗？',
  '这件事适合现在决定吗？',
  '给我一句今日祝福',
]

export const demoTagFallback = {
  tagId: 'mala-demo-001',
  series: '平安手串',
  temple: '静心祈福',
  blessingType: 'career',
}

export function buildReply(question, sign, option) {
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
