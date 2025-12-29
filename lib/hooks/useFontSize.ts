'use client'

import { useState, useEffect } from 'react'
import type { FontSize } from '@/lib/types'

const FONT_SIZE_KEY = 'storybloom-font-size'

export function useFontSize() {
  const [fontSize, setFontSize] = useState<FontSize>('medium')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY)
    if (saved) {
      setFontSize(saved as FontSize)
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(FONT_SIZE_KEY, fontSize)
    }
  }, [fontSize, isLoaded])

  return { fontSize, setFontSize }
}
