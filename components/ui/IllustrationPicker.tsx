'use client'

import { useState, useRef } from 'react'
import type { CustomIllustration } from '@/lib/types'
import { Button } from './Button'
import { Input } from './Input'

interface IllustrationPickerProps {
  illustrations: CustomIllustration[]
  loading: boolean
  onSelect: (illustration: CustomIllustration | null) => void
  onUploadNew: (file: File, name: string) => Promise<CustomIllustration | null>
  selectedIllustration: CustomIllustration | null
}

async function compressImage(
  file: File,
  maxDimension: number = 1024,
  targetMaxSizeKB: number = 500
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      canvas.width = width
      canvas.height = height

      if (!ctx) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Could not get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)

      const tryCompress = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not compress image'))
              return
            }

            const sizeKB = blob.size / 1024
            if (sizeKB > targetMaxSizeKB && quality > 0.3) {
              tryCompress(quality - 0.1)
              return
            }

            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })

            resolve(compressedFile)
          },
          'image/jpeg',
          quality
        )
      }

      tryCompress(0.85)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image'))
    }

    img.src = objectUrl
  })
}

export function IllustrationPicker({
  illustrations,
  loading,
  onSelect,
  onUploadNew,
  selectedIllustration,
}: IllustrationPickerProps) {
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be less than 10MB')
      return
    }

    setIsCompressing(true)
    setUploadError(null)

    try {
      const compressedFile = await compressImage(file)
      setUploadFile(compressedFile)

      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadPreview(e.target?.result as string)
      }
      reader.readAsDataURL(compressedFile)

      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      setUploadName(nameWithoutExt)
    } catch {
      setUploadError('Failed to process image. Please try another file.')
    } finally {
      setIsCompressing(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
      setShowUploadForm(true)
    }
  }

  const handleUploadAndSelect = async () => {
    if (!uploadFile || !uploadName.trim()) {
      setUploadError('Please select an image and enter a name')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    const result = await onUploadNew(uploadFile, uploadName.trim())

    if (result) {
      onSelect(result)
      resetUploadForm()
    } else {
      setUploadError('Failed to upload illustration. Please try again.')
    }

    setIsUploading(false)
  }

  const resetUploadForm = () => {
    setShowUploadForm(false)
    setUploadFile(null)
    setUploadPreview(null)
    setUploadName('')
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const handleSelectExisting = (illustration: CustomIllustration) => {
    if (selectedIllustration?.id === illustration.id) {
      onSelect(null)
    } else {
      onSelect(illustration)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-10 h-10 mx-auto mb-3 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin" />
        <p className="text-sm text-gray-500">Loading illustrations...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {!showUploadForm && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload Image
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Take Photo
          </Button>
        </div>
      )}

      {showUploadForm && (
        <div className="border-2 border-dashed border-primary-200 rounded-xl p-4 bg-primary-50/50">
          {isCompressing ? (
            <div className="text-center py-4">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full border-3 border-primary-200 border-t-primary-500 animate-spin" />
              <p className="text-sm text-gray-600">Processing image...</p>
            </div>
          ) : uploadPreview ? (
            <div className="space-y-3">
              <div className="relative">
                <img
                  src={uploadPreview}
                  alt="Upload preview"
                  className="w-full max-h-48 object-contain rounded-lg"
                />
                <button
                  type="button"
                  onClick={resetUploadForm}
                  className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <Input
                placeholder="Give this illustration a name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
              />
              {uploadError && (
                <p className="text-sm text-red-500">{uploadError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleUploadAndSelect}
                  loading={isUploading}
                  className="flex-1"
                >
                  Use This Image
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetUploadForm}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {illustrations.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Or choose from your illustrations:
          </p>
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {illustrations.map((illustration) => (
              <button
                key={illustration.id}
                type="button"
                onClick={() => handleSelectExisting(illustration)}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  selectedIllustration?.id === illustration.id
                    ? 'border-primary-500 ring-2 ring-primary-200'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <img
                  src={illustration.image_url}
                  alt={illustration.name}
                  className="w-full h-full object-cover"
                />
                {selectedIllustration?.id === illustration.id && (
                  <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
                    <div className="bg-primary-500 rounded-full p-1">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                  <p className="text-xs text-white truncate">{illustration.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {illustrations.length === 0 && !showUploadForm && (
        <p className="text-sm text-gray-500 text-center py-4">
          No illustrations yet. Upload or take a photo to get started!
        </p>
      )}

      {selectedIllustration && !showUploadForm && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
          <img
            src={selectedIllustration.image_url}
            alt={selectedIllustration.name}
            className="w-16 h-16 object-cover rounded-lg"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800 truncate">{selectedIllustration.name}</p>
            <p className="text-sm text-gray-500">Selected for story generation</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSelect(null)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
      )}
    </div>
  )
}
