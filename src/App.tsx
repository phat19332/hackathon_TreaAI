import { useEffect, useId, useRef, useState } from 'react'
import { Database, Focus, Package, ShieldAlert, Sparkles } from 'lucide-react'

const DEMO_MODE = true

const DEMO_SCENES = [
  {
    sceneId: 'intro',
    videoSrc: '/video/video_intro.mp4',
    objective: 'Investigate the damaged cyborg',
    aiMessage: 'AI-SYS: Đồng bộ tín hiệu hoàn tất. Phát hiện backdoor đến máy chủ Cyber-Corp.',
    sysMessage: 'HỆ THỐNG: Đang tải video phân tích (bản demo).',
    intel: [
      'Trace: Cyber-Corp uplink confirmed',
      'Entry vector: Neural chip slot (left occipital)',
      'Next action: Infiltrate Cyber-Corp server',
    ],
    newClue: { id: 'clue-3', name: 'Hidden Cyber Uplink' },
    nextSceneId: 'cyber_infiltration',
  },
  {
    sceneId: 'cyber_infiltration',
    videoSrc: '/video/video1.mp4',
    objective: 'Phá khoá mã hoá máy chủ Cyber-Corp',
    aiMessage: 'AI-SYS: Đã thâm nhập thành công. Phát hiện lõi mã hoá lượng tử. Cần giải mã.',
    sysMessage: 'HỆ THỐNG: Đang tải dữ liệu giải mã (bản demo).',
    intel: [
      'Server: Cyber-Corp Core Mainframe',
      'Encryption: Quantum-AES-512',
      'Next action: Decrypt the core key',
    ],
    newClue: { id: 'clue-4', name: 'Quantum Encryption Key' },
    nextSceneId: 'end',
  },
  {
    sceneId: 'end',
    videoSrc: '/video/video2.mp4',
    objective: 'Nhiệm vụ hoàn thành',
    aiMessage: 'AI-SYS: Nhiệm vụ hoàn tất. Cyber-Corp đã bị vô hiệu hoá. Báo cáo được gửi đến Sở.',
    sysMessage: 'HỆ THỐNG: Phiên điều tra khép lại.',
    intel: [
      'Status: MISSION COMPLETE',
      'Cyber-Corp: Neutralized',
      'Detective rating: S-Class',
    ],
    newClue: null,
    nextSceneId: 'end',
  },
] as const

