export const SCENE_TIMER_SECONDS = 600

export function initialSceneTimer(sceneId) {
  return { sceneId, duration: SCENE_TIMER_SECONDS, remaining: SCENE_TIMER_SECONDS, status: 'ready', targetAt: null }
}

export function sceneTimerRemaining(timer, now = Date.now()) {
  if (timer.status !== 'running' || !timer.targetAt) return timer.remaining
  return Math.max(0, Math.ceil((timer.targetAt - now) / 1000))
}

export function updateSceneTimer(timer, action, now = Date.now()) {
  const visible = sceneTimerRemaining(timer, now)
  if (action === 'minus') { const duration = Math.max(60, timer.duration - 60); return { ...timer, duration, remaining: Math.min(visible, duration), status: 'ready', targetAt: null } }
  if (action === 'plus') { const duration = Math.min(3600, timer.duration + 60); return { ...timer, duration, remaining: Math.min(3600, visible + 60), status: 'ready', targetAt: null } }
  if (action === 'start' || action === 'resume') return visible > 0 ? { ...timer, remaining: visible, status: 'running', targetAt: now + visible * 1000 } : timer
  if (action === 'pause') return { ...timer, remaining: visible, status: visible ? 'paused' : 'expired', targetAt: null }
  if (action === 'reset') return { ...timer, remaining: timer.duration, status: 'ready', targetAt: null }
  if (action === 'tick' && visible === 0) return { ...timer, remaining: 0, status: 'expired', targetAt: null }
  return timer
}
