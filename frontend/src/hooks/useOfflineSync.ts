import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'

const DB_NAME = 'bizcore_offline'
const STORE_NAME = 'queue'
const DB_VERSION = 1

interface QueuedRequest {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body: string
  timestamp: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function queueRequest(item: QueuedRequest): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getAllQueued(): Promise<QueuedRequest[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function deleteQueued(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function flushQueue(token: string): Promise<{ success: number; failed: number }> {
  const queue = await getAllQueued()
  let success = 0
  let failed = 0

  for (const item of queue.sort((a, b) => a.timestamp - b.timestamp)) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { ...item.headers, Authorization: `Bearer ${token}` },
        body: item.body || undefined,
      })
      if (res.ok) {
        await deleteQueued(item.id)
        success++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { success, failed }
}

export function useOfflineSync() {
  const { accessToken } = useAuthStore()
  const isOnline = useRef(navigator.onLine)

  useEffect(() => {
    const handleOnline = async () => {
      if (!accessToken) return
      isOnline.current = true
      const { success, failed } = await flushQueue(accessToken)
      if (success > 0) {
        console.log(`[OfflineSync] Synced ${success} queued requests`)
        // Invalidate queries to refetch fresh data
        window.dispatchEvent(new CustomEvent('offline-sync-complete', { detail: { success, failed } }))
      }
    }

    const handleOffline = () => { isOnline.current = false }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for service worker messages
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'QUEUE_REQUEST') {
        queueRequest(event.data.payload)
      }
      if (event.data?.type === 'FLUSH_OFFLINE_QUEUE') {
        if (accessToken) flushQueue(accessToken)
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    // Attempt sync on load if online
    if (navigator.onLine && accessToken) handleOnline()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [accessToken])

  return { isOnline: isOnline.current }
}
