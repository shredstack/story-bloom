import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';

interface FileUploadProps {
  label?: string;
  onFileSelect: (file: File) => void;
  accept?: string;
  error?: string;
  maxSizeMB?: number;
  maxWidth?: number;
  quality?: number;
}

// Compress image using canvas
async function compressImage(
  file: File,
  maxWidth: number,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not compress image'));
            return;
          }

          // Create new file with same name but compressed
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Could not load image'));

    // Load the image
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function FileUpload({
  label,
  onFileSelect,
  accept = 'image/*',
  error,
  maxSizeMB = 5,
  maxWidth = 1200,
  quality = 0.8,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);

  const validateAndSetFile = async (file: File) => {
    setFileError(null);
    setOriginalSize(file.size);

    // Check file type
    if (!file.type.startsWith('image/')) {
      setFileError('Please upload an image file');
      return;
    }

    // Check initial file size (before compression)
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes * 2) {
      // Allow up to 2x max size since we'll compress
      setFileError(`File size must be less than ${maxSizeMB * 2}MB`);
      return;
    }

    setIsCompressing(true);

    try {
      // Compress the image
      const compressedFile = await compressImage(file, maxWidth, quality);
      setCompressedSize(compressedFile.size);

      // Check compressed size
      if (compressedFile.size > maxBytes) {
        setFileError(`Compressed image is still too large. Try a smaller image.`);
        setIsCompressing(false);
        return;
      }

      // Create preview from compressed file
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(compressedFile);

      onFileSelect(compressedFile);
    } catch (err) {
      setFileError('Failed to process image. Please try another file.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const clearPreview = () => {
    setPreview(null);
    setFileError(null);
    setOriginalSize(null);
    setCompressedSize(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const displayError = error || fileError;

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
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      {isCompressing ? (
        <div className="w-full h-48 rounded-xl border-2 border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin" />
          <p className="text-sm text-gray-600">Compressing image...</p>
        </div>
      ) : preview ? (
        <div className="relative rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50">
          <div className="flex items-center justify-center p-4">
            <img
              src={preview}
              alt="Preview"
              className="max-w-full max-h-64 object-contain rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={clearPreview}
            className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {originalSize && compressedSize && (
            <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Compressed: {formatFileSize(originalSize)} → {formatFileSize(compressedSize)}
                {originalSize > compressedSize && (
                  <span className="text-green-600 ml-1">
                    ({Math.round((1 - compressedSize / originalSize) * 100)}% smaller)
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full h-48 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-primary-400 bg-primary-50'
              : displayError
              ? 'border-red-400 bg-red-50'
              : 'border-gray-300 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/50'
          }`}
        >
          <div className={`p-3 rounded-full ${isDragging ? 'bg-primary-100' : 'bg-gray-100'}`}>
            <svg className={`w-8 h-8 ${isDragging ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              Drop an image here or click to upload
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, GIF up to {maxSizeMB}MB (auto-compressed)
            </p>
          </div>
        </div>
      )}
      {displayError && (
        <p className="mt-1.5 text-sm text-red-500">{displayError}</p>
      )}
    </div>
  );
}
