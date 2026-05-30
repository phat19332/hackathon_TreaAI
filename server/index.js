import cors from 'cors'
import express from 'express'
import crypto from 'node:crypto'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const story = {
  startSceneId: 'intro',
  scenes: {
    intro: {
      sceneId: 'intro',
      video: '/video/video1.mp4',
      objective: 'Investigate the damaged cyborg',
      allowedNextScenes: ['cyber_infiltration'],
      keywords: ['chip', 'gáy', 'khe cắm', 'rút', 'cyber'],
      successMessage:
        'AI-SYS: Manh mối hợp lệ. Đang chuyển cảnh phân tích...',
      failMessage:
        'AI-SYS: Phân tích thất bại. Không tìm thấy liên kết. Hãy kiểm tra kỹ phần đầu của cyborg.',
    },
    cyber_infiltration: {
      sceneId: 'cyber_infiltration',
      video: '/video/video2.mp4',
      objective: 'Thâm nhập máy chủ Cyber-Corp',
      allowedNextScenes: [],
      keywords: [],
      successMessage: 'AI-SYS: Kết nối ổn định. Chờ lệnh tiếp theo.',
      failMessage: 'AI-SYS: Không có hành động hợp lệ trong cảnh này.',
    },
  },
}

const sessions = new Map()

function getOrCreateSession(sessionId) {
  const existingId = typeof sessionId === 'string' && sessionId ? sessionId : null
  if (existingId && sessions.has(existingId)) return sessions.get(existingId)

  const id = crypto.randomUUID()
  const session = {
    sessionId: id,
    currentSceneId: story.startSceneId,
    factsKnown: [],
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  sessions.set(id, session)
  return session
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms)
  })
}

async function callTraeAI({ userInput, scene }) {
  const normalized = String(userInput ?? '').toLowerCase()
  const matched = (scene.keywords ?? []).some((k) => normalized.includes(k))
  const nextSceneId = matched ? (scene.allowedNextScenes?.[0] ?? null) : null

  return {
    unlockNext: Boolean(matched && nextSceneId),
    nextSceneId,
    message: matched ? scene.successMessage : scene.failMessage,
  }
}

// evaluateTurn removed — logic consolidated into callTraeAI

app.post('/api/turn', async (req, res) => {
  try {
    const userInput =
      req.body && typeof req.body.user_input !== 'undefined'
        ? String(req.body.user_input)
        : ''
    const sessionId =
      req.body && typeof req.body.session_id === 'string' ? req.body.session_id : null
    const session = getOrCreateSession(sessionId)

    const scene = story.scenes[session.currentSceneId]
    if (!scene) {
      session.currentSceneId = story.startSceneId
      session.updatedAt = Date.now()
      res.json({
        status: 'failed',
        message: 'AI-SYS: Trạng thái cảnh không hợp lệ. Đã khôi phục phiên.',
        unlock_next: false,
        session_id: session.sessionId,
        current_scene_id: session.currentSceneId,
        objective:
          story.scenes[session.currentSceneId] && story.scenes[session.currentSceneId].objective
            ? story.scenes[session.currentSceneId].objective
            : null,
        video_src:
          story.scenes[session.currentSceneId] && story.scenes[session.currentSceneId].video
            ? story.scenes[session.currentSceneId].video
            : null,
      })
      return
    }

    const result = await callTraeAI({ userInput, scene })
    session.history.push({
      at: Date.now(),
      sceneId: session.currentSceneId,
      userInput,
      unlockNext: result.unlockNext,
      nextSceneId: result.nextSceneId,
    })
    session.updatedAt = Date.now()

    if (!result.unlockNext) {
      res.json({
        status: 'failed',
        message: result.message,
        unlock_next: false,
        session_id: session.sessionId,
        current_scene_id: session.currentSceneId,
        objective: scene.objective,
        video_src: scene.video,
      })
      return
    }

    const nextScene = story.scenes[result.nextSceneId]
    if (!nextScene) {
      res.json({
        status: 'failed',
        message: 'AI-SYS: Scene tiếp theo không tồn tại trong story graph.',
        unlock_next: false,
        session_id: session.sessionId,
        current_scene_id: session.currentSceneId,
        objective: scene.objective,
        video_src: scene.video,
      })
      return
    }

    session.currentSceneId = nextScene.sceneId
    session.updatedAt = Date.now()

    await sleep(3000)
    if (res.writableEnded) return

    res.json({
      status: 'success',
      message: result.message,
      unlock_next: true,
      session_id: session.sessionId,
      next_scene_id: nextScene.sceneId,
      objective: nextScene.objective,
      video_url: nextScene.video,
    })
  } catch {
    if (res.writableEnded) return
    res.status(500).json({
      status: 'failed',
      message: 'AI-SYS: Lỗi server nội bộ.',
      unlock_next: false,
    })
  }
})

app.post('/api/investigate', (req, res) => {
  const userInput =
    req.body && typeof req.body.user_input !== 'undefined' ? String(req.body.user_input) : ''
  const normalized = userInput.toLowerCase()
  const keywords = story.scenes.intro.keywords
  const matched = keywords.some((k) => normalized.includes(k))

  if (matched) {
    return res.json({
      status: 'SUCCESS',
      message: story.scenes.intro.successMessage,
      unlock_next: true,
      video_url: story.scenes.tdt_infiltration.video,
    })
  }

  return res.json({
    status: 'FAILED',
    message: story.scenes.intro.failMessage,
    unlock_next: false,
  })
})

const port = Number(process.env.PORT) || 5000
app.listen(port, () => {
  console.log(`Game Master API listening on http://localhost:${port}`)
})
