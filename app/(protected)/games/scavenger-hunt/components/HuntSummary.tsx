'use client'

import Link from 'next/link'
import { Button, Card } from '@/components/ui'
import type { HuntSummary as HuntSummaryData } from '@/lib/hooks/useScavengerHunt'

interface HuntSummaryProps {
  summary: HuntSummaryData | null
  onPlayAgain: () => void
  onExit: () => void
}

export function HuntSummary({ summary, onPlayAgain, onExit }: HuntSummaryProps) {
  const found = summary?.promptsFound ?? 0
  const total = summary?.promptsTotal ?? 0
  const findCash = summary?.findCash ?? 0
  const bonus = summary?.completionBonus ?? 0
  const totalCash = summary?.totalCash ?? 0

  return (
    <Card className="max-w-md mx-auto p-8 text-center bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="text-6xl mb-4">🏆</div>
      <h2 className="text-3xl font-extrabold text-purple-800 mb-2">Hunt Complete!</h2>
      <p className="text-gray-600 mb-6">
        You found <strong>{found}</strong> of <strong>{total}</strong> things!
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-white/70 rounded-xl">
          <div className="text-3xl font-bold text-purple-600">{found}</div>
          <div className="text-sm text-purple-700">Finds</div>
        </div>
        <div className="p-4 bg-white/70 rounded-xl">
          <div className="text-3xl font-bold text-green-600">
            ${totalCash.toFixed(2)}
          </div>
          <div className="text-sm text-green-700">Earned</div>
        </div>
      </div>

      {totalCash > 0 && (
        <div className="text-sm text-gray-600 mb-6 space-y-1">
          <div className="flex justify-between">
            <span>Find rewards</span>
            <span className="font-medium">${findCash.toFixed(2)}</span>
          </div>
          {bonus > 0 && (
            <div className="flex justify-between">
              <span>Finish bonus 🎁</span>
              <span className="font-medium">${bonus.toFixed(2)}</span>
            </div>
          )}
          {summary?.weeklyCapReached && (
            <p className="text-xs text-gray-400 pt-1">
              You reached this week&apos;s reward cap.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <Button className="w-full py-3 text-lg" onClick={onPlayAgain}>
          Hunt Again!
        </Button>
        <Link href="/games/scavenger-hunt/finds" className="block">
          <Button variant="outline" className="w-full">
            See My Finds 📷
          </Button>
        </Link>
        <Button variant="ghost" className="w-full" onClick={onExit}>
          Done
        </Button>
      </div>
    </Card>
  )
}
