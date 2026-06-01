'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useChild } from '../../ProtectedLayoutClient'
import { Button, Card } from '@/components/ui'
import type { ScavengerHuntFind } from '@/lib/types'

export default function ParentScavengerFindsPage() {
  const { children, selectedChild, selectChild } = useChild()
  const [finds, setFinds] = useState<ScavengerHuntFind[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const childId = selectedChild?.id || ''

  const loadFinds = useCallback(async () => {
    if (!childId) return
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/scavenger-hunt/finds?childId=${childId}&view=parent`
      )
      if (res.ok) {
        const { finds: data } = await res.json()
        setFinds(data || [])
      }
    } finally {
      setIsLoading(false)
    }
  }, [childId])

  useEffect(() => {
    loadFinds()
  }, [loadFinds])

  const override = async (findId: string, value: 'approved' | 'rejected') => {
    setBusyId(findId)
    try {
      const res = await fetch(`/api/scavenger-hunt/finds/${findId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ override: value }),
      })
      if (res.ok) {
        const { find } = await res.json()
        setFinds((prev) => prev.map((f) => (f.id === findId ? { ...f, ...find } : f)))
      }
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (findId: string) => {
    if (!confirm('Delete this photo? This cannot be undone.')) return
    setBusyId(findId)
    try {
      const res = await fetch(`/api/scavenger-hunt/finds/${findId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setFinds((prev) => prev.filter((f) => f.id !== findId))
      }
    } finally {
      setBusyId(null)
    }
  }

  if (!selectedChild) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">No Child Selected</h2>
          <p className="text-gray-600 mb-4">
            Please select a child from the dropdown in the header.
          </p>
          <Link href="/profile">
            <Button>Go to Profile</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scavenger Hunt Photos</h1>
          <p className="text-gray-600">
            Review {selectedChild.name}&apos;s finds. Flagged photos (faces / screens)
            are hidden from the kids&apos; gallery.
          </p>
        </div>
        <Link href="/parent/rewards">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {children.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {children.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={c.id === selectedChild.id ? 'primary' : 'outline'}
              onClick={() => selectChild(c)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" />
        </div>
      ) : finds.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-5xl mb-3">📷</div>
          <p className="text-gray-600">No scavenger hunt photos yet.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {finds.map((find) => (
            <Card key={find.id} className="overflow-hidden">
              <div className="relative aspect-video bg-gray-100">
                {find.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={find.photo_url}
                    alt={find.prompt_text}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    🖼️
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      find.is_match
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {find.is_match ? 'Match' : 'No match'}
                  </span>
                  {find.ai_flagged && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      ⚠ Flagged
                    </span>
                  )}
                  {find.parent_override && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {find.parent_override === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3">
                <p className="font-medium text-gray-800 mb-1">{find.prompt_text}</p>
                <p className="text-xs text-gray-500 mb-1">
                  {find.ai_reasoning || 'No reasoning recorded.'}
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Confidence:{' '}
                  {find.ai_confidence != null
                    ? `${Math.round(Number(find.ai_confidence) * 100)}%`
                    : 'n/a'}
                  {Number(find.cash_earned) > 0 &&
                    ` · Earned $${Number(find.cash_earned).toFixed(2)}`}
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={find.parent_override === 'approved' ? 'primary' : 'outline'}
                    className="flex-1"
                    disabled={busyId === find.id}
                    onClick={() => override(find.id, 'approved')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant={find.parent_override === 'rejected' ? 'primary' : 'outline'}
                    className="flex-1"
                    disabled={busyId === find.id}
                    onClick={() => override(find.id, 'rejected')}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    disabled={busyId === find.id}
                    onClick={() => remove(find.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
