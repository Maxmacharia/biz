import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export function useDashboardWebSocket() {
  const { accessToken, user } = useAuthStore()
  const qc = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!accessToken || !user?.business_id) return

    const connect = () => {
      const ws = new WebSocket(
        `${WS_URL}/ws/dashboard/${user.business_id}?token=${accessToken}`
      )

      ws.onopen = () => {
        setConnected(true)
        console.log('[WS] Dashboard connected')
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          switch (msg.type) {
            case 'new_sale':
              qc.invalidateQueries({ queryKey: ['dashboard'] })
              qc.invalidateQueries({ queryKey: ['receipts'] })
              qc.invalidateQueries({ queryKey: ['products'] })
              break
            case 'low_stock_alert':
              toast(`⚠️ Low stock: ${msg.data?.name}`, { icon: '📦', duration: 6000 })
              qc.invalidateQueries({ queryKey: ['products'] })
              break
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }))
              break
          }
        } catch {}
      }

      ws.onclose = () => {
        setConnected(false)
        console.log('[WS] Disconnected, reconnecting in 5s...')
        reconnectTimeout.current = setTimeout(connect, 5000)
      }

      ws.onerror = () => {
        ws.close()
      }

      wsRef.current = ws
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout.current)
      wsRef.current?.close()
    }
  }, [accessToken, user?.business_id])

  return { connected }
}
