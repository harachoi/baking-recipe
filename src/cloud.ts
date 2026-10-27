import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { doc, getFirestore, initializeFirestore, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { getFirebaseApp, isFirebaseConfigured } from './firebase'

export type CloudStatus = 'local' | 'connecting' | 'live' | 'saving' | 'error'

export type CloudRoom = {
  recipes?: unknown
  staples?: unknown
  processes?: unknown
  pans?: unknown
}

const clientId = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`

const statusListeners = new Set<(status: CloudStatus) => void>()
const dataListeners = new Set<(room: CloudRoom) => void>()

let hydrated = false
let pending: CloudRoom = {}
let timer: number | null = null
let roomRef: ReturnType<typeof doc> | null = null

function emitStatus(status: CloudStatus) {
  for (const listener of statusListeners) listener(status)
}

function emitData(room: CloudRoom) {
  for (const listener of dataListeners) listener(room)
}

function asRecords(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is { id: string } & Record<string, unknown> => {
    return Boolean(item) && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'
  })
}

function mergeRecipes(local: unknown, remote: unknown) {
  const map = new Map<string, { id: string; updatedAt?: number }>()
  for (const recipe of asRecords(remote)) map.set(recipe.id, recipe)
  for (const recipe of asRecords(local)) {
    const previous = map.get(recipe.id)
    const nextAt = Number(recipe.updatedAt ?? 0)
    const prevAt = Number(previous?.updatedAt ?? 0)
    if (!previous || nextAt >= prevAt) map.set(recipe.id, recipe)
  }
  return [...map.values()].sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0))
}

function mergeById(local: unknown, remote: unknown) {
  const map = new Map<string, { id: string }>()
  for (const item of asRecords(remote)) map.set(item.id, item)
  for (const item of asRecords(local)) map.set(item.id, item)
  return [...map.values()]
}

function roomFrom(data: Record<string, unknown> | undefined): CloudRoom {
  if (!data) return {}
  return {
    recipes: Array.isArray(data.recipes) ? data.recipes : [],
    staples: Array.isArray(data.staples) ? data.staples : [],
    processes: Array.isArray(data.processes) ? data.processes : [],
    pans: Array.isArray(data.pans) ? data.pans : [],
  }
}

function mergeRooms(local: CloudRoom, remote: CloudRoom): CloudRoom {
  return {
    recipes: mergeRecipes(local.recipes, remote.recipes),
    staples: mergeById(local.staples, remote.staples),
    processes: mergeById(local.processes, remote.processes),
    pans: mergeById(local.pans, remote.pans),
  }
}

export function onCloudStatus(listener: (status: CloudStatus) => void) {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

export function onCloudData(listener: (room: CloudRoom) => void) {
  dataListeners.add(listener)
  return () => {
    dataListeners.delete(listener)
  }
}

export function queueCloud(patch: CloudRoom) {
  pending = { ...pending, ...patch }
  if (!hydrated || !roomRef) return
  if (timer != null) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    timer = null
    void flush()
  }, 400)
}

async function flush() {
  if (!roomRef || Object.keys(pending).length === 0) return
  const patch = pending
  pending = {}
  emitStatus('saving')
  try {
    await setDoc(
      roomRef,
      {
        kind: 'ferment-room',
        ...patch,
        updatedBy: clientId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    emitStatus('live')
  } catch (error) {
    console.error(error)
    pending = { ...patch, ...pending }
    emitStatus('error')
  }
}

function database(app: NonNullable<ReturnType<typeof getFirebaseApp>>): Firestore {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true })
  } catch {
    return getFirestore(app)
  }
}

export function startCloud(getLocal: () => CloudRoom) {
  const app = getFirebaseApp()
  if (!app || !isFirebaseConfigured()) {
    emitStatus('local')
    return () => {}
  }

  emitStatus('connecting')
  const auth = getAuth(app)
  roomRef = doc(database(app), 'workspaces', 'ferment-baking-room')
  let unsubscribe = () => {}
  let stopped = false

  const signedIn = new Promise<void>((resolve, reject) => {
    const stopAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return
      stopAuth()
      resolve()
    })
    signInAnonymously(auth).catch((error) => {
      stopAuth()
      reject(error)
    })
  })

  void signedIn
    .then(() => {
      if (stopped || !roomRef) return
      unsubscribe = onSnapshot(
        roomRef,
        (snap) => {
          const remote = roomFrom(snap.data())
          const own = snap.data()?.updatedBy === clientId
          if (!hydrated) {
            hydrated = true
            if (!snap.exists()) {
              pending = { ...getLocal(), ...pending }
            } else if (!own) {
              const merged = mergeRooms(getLocal(), remote)
              const next = { ...merged, ...pending }
              emitData(next)
              pending = JSON.stringify(next) === JSON.stringify(remote) ? {} : next
            }
            if (Object.keys(pending).length > 0) void flush()
            else emitStatus('live')
            return
          }
          if (own) return
          emitData(remote)
          emitStatus('live')
        },
        (error) => {
          console.error(error)
          hydrated = true
          emitStatus('error')
        },
      )
    })
    .catch((error) => {
      console.error(error)
      emitStatus('error')
    })

  return () => {
    stopped = true
    unsubscribe()
    if (timer != null) window.clearTimeout(timer)
  }
}
