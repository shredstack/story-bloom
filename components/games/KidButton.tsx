'use client'

import {
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { tapHaptic } from '@/lib/native/haptics'

type KidButtonSize = 'md' | 'lg' | 'xl'
type KidButtonVariant = 'primary' | 'secondary' | 'success' | 'quiet'

interface KidButtonProps {
  /** Fired at most once per `debounceMs`, never while disabled. */
  onPress: () => void
  children: ReactNode
  /** Visual weight. Default 'primary' (fuchsia). 'quiet' is for low-stakes actions. */
  variant?: KidButtonVariant
  /** Touch-target height: md ≈64pt, lg ≈80pt, xl ≈96pt (primary game actions). */
  size?: KidButtonSize
  disabled?: boolean
  /** Min ms between accepted presses (swallows accidental double/rapid taps). Default 400. */
  debounceMs?: number
  /** Light haptic on press (no-op on web). Default true. */
  haptic?: boolean
  /** Extend an invisible hit area beyond the visible art so a near-miss still counts. Default true. */
  hitSlop?: boolean
  fullWidth?: boolean
  className?: string
  'aria-label'?: string
}

const SIZE_STYLES: Record<KidButtonSize, string> = {
  md: 'min-h-[64px] min-w-[64px] px-6 text-lg gap-2',
  lg: 'min-h-[80px] min-w-[80px] px-8 text-xl gap-3',
  xl: 'min-h-[96px] min-w-[96px] px-10 text-2xl gap-3',
}

const VARIANT_STYLES: Record<KidButtonVariant, string> = {
  primary: 'bg-primary-500 text-white shadow-lg ring-primary-200',
  secondary: 'bg-secondary-500 text-white shadow-lg ring-secondary-200',
  success: 'bg-green-500 text-white shadow-lg ring-green-200',
  quiet: 'bg-white/80 text-gray-600 border-2 border-gray-200 shadow-sm ring-gray-200',
}

/**
 * Big, forgiving, kid-proof touch target shared across all StoryBloom games (§B1,
 * B3, B6). Controlled component — the parent owns state and passes `onPress`.
 *
 * - Large targets (64–96pt) with an extended invisible hit area.
 * - Debounced (default 400ms) so a double-tap can't fire twice, and it ignores
 *   extra fingers during a press (palm/two-finger mash = one action).
 * - Obvious press state (grows + glows) and a light haptic so a registered tap is
 *   unmistakable — kids re-tap when nothing "happens", which causes double-actions.
 * - Honors `disabled` for the disabled-during-transition pattern.
 */
export function KidButton({
  onPress,
  children,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  debounceMs = 400,
  haptic = true,
  hitSlop = true,
  fullWidth = false,
  className = '',
  'aria-label': ariaLabel,
}: KidButtonProps) {
  const lastPressRef = useRef(0)
  const activePointerRef = useRef<number | null>(null)
  const [pressed, setPressed] = useState(false)

  const fire = useCallback(() => {
    if (disabled) return
    const now = Date.now()
    if (now - lastPressRef.current < debounceMs) return // swallow rapid double-tap
    lastPressRef.current = now
    if (haptic) tapHaptic()
    onPress()
  }, [disabled, debounceMs, haptic, onPress])

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled) return
      // Ignore additional fingers once a press is in progress (multi-touch mash).
      if (activePointerRef.current !== null) return
      activePointerRef.current = e.pointerId
      setPressed(true)
    },
    [disabled]
  )

  const endPress = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerId === activePointerRef.current) {
      activePointerRef.current = null
    }
    setPressed(false)
  }, [])

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={fire}
      onPointerDown={handlePointerDown}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onPointerLeave={endPress}
      className={`
        relative inline-flex items-center justify-center font-extrabold rounded-2xl
        select-none touch-manipulation transition-all duration-150
        focus:outline-none focus:ring-4 focus-visible:ring-4
        disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
        ${SIZE_STYLES[size]}
        ${VARIANT_STYLES[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${pressed && !disabled ? 'scale-105 shadow-xl ring-4' : 'scale-100'}
        ${className}
      `}
    >
      {/* Invisible extended hit area so a near-miss still registers. */}
      {hitSlop && <span aria-hidden className="absolute -inset-3" />}
      <span className="relative flex items-center justify-center gap-[inherit]">
        {children}
      </span>
    </button>
  )
}
