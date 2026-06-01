'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useChild } from '../ProtectedLayoutClient'
import { Card, Button } from '@/components/ui'
import { ParentPinModal } from '@/components/parent/ParentPinModal'

interface ParentCardProps {
  title: string
  description: string
  icon: string
  href: string
  color: string
}

function ParentCard({ title, description, icon, href, color }: ParentCardProps) {
  return (
    <Link href={href}>
      <Card
        className="relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
      >
        <div className={`absolute top-0 left-0 right-0 h-2 ${color}`} />
        <div className="pt-6 pb-4 px-4 text-center">
          <div className="text-5xl mb-4">{icon}</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>
      </Card>
    </Link>
  )
}

export default function ParentPage() {
  const { selectedChild } = useChild()
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinModalMode, setPinModalMode] = useState<'setup' | 'change'>('setup')
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [removePinValue, setRemovePinValue] = useState(['', '', '', ''])
  const [removeError, setRemoveError] = useState('')
  const [removeLoading, setRemoveLoading] = useState(false)

  // Fetch PIN status
  useEffect(() => {
    async function fetchPinStatus() {
      try {
        const res = await fetch('/api/app-settings')
        if (res.ok) {
          const { settings } = await res.json()
          setHasPin(settings?.has_parent_pin ?? false)
        }
      } catch (error) {
        console.error('Error fetching PIN status:', error)
      }
    }
    fetchPinStatus()
  }, [])

  const handleSetupPin = () => {
    setPinModalMode('setup')
    setShowPinModal(true)
  }

  const handleChangePin = () => {
    setPinModalMode('change')
    setShowPinModal(true)
  }

  const handlePinSuccess = () => {
    setShowPinModal(false)
    setHasPin(true)
  }

  const handleRemovePin = async () => {
    const pinString = removePinValue.join('')
    if (pinString.length !== 4) {
      setRemoveError('Please enter your PIN')
      return
    }

    setRemoveLoading(true)
    setRemoveError('')

    try {
      const res = await fetch('/api/parent-pin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinString }),
      })

      if (res.ok) {
        setHasPin(false)
        setShowRemoveConfirm(false)
        setRemovePinValue(['', '', '', ''])
        // Clear session verification since PIN is removed
        sessionStorage.removeItem('storybloom-parent-verified')
      } else {
        const data = await res.json()
        setRemoveError(data.error || 'Failed to remove PIN')
      }
    } catch {
      setRemoveError('Something went wrong')
    } finally {
      setRemoveLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
          <span className="text-4xl">👨‍👩‍👧</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Parent Dashboard</h1>
        <p className="text-gray-600">
          Manage settings and track progress
          {selectedChild ? ` for ${selectedChild.name}` : ''}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <ParentCard
          title="Child Profiles"
          description="Add, edit, or remove child profiles"
          icon="👶"
          href="/parent/profiles"
          color="bg-blue-500"
        />
        <ParentCard
          title="Word List"
          description="View and manage struggling words that need practice"
          icon="📝"
          href="/parent/struggling-words"
          color="bg-amber-500"
        />
        <ParentCard
          title="Cash Rewards"
          description="Track earnings and mark rewards as paid"
          icon="💵"
          href="/parent/rewards"
          color="bg-green-500"
        />
        <ParentCard
          title="Scavenger Photos"
          description="Review scavenger hunt finds, approve or reject, and manage photos"
          icon="🔎"
          href="/parent/scavenger-finds"
          color="bg-emerald-500"
        />
      </div>

      {/* PIN Settings Section */}
      <Card className="p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Parent PIN Lock</h2>
            <p className="text-gray-600 text-sm mb-4">
              {hasPin
                ? 'PIN protection is enabled. A 4-digit PIN is required to access parent settings.'
                : 'Protect parent-only features with a 4-digit PIN so kids can\'t access settings.'}
            </p>

            {hasPin === null ? (
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            ) : hasPin ? (
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleChangePin}>
                  Change PIN
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRemoveConfirm(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Remove PIN
                </Button>
              </div>
            ) : (
              <Button onClick={handleSetupPin}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Set Up PIN
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">About Parent Features</h2>
        <div className="space-y-4 text-gray-600">
          <div className="flex gap-3">
            <span className="text-2xl">👶</span>
            <div>
              <h3 className="font-semibold text-gray-800">Child Profiles</h3>
              <p className="text-sm">
                Manage child profiles including name, age, reading level, interests, and physical
                characteristics for personalized story illustrations.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <h3 className="font-semibold text-gray-800">Word List</h3>
              <p className="text-sm">
                Words are automatically captured when your child struggles during Sentence Shenanigans.
                You can also add words manually for extra practice.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">💵</span>
            <div>
              <h3 className="font-semibold text-gray-800">Cash Rewards</h3>
              <p className="text-sm">
                Enable cash rewards to motivate learning! Set how much each mastered word is worth
                and track weekly earnings. Mark as paid when you give the reward.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* PIN Setup/Change Modal */}
      {showPinModal && (
        <ParentPinModal
          mode={pinModalMode}
          onSuccess={handlePinSuccess}
          onCancel={() => setShowPinModal(false)}
        />
      )}

      {/* Remove PIN Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="max-w-sm w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Remove PIN?</h2>
              <p className="text-gray-600 text-sm">
                This will remove PIN protection from parent settings. Enter your current PIN to confirm.
              </p>
            </div>

            <div className="flex gap-3 justify-center mb-4">
              {removePinValue.map((digit, index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '')
                    const newPin = [...removePinValue]
                    newPin[index] = val
                    setRemovePinValue(newPin)
                    setRemoveError('')
                    if (val && index < 3) {
                      const nextInput = e.target.nextElementSibling as HTMLInputElement
                      nextInput?.focus()
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !removePinValue[index] && index > 0) {
                      const prevInput = e.currentTarget.previousElementSibling as HTMLInputElement
                      prevInput?.focus()
                    }
                  }}
                  disabled={removeLoading}
                  className={`
                    w-12 h-14 text-center text-xl font-bold
                    border-2 rounded-lg
                    focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200
                    disabled:bg-gray-100
                    ${removeError ? 'border-red-400 bg-red-50' : 'border-gray-300'}
                  `}
                />
              ))}
            </div>

            {removeError && (
              <p className="text-red-500 text-sm text-center mb-4">{removeError}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRemoveConfirm(false)
                  setRemovePinValue(['', '', '', ''])
                  setRemoveError('')
                }}
                disabled={removeLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRemovePin}
                loading={removeLoading}
                className="flex-1 bg-red-500 hover:bg-red-600"
              >
                Remove PIN
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
