'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'

interface ProfileImageUploadProps {
  label?: string
  currentImageUrl?: string | null
  onFileSelect: (file: File) => void
  onRemove?: () => void
  error?: string
  maxSizeMB?: number
  maxWidth?: number
  quality?: number
}

async function compressImage(
  file: File,
  maxWidth: number,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not compress image'))
            return
          }

          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })

          resolve(compressedFile)
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => reject(new Error('Could not load image'))

    const reader = new FileReader()
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

export function ProfileImageUpload({
  label,
  currentImageUrl,
  onFileSelect,
  onRemove,
  error,
  maxSizeMB = 2,
  maxWidth = 400,
  quality = 0.85,
}: ProfileImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)

  const validateAndSetFile = async (file: File) => {
    setFileError(null)

    if (!file.type.startsWith('image/')) {
      setFileError('Please upload an image file')
      return
    }

    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes * 2) {
      setFileError(`File size must be less than ${maxSizeMB * 2}MB`)
      return
    }

    setIsCompressing(true)

    try {
      const compressedFile = await compressImage(file, maxWidth, quality)

      if (compressedFile.size > maxBytes) {
        setFileError(`Compressed image is still too large. Try a smaller image.`)
        setIsCompressing(false)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(compressedFile)

      onFileSelect(compressedFile)
    } catch {
      setFileError('Failed to process image. Please try another file.')
    } finally {
      setIsCompressing(false)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleRemove = () => {
    setPreview(null)
    setFileError(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
    onRemove?.()
  }

  const displayError = error || fileError
  const displayImage = preview || currentImageUrl

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex items-center gap-4">
        {isCompressing ? (
          <div className="w-24 h-24 rounded-full border-2 border-gray-200 bg-gray-50 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin" />
          </div>
        ) : displayImage ? (
          <div className="relative">
            <img
              src={displayImage}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-1 -right-1 p-1 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors border border-gray-200"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-24 h-24 rounded-full border-2 border-dashed cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
              isDragging
                ? 'border-primary-400 bg-primary-50'
                : displayError
                ? 'border-red-400 bg-red-50'
                : 'border-gray-300 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/50'
            }`}
          >
            <svg className={`w-8 h-8 ${isDragging ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        <div className="flex-1">
          <button
            type="button"
            onClick={handleClick}
            className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            {displayImage ? 'Change Photo' : 'Upload Photo'}
          </button>
          <p className="text-xs text-gray-500 mt-1">
            JPG, PNG up to {maxSizeMB}MB
          </p>
        </div>
      </div>
      {displayError && (
        <p className="mt-1.5 text-sm text-red-500">{displayError}</p>
      )}
    </div>
  )
}
