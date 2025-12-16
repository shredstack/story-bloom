import { useState, useEffect } from 'react';
import type { FontSize } from '../types';

const FONT_SIZE_KEY = 'storybloom-font-size';

export function useFontSize() {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return (saved as FontSize) || 'medium';
  });

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, fontSize);
  }, [fontSize]);

  return { fontSize, setFontSize };
}
