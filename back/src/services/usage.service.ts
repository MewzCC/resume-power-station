import type { PrismaClient } from '@prisma/client'
import { env } from '../lib/env.js'
import { prisma } from '../lib/prisma.js'
import { getResetAt, getTodayKey } from '../lib/time.js'

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export type UsageIdentity = {
  userId: string
}

export class DailyLimitExceededError extends Error {
  constructor() {
    super('DAILY_LIMIT_EXCEEDED')
  }
}

async function getOrCreateUsage(client: TxClient, identity: UsageIdentity) {
  const date = getTodayKey()
  const limit = env.dailyOptimizeLimit

  const usage = await client.dailyUsage.findUnique({
    where: {
      userId_date: {
        userId: identity.userId,
        date,
      },
    },
  })

  if (usage) {
    if (usage.limitCount !== limit) {
      return client.dailyUsage.update({
        where: { id: usage.id },
        data: { limitCount: limit },
      })
    }
    return usage
  }

  try {
    return await client.dailyUsage.create({
      data: {
        userId: identity.userId,
        date,
        limitCount: limit,
      },
    })
  } catch (error) {
    if (isUniqueError(error)) {
      return client.dailyUsage.findUniqueOrThrow({
        where: {
          userId_date: {
            userId: identity.userId,
            date,
          },
        },
      })
    }
    throw error
  }
}

function isUniqueError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export async function getTodayUsage(identity: UsageIdentity) {
  const usage = await getOrCreateUsage(prisma, identity)
  const used = usage.usedCount
  const limit = usage.limitCount

  return {
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    resetAt: getResetAt(),
  }
}

export async function assertHasRemainingUsage(identity: UsageIdentity) {
  const usage = await getTodayUsage(identity)
  if (usage.remaining <= 0) {
    throw new DailyLimitExceededError()
  }
  return usage
}

export async function incrementUsage(identity: UsageIdentity) {
  const usage = await prisma.$transaction(async (tx: TxClient) => {
    const current = await getOrCreateUsage(tx, identity)

    if (current.usedCount >= current.limitCount) {
      throw new DailyLimitExceededError()
    }

    return tx.dailyUsage.update({
      where: { id: current.id },
      data: { usedCount: { increment: 1 } },
    })
  })

  return {
    limit: usage.limitCount,
    used: usage.usedCount,
    remaining: Math.max(usage.limitCount - usage.usedCount, 0),
    resetAt: getResetAt(),
  }
}
