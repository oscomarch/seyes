'use client'
import { useEffect, useState } from 'react'

type Notice = { id: number; message: string; tone: 'info' | 'error' }

export function Notices() {
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    let next = 0
    const onNotify = (event: Event) => {
      const { message, tone } = (event as CustomEvent<Omit<Notice, 'id'>>).detail
      const id = next++
      setNotices((all) => [...all.slice(-2), { id, message, tone }])
      setTimeout(() => setNotices((all) => all.filter((n) => n.id !== id)), tone === 'error' ? 6000 : 3200)
    }
    window.addEventListener('seyes:notify', onNotify)
    return () => window.removeEventListener('seyes:notify', onNotify)
  }, [])

  return (
    <div className="notices" role="status" aria-live="polite">
      {notices.map((notice) => (
        <div key={notice.id} className={`notice notice-${notice.tone}`}>
          {notice.message}
        </div>
      ))}
    </div>
  )
}
