import type { Response } from 'express'
import { logger } from './logger'

type Client = {
  userId: number
  res: Response
}

// Map of userId -> Set of Response streams
const channels = new Map<number, Set<Response>>()

export function addClient(userId: number, res: Response) {
  if (!channels.has(userId)) channels.set(userId, new Set())
  channels.get(userId)!.add(res)
  logger.info('sse:connect', { userId, total: channels.get(userId)!.size })
}

export function removeClient(userId: number, res: Response) {
  const set = channels.get(userId)
  if (!set) return
  set.delete(res)
  if (set.size === 0) channels.delete(userId)
  logger.info('sse:disconnect', { userId, remaining: set.size })
}

export function broadcastToUsers(userIds: number[], event: string, data: any) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`
  const sentTo: number[] = []
  for (const uid of userIds) {
    const set = channels.get(uid)
    if (!set) continue
    for (const res of set) {
      try { res.write(payload); sentTo.push(uid) } catch (e) {
        // ignore write errors
      }
    }
  }
  if (sentTo.length) logger.info('sse:broadcast', { event, users: Array.from(new Set(sentTo)) })
}

export function heartbeat(userId: number) {
  const set = channels.get(userId)
  if (!set) return
  for (const res of set) {
    try { res.write(`: ping\n\n`) } catch {}
  }
}
