import { useEffect, useRef, useState } from 'react'

export function useAutosave(project, repository, delay = 800) {
  const [status, setStatus] = useState('Gespeichert')
  const [error, setError] = useState('')
  const ready = useRef(false)
  useEffect(() => { ready.current = false; setStatus('Gespeichert'); const timer = window.setTimeout(() => { ready.current = true }, 0); return () => window.clearTimeout(timer) }, [project?.id])
  useEffect(() => {
    if (!project || !ready.current) return undefined
    setStatus('Änderungen'); setError('')
    const timer = window.setTimeout(async () => { setStatus('Speichert …'); try { await repository.save(project); setStatus('Gespeichert') } catch (cause) { setStatus('Speichern fehlgeschlagen'); setError(cause.message) } }, delay)
    return () => window.clearTimeout(timer)
  }, [project, repository, delay])
  useEffect(() => { const guard = event => { if (status === 'Änderungen' || status === 'Speichert …' || status === 'Speichern fehlgeschlagen') { event.preventDefault(); event.returnValue = '' } }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard) }, [status])
  return { status, error, dirty: status !== 'Gespeichert' }
}
