'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ParentPinModal } from './ParentPinModal'
import { Card, Button } from '@/components/ui'

const SESSION_STORAGE_KEY = 'storybloom-parent-verified'

interface ParentPinGateProps {
  children: React.ReactNode
}

export function ParentPinGate({ children }: ParentPinGateProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasPin, setHasPin] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const [sendingReset, setSendingReset] = useState(false)

  // Check if already verified this session
  useEffect(() => {
    const verified = sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true'
    setIsVerified(verified)
  }, [])

  // Fetch settings to check if PIN is set
  useEffect(() => {
    async function checkPinStatus() {
      try {
        const res = await fetch('/api/app-settings')
        if (res.ok) {
          const { settings } = await res.json()
          setHasPin(settings?.has_parent_pin ?? false)
        }
      } catch (error) {
        console.error('Error checking PIN status:', error)
      } finally {
        setLoading(false)
      }
    }

    checkPinStatus()
  }, [])

  const handleVerifySuccess = useCallback(() => {
    markPinVerified()
    setIsVerified(true)
  }, [])

  const handleForgotPin = useCallback(() => {
    setShowResetConfirm(true)
  }, [])

  const handleSendResetEmail = async () => {
    setSendingReset(true)
    setResetError('')

    try {
      const res = await fetch('/api/parent-pin/reset', {
        method: 'POST',
      })

      if (res.ok) {
        setResetEmailSent(true)
      } else {
        const data = await res.json()
        setResetError(data.error || 'Failed to send reset email')
      }
    } catch {
      setResetError('Something went wrong')
    } finally {
      setSendingReset(false)
    }
  }

  const handleCancelReset = () => {
    setShowResetConfirm(false)
    setResetEmailSent(false)
    setResetError('')
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // No PIN set - allow access
  if (!hasPin) {
    return <>{children}</>
  }

  // PIN set and verified - allow access
  if (isVerified) {
    return <>{children}</>
  }

  // Show reset confirmation/email sent modal
  if (showResetConfirm) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <Card className="max-w-sm w-full p-6">
          {resetEmailSent ? (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Check Your Email</h2>
                <p className="text-gray-600 text-sm">
                  We&apos;ve sent a PIN reset link to your email address. Click the link to set a new PIN.
                </p>
              </div>
              <Button onClick={handleCancelReset} className="w-full">
                Back to PIN Entry
              </Button>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Reset Your PIN</h2>
                <p className="text-gray-600 text-sm">
                  We&apos;ll send a reset link to your registered email address. You&apos;ll be able to set a new PIN after clicking the link.
                </p>
              </div>

              {resetError && (
                <p className="text-red-500 text-sm text-center mb-4">{resetError}</p>
              )}

              <div className="space-y-3">
                <Button
                  onClick={handleSendResetEmail}
                  loading={sendingReset}
                  className="w-full"
                >
                  Send Reset Email
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelReset}
                  disabled={sendingReset}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    )
  }

  // PIN set but not verified - show PIN entry modal
  return (
    <ParentPinModal
      mode="verify"
      onSuccess={handleVerifySuccess}
      onForgotPin={handleForgotPin}
      onCancel={() => router.push('/dashboard')}
    />
  )
}

// Helper to record a successful PIN entry for the rest of the browser session.
// Shared so anything that verifies the PIN outside this gate (e.g. the grown-up
// scoring controls inside the games) unlocks the same way.
export function markPinVerified() {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true')
  }
}

// Helper to clear PIN verification (call when user logs out)
export function clearPinVerification() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  }
}

// Helper to check if PIN is verified (for conditional UI)
export function isPinVerified(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true'
}
