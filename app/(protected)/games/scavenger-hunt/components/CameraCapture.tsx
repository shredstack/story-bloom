'use client'

import { useRef } from 'react'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  disabled?: boolean
  label?: string
}

// Downscale a captured photo client-side before upload (saves latency + tokens).
// Returns a JPEG File at most ~1280px on its longest side. Falls back to the
// original file if anything goes wrong.
async function downscale(file: File, maxDim = 1280): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    )
    if (!blob) return file
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function CameraCapture({
  onCapture,
  disabled,
  label = 'Take a Photo',
}: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset so picking the same file again still fires onChange.
    e.target.value = ''
    if (!file) return
    const processed = await downscale(file)
    onCapture(processed)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xl font-bold shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        <span className="text-3xl">📸</span>
        {label}
      </button>
    </>
  )
}
