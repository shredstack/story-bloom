'use client'

// Shown while the AI checks the photo — the only slow step in the loop.
export function VerifyingAnimation() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
      <div className="relative mb-6">
        <div className="text-7xl animate-bounce">🔍</div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-2 w-16 rounded-full bg-amber-200 blur-sm animate-pulse" />
      </div>
      <p className="text-xl font-bold text-gray-800">Checking your photo…</p>
      <p className="text-gray-500 mt-1">Looking really closely! 👀</p>
      <div className="mt-6 flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full bg-purple-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
