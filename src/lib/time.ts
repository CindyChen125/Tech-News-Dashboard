import { useEffect, useState } from 'react'

export function timeAgo(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Whole calendar days between two dates, in the viewer's time zone. */
export const daysBetween = (earlier: Date, later: Date) => Math.round((startOfDay(later) - startOfDay(earlier)) / 86_400_000)

export function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso)
  const diff = daysBetween(d, now)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

/** Current time, re-rendered every minute so "5m ago" labels stay honest. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}
