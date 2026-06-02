'use client'

import { Button, Card } from '@/components/ui'

interface QuitGameDialogProps {
  open: boolean
  /** Dismiss the dialog and stay in the game. */
  onKeepPlaying: () => void
  /** Confirm quitting the game. */
  onQuit: () => void
  title?: string
  message?: string
  keepLabel?: string
  quitLabel?: string
}

/**
 * Confirmation shown when a child taps "Quit" inside a game, so an accidental
 * tap can't end the game and lose progress. Shared across all StoryBloom games.
 */
export function QuitGameDialog({
  open,
  onKeepPlaying,
  onQuit,
  title = 'Quit the game?',
  message = "You can keep playing, or quit now. You'll keep anything you've already earned.",
  keepLabel = 'Keep playing',
  quitLabel = 'Quit',
}: QuitGameDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onKeepPlaying}
      />
      <Card className="relative z-10 p-6 max-w-sm w-full text-center">
        <div className="text-4xl mb-3" aria-hidden>🛑</div>
        <h2 className="text-xl font-bold mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex flex-col gap-3">
          <Button onClick={onKeepPlaying} className="w-full">
            {keepLabel}
          </Button>
          <Button variant="outline" onClick={onQuit} className="w-full">
            {quitLabel}
          </Button>
        </div>
      </Card>
    </div>
  )
}