function App() {
  const logId = useId()
  const logRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [screen, setScreen] = useState<'start' | 'intro_video' | 'game'>('start')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const loadingTimerRef = useRef<number | null>(null)

  const [sessionId, setSessionId] = useState(() => {
    try {
      return localStorage.getItem('cyber_session_id') ?? ''
    } catch {
      return ''
    }
  })

  const [chatLogs, setChatLogs] = useState<
    Array<{
      id: string
      role: 'system_warning' | 'system' | 'ai_success' | 'ai_fail' | 'user'
      text: string
      ephemeral?: boolean
    }>
  >([
    {
      id: `${logId}-sys-1`,
      role: 'system_warning',
      text: 'SYSTEM WARNING: UNAUTHORIZED ACCESS DETECTED',
    },
    {
      id: `${logId}-ai-1`,
      role: 'ai_success',
      text: 'AI-SYS: Awaiting your command, Detective.',
    },
  ])

  const [demoSceneIdx, setDemoSceneIdx] = useState(0)
  const [objective, setObjective] = useState('Investigate the damaged cyborg')
  const [videoSrc, setVideoSrc] = useState('/video/video_intro.mp4')
  const [intel, setIntel] = useState<string[]>([
    'Signal: CY-19 / Sector 7',
    'Subject: Damaged cyborg / Unknown origin',
    'Status: Awaiting user inference',
  ])
  const [clues, setClues] = useState<Array<{ id: string; name: string }>>([
    { id: 'clue-1', name: 'Broken Chip' },
    { id: 'clue-2', name: 'Corrupted Data' },
  ])

  // Auto-scroll chat
  useEffect(() => {
    if (screen !== 'game') return
    const el = logRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [chatLogs.length, screen])

  // Focus input when entering game
  useEffect(() => {
    if (screen !== 'game') return
    const id = window.setTimeout(() => { inputRef.current?.focus() }, 0)
    return () => window.clearTimeout(id)
  }, [screen])

  // Health check (non-demo only)
  useEffect(() => {
    if (screen !== 'game') return
    let cancelled = false
    if (DEMO_MODE) return
    fetch('/api/health')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .catch(() => {
        if (cancelled) return
        setChatLogs((prev) => [
          ...prev,
          {
            id: `${logId}-sys-backend-${Date.now()}`,
            role: 'system_warning',
            text: 'SYSTEM WARNING: BACKEND OFFLINE. Run `npm run server`.',
          },
        ])
      })
    return () => { cancelled = true }
  }, [logId, screen])

  // Persist session
  useEffect(() => {
    if (!sessionId) return
    try { localStorage.setItem('cyber_session_id', sessionId) } catch { /* ignore */ }
  }, [sessionId])

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) window.clearTimeout(loadingTimerRef.current)
    }
  }, [])

  async function turn(userInput: string) {
    const res = await fetch('/api/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_input: userInput, session_id: sessionId || undefined }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as {
      status?: string
      message?: string
      unlock_next?: boolean
      session_id?: string
      objective?: string
      video_url?: string
    }
    return {
      message: String(data.message ?? ''),
      unlockNext: Boolean(data.unlock_next),
      sessionId: String(data.session_id ?? ''),
      objective: typeof data.objective === 'string' ? data.objective : null,
      videoUrl: typeof data.video_url === 'string' ? data.video_url : null,
    }
  }

  async function submitCommand() {
    if (busy) return
    const value = input.trim()
    if (!value) return

    const pendingId = `${logId}-pending-${Date.now()}`

    setChatLogs((prev) => [
      ...prev,
      { id: `${logId}-user-${prev.length + 1}`, role: 'user', text: `> ${value}` },
      { id: pendingId, role: 'system', text: 'HỆ THỐNG: Đang kết nối PixVerse Server...', ephemeral: true },
    ])
    setInput('')
    setBusy(true)
    setLoading(true)

    try {
      if (DEMO_MODE) {
        if (loadingTimerRef.current) window.clearTimeout(loadingTimerRef.current)
        loadingTimerRef.current = window.setTimeout(() => {
          setDemoSceneIdx((prevIdx) => {
            const currentScene = DEMO_SCENES[prevIdx]
            const nextIdx = Math.min(prevIdx + 1, DEMO_SCENES.length - 1)
            const nextScene = DEMO_SCENES[nextIdx]

            setChatLogs((prev) => {
              const withoutPending = prev.filter((m) => m.id !== pendingId)
              return [
                ...withoutPending,
                { id: `${logId}-ai-${withoutPending.length + 1}`, role: 'ai_success', text: currentScene.aiMessage },
                { id: `${logId}-sys-${withoutPending.length + 2}`, role: 'system', text: currentScene.sysMessage },
              ]
            })

            setObjective(nextScene.objective)
            setVideoSrc(nextScene.videoSrc)
            setIntel([...nextScene.intel])

            if (currentScene.newClue) {
              const newClue = currentScene.newClue
              setClues((prev) => {
                if (prev.some((c) => c.id === newClue.id)) return prev
                return [...prev, { id: newClue.id, name: newClue.name }]
              })
            }

            return nextIdx
          })

          setLoading(false)
          setBusy(false)
          inputRef.current?.focus()
        }, 5000)
        return
      }

      const { message, unlockNext, sessionId: sid, objective: nextObjective, videoUrl } = await turn(value)
      if (sid) setSessionId(sid)

      setChatLogs((prev) => {
        const withoutPending = prev.filter((m) => m.id !== pendingId)
        return [
          ...withoutPending,
          { id: `${logId}-ai-${withoutPending.length + 1}`, role: unlockNext ? 'ai_success' : 'ai_fail', text: message },
        ]
      })

      if (unlockNext && nextObjective) setObjective(nextObjective)
      if (unlockNext && videoUrl) setVideoSrc(videoUrl)
    } catch (err) {
      const message = err instanceof Error
        ? 'AI-SYS: Lỗi kết nối máy chủ. Hãy chạy `npm run server` và thử lại.'
        : 'AI-SYS: Lỗi kết nối máy chủ.'
      setChatLogs((prev) => {
        const withoutPending = prev.filter((m) => m.id !== pendingId)
        return [
          ...withoutPending,
          { id: `${logId}-ai-${withoutPending.length + 1}`, role: 'ai_fail', text: message },
        ]
      })
    } finally {
      if (!DEMO_MODE) {
        setBusy(false)
        setLoading(false)
      }
    }
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-y-auto bg-[#0D0D0D] font-mono text-zinc-200 lg:overflow-hidden">

      {/* ── Layer 0: Background image ── */}
      <div className="pointer-events-none absolute inset-0 bg-[url('/background.png')] bg-cover bg-center opacity-40" />

      {/* ── Layer 1: Colour tint ── */}
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(1200px_700px_at_30%_10%,rgba(0,255,204,0.10),transparent_60%),radial-gradient(900px_600px_at_75%_85%,rgba(255,0,60,0.08),transparent_62%)]" />

      {/* ── Layer 2: Page content (z-10) ── */}
      <div className="relative z-10 h-full w-full">
        <div className="mx-auto h-full w-full max-w-[1480px] p-4">

          {/* ══ START SCREEN ══ */}
          {screen === 'start' ? (
            <div className="flex h-full items-center justify-center">
              <div className="w-full max-w-2xl rounded-md border border-[#00FFCC]/40 bg-black/50 p-6 shadow-[0_0_0_1px_rgba(0,255,204,0.25),0_0_28px_rgba(0,255,204,0.10)] backdrop-blur-md">
                <div className="flex items-center gap-3 text-[#00FFCC] text-glow-cyan">
                  <Sparkles className="h-5 w-5" />
                  <div className="text-sm tracking-[0.22em] font-bold">Cyber Detective VN</div>
                </div>

                <div className="mt-4 text-3xl tracking-tight text-zinc-100 font-bold">Dark Police Terminal</div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Xem video manh mối → suy luận → nhập lệnh vào Terminal để mở khóa cảnh tiếp theo.
                  Bản demo: nhập lệnh → loading 5 giây → chuyển sang video và thông tin có sẵn.
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setScreen('intro_video')}
                    className="inline-flex items-center justify-center rounded-sm border border-[#00FFCC]/60 bg-[#00FFCC]/10 px-5 py-3 text-sm tracking-[0.18em] text-[#00FFCC] text-glow-cyan transition-colors hover:bg-[#00FFCC]/20"
                  >
                    PLAY
                  </button>
                  <div className="text-xs text-zinc-400">
                    Tip: chạy backend trước: <span className="text-zinc-200">npm run server</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-sm border border-[#FF003C]/25 bg-black/25 p-3 backdrop-blur">
                    <div className="text-xs tracking-[0.22em] text-[#FF003C] text-glow-red">CASEFILE</div>
                    <div className="mt-1 text-sm text-zinc-200">CY-19 | Unauthorized Access</div>
                  </div>
                  <div className="rounded-sm border border-[#00FFCC]/25 bg-black/25 p-3 backdrop-blur">
                    <div className="text-xs tracking-[0.22em] text-[#00FFCC]">STATUS</div>
                    <div className="mt-1 text-sm text-zinc-200">DEMO MODE | Ready</div>
                  </div>
                </div>
              </div>
            </div>

          ) : screen === 'intro_video' ? (
            /* ══ INTRO VIDEO SCREEN ══ */
            <div className="absolute inset-0 z-50 flex h-full w-full items-center justify-center bg-black">
              <video
                className="h-full w-full object-contain"
                src="/video/video_intro.mp4"
                autoPlay
                playsInline
                onEnded={() => setScreen('game')}
              />
              <button
                type="button"
                onClick={() => setScreen('game')}
                className="absolute bottom-8 right-8 rounded-sm border border-[#00FFCC]/60 bg-black/60 px-5 py-3 text-sm tracking-[0.18em] text-[#00FFCC] text-glow-cyan backdrop-blur-sm transition-colors hover:bg-[#00FFCC]/20"
              >
                SKIP INTRO &gt;&gt;
              </button>
            </div>

          ) : (
            /* ══ GAME SCREEN ══ */
            <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">

              {/* ── Left column: Video + Terminal ── */}
              <div className="flex min-h-0 flex-1 flex-col gap-4">

                {/* Video panel */}
                <section className="shrink-0 rounded-md border border-[#00FFCC]/60 bg-black/40 p-3 shadow-[0_0_0_1px_rgba(0,255,204,0.25),0_0_28px_rgba(0,255,204,0.08)] backdrop-blur-sm lg:max-h-[56vh]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs tracking-[0.22em] text-[#00FFCC] text-glow-cyan">
                      <Sparkles className="h-4 w-4" />
                      VISUAL FEED
                    </div>
                    <button
                      type="button"
                      onClick={() => setScreen('start')}
                      className="rounded-sm border border-[#00FFCC]/30 bg-[#00FFCC]/10 px-3 py-1 text-xs text-[#00FFCC] transition-colors hover:bg-[#00FFCC]/20"
                    >
                      MENU
                    </button>
                  </div>

                  <div className="mt-3 w-full">
                    <div className="aspect-video w-full overflow-hidden rounded-sm border border-[#00FFCC]/40 bg-black">
                      <video
                        key={videoSrc}
                        className="h-full w-full object-contain"
                        src={videoSrc}
                        poster="/background.png"
                        autoPlay
                        loop
                        playsInline
                        controls
                      />
                    </div>
                  </div>
                </section>

                {/* Terminal / Chat panel */}
                <section className="flex min-h-[200px] flex-1 flex-col rounded-md border border-[#00FFCC]/55 bg-black/40 shadow-[0_0_0_1px_rgba(0,255,204,0.20),0_0_28px_rgba(0,255,204,0.06)] backdrop-blur-sm">
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#00FFCC]/25 bg-black/30 px-4 py-2">
                    <div className="text-xs tracking-[0.22em] text-[#00FFCC] text-glow-cyan">TERMINAL | CHAT</div>
                    <div className="text-xs text-zinc-500">{busy ? 'Working…' : 'Ready'}</div>
                  </div>

                  <div ref={logRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    <div className="space-y-2 text-sm leading-relaxed">
                      {chatLogs.map((entry) => (
                        <div
                          key={entry.id}
                          className={`animate-fade-in-up ${
                            entry.role === 'system_warning'
                              ? 'font-bold text-[#FF003C] text-glow-red'
                              : entry.role === 'system'
                                ? 'text-amber-300'
                                : entry.role === 'ai_success'
                                  ? 'text-emerald-400'
                                  : entry.role === 'ai_fail'
                                    ? 'text-[#FF003C] text-glow-red'
                                    : 'text-zinc-100'
                          }`}
                        >
                          {entry.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-[#00FFCC]/20 bg-black/30 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="select-none animate-pulse text-[#00FFCC] text-glow-cyan">{'>'}</span>
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void submitCommand() }}
                        disabled={busy}
                        className="flex-1 bg-transparent text-[#00FFCC] outline-none placeholder:text-[#00FFCC]/40 caret-[#00FFCC] disabled:opacity-60"
                        placeholder="Type a command…"
                        spellCheck={false}
                        autoComplete="off"
                        aria-label="Terminal command input"
                      />
                    </div>
                  </div>
                </section>
              </div>

              {/* ── Right sidebar ── */}
              <aside className="min-h-0 w-full lg:w-[360px]">
                <div className="flex h-full w-full flex-col gap-4 overflow-hidden rounded-md border border-[#FF003C]/70 bg-black/40 p-4 shadow-[0_0_0_1px_rgba(255,0,60,0.25),0_0_28px_rgba(255,0,60,0.08)] backdrop-blur-sm">

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold tracking-[0.18em] text-[#FF003C] text-glow-red">
                        Cyber Terminal | Active Session
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">Casefile: CY-19 | Access: Restricted</div>
                    </div>
                    <div className="inline-flex animate-pulse items-center gap-2 rounded-sm border border-[#FF003C]/40 bg-[#FF003C]/10 px-2 py-1 text-xs text-[#FF003C] text-glow-red">
                      <ShieldAlert className="h-4 w-4" />
                      LIVE
                    </div>
                  </div>

                  <div className="h-px w-full bg-gradient-to-r from-transparent via-[#FF003C]/40 to-transparent" />

                  {/* Objective */}
                  <section className="space-y-2">
                    <div className="flex items-center gap-2 text-xs tracking-[0.22em] text-zinc-300">
                      <Focus className="h-4 w-4 text-[#FF003C]" />
                      CURRENT OBJECTIVE
                    </div>
                    <div className="rounded-sm border border-[#FF003C]/25 bg-black/25 px-3 py-2 text-sm text-zinc-200 backdrop-blur">
                      {objective}
                    </div>
                  </section>

                  {/* Clues */}
                  <section className="min-h-0 space-y-2">
                    <div className="flex items-center gap-2 text-xs tracking-[0.22em] text-zinc-300">
                      <Database className="h-4 w-4 text-[#FF003C]" />
                      CLUES DATABASE
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-[#FF003C]/25 bg-black/20 backdrop-blur">
                      <ul className="divide-y divide-[#FF003C]/15">
                        {clues.map((clue) => (
                          <li key={clue.id} className="flex items-center gap-3 px-3 py-2">
                            <Database className="h-4 w-4 text-[#FF003C]" />
                            <span className="text-sm">{clue.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>

                  {/* Intel */}
                  <section className="space-y-2">
                    <div className="text-xs tracking-[0.22em] text-[#FF003C]">INTEL FEED</div>
                    <div className="rounded-sm border border-[#FF003C]/25 bg-black/20 p-3 text-xs leading-relaxed text-zinc-300 backdrop-blur">
                      {intel.map((line, idx) => (
                        <div key={`${idx}-${line}`}>{line}</div>
                      ))}
                    </div>
                  </section>

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between rounded-sm border border-[#FF003C]/25 bg-black/20 px-3 py-2 text-xs text-zinc-400 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-[#FF003C]" />
                      Inventory Sync
                    </div>
                    <span className="text-[#FF003C]">OK</span>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>

      {/* ── Layer 3: CRT scanlines (z-20, pointer-events-none) ── */}
      <div
        className="pointer-events-none absolute inset-0 z-20 opacity-25"
        style={{
          background: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.3) 50%), linear-gradient(90deg,rgba(255,0,0,0.05),rgba(0,255,0,0.01),rgba(0,0,255,0.05))',
          backgroundSize: '100% 3px, 4px 100%',
        }}
      />

      {/* ── Layer 4: Loading overlay (z-50) ── */}
      {screen === 'game' && loading ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-md border border-[#00FFCC]/50 bg-black/60 p-6 text-center shadow-[0_0_0_1px_rgba(0,255,204,0.25),0_0_28px_rgba(0,255,204,0.15)] backdrop-blur-md">
            <div className="text-sm tracking-[0.22em] text-[#00FFCC] text-glow-cyan">
              CONNECTING TO PIXVERSE…
            </div>
            <div className="mt-3 text-xs text-zinc-400">
              Đang đồng bộ tín hiệu video. Vui lòng chờ...
            </div>
            <div className="relative mt-6 h-1.5 w-full overflow-hidden rounded-full bg-black/50 border border-[#00FFCC]/30">
              <div className="animate-loading-sweep absolute top-0 left-0 h-full w-1/3 rounded-full bg-[#00FFCC]/70" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
