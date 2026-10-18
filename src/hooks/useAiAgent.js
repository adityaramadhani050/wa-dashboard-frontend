import { useEffect, useState } from 'react'
import { getAiSales } from './useApi'

// ID akun agent yang dikendalikan AI Sales (null bila tidak aktif). Dimuat sekali
// & dibagi ke semua komponen; dipakai untuk menandai chat milik AI.
let cached = undefined
let pending = null
const listeners = new Set()

export function refreshAiAgent() {
  pending = getAiSales()
    .then((d) => { cached = d?.enabled && d?.agent_id ? String(d.agent_id) : null })
    .catch(() => { cached = null })
    .finally(() => { pending = null; listeners.forEach((fn) => fn(cached)) })
  return pending
}

export function useAiAgentId() {
  const [id, setId] = useState(cached ?? null)
  useEffect(() => {
    listeners.add(setId)
    if (cached === undefined && !pending) refreshAiAgent()
    return () => listeners.delete(setId)
  }, [])
  return id
}
