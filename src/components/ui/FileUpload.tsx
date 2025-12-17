import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';

interface FileUploadProps {
  label?: string;
  onFileSelect: (file: File) => void;
  accept?: string;
  error?: string;
  maxSizeMB?: number;
}

export function FileUpload({
  label,
  onFileSelect,
  accept = 'image/*',
  error,
  maxSizeMB = 5,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const validateAndSetFile = (file: File) => {
    setFileError(null);

    // Check file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setFileError(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setFileError('Please upload an image file');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    onFileSelect(file);
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
    if (inputRef.current) {
      inputRef.current.value = '';
    }
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
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-xl border-2 border-gray-200"
          />
          <button
            type="button"
            onClick={clearPreview}
            className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              PNG, JPG, GIF up to {maxSizeMB}MB
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
