import { SKIN_TONES, type SkinTone } from '../../types';

interface SkinTonePickerProps {
  label?: string;
  value: SkinTone | null;
  onChange: (value: SkinTone | null) => void;
  error?: string;
}

export function SkinTonePicker({ label, value, onChange, error }: SkinTonePickerProps) {
  const selectedValue = value || 'diverse';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {SKIN_TONES.map((tone) => {
          const isSelected = selectedValue === tone.id;
          const isDiverse = tone.id === 'diverse';

          return (
            <button
              key={tone.id}
              type="button"
              onClick={() => onChange(tone.id === 'diverse' ? null : tone.id)}
              className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-100'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              title={tone.label}
            >
              {isDiverse ? (
                // Rainbow/diverse indicator
                <div
                  className="w-10 h-10 rounded-full border-2 border-gray-200 overflow-hidden"
                  style={{
                    background: 'conic-gradient(from 0deg, #FFDFC4, #F0D5BE, #D1A684, #C4A87C, #A67B5B, #8D5524, #5C3A21, #FFDFC4)',
                  }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full border-2 border-gray-200"
                  style={{ backgroundColor: tone.color || undefined }}
                />
              )}
              <span className="text-xs text-gray-600 whitespace-nowrap">
                {tone.label}
              </span>
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
