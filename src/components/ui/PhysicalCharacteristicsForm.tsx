import { SkinTonePicker } from './SkinTonePicker';
import { ProfileImageUpload } from './ProfileImageUpload';
import { Select } from './Select';
import {
  HAIR_COLORS,
  EYE_COLORS,
  GENDERS,
  PRONOUNS,
  type SkinTone,
  type HairColor,
  type EyeColor,
  type Gender,
  type Pronouns,
} from '../../types';

export interface PhysicalCharacteristicsData {
  profileImageFile?: File | null;
  profileImageUrl?: string | null;
  skinTone: SkinTone | null;
  hairColor: HairColor | null;
  eyeColor: EyeColor | null;
  gender: Gender | null;
  pronouns: Pronouns | null;
}

interface PhysicalCharacteristicsFormProps {
  data: PhysicalCharacteristicsData;
  onChange: (data: PhysicalCharacteristicsData) => void;
  showProfileImage?: boolean;
  compact?: boolean;
}

export function PhysicalCharacteristicsForm({
  data,
  onChange,
  showProfileImage = true,
  compact = false,
}: PhysicalCharacteristicsFormProps) {
  const handleChange = <K extends keyof PhysicalCharacteristicsData>(
    key: K,
    value: PhysicalCharacteristicsData[K]
  ) => {
    onChange({ ...data, [key]: value });
  };

  // Convert arrays to select options format
  const hairColorOptions = HAIR_COLORS.map((color) => ({
    value: color,
    label: color === 'diverse' ? 'Diverse (any)' : color.charAt(0).toUpperCase() + color.slice(1),
  }));

  const eyeColorOptions = EYE_COLORS.map((color) => ({
    value: color,
    label: color === 'diverse' ? 'Diverse (any)' : color.charAt(0).toUpperCase() + color.slice(1),
  }));

  const genderOptions = GENDERS.map((g) => ({
    value: g.id,
    label: g.label,
  }));

  const pronounOptions = PRONOUNS.map((p) => ({
    value: p.id,
    label: p.label,
  }));

  return (
    <div className={`space-y-${compact ? '4' : '6'}`}>
      {/* Transparency notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-800">Why we ask for these details</h4>
            <p className="text-sm text-blue-700 mt-1">
              These optional details help us create story illustrations that look more like your child,
              making the stories more engaging and personal. This information is only used to describe
              characters in image generation prompts and is never shared.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Image */}
      {showProfileImage && (
        <ProfileImageUpload
          label="Profile Photo (optional)"
          currentImageUrl={data.profileImageUrl}
          onFileSelect={(file) => handleChange('profileImageFile', file)}
          onRemove={() => {
            handleChange('profileImageFile', null);
            handleChange('profileImageUrl', null);
          }}
        />
      )}

      {/* Skin Tone */}
      <SkinTonePicker
        label="Skin Tone"
        value={data.skinTone}
        onChange={(value) => handleChange('skinTone', value)}
      />

      {/* Hair and Eye Color - side by side on larger screens */}
      <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-4`}>
        <Select
          label="Hair Color"
          value={data.hairColor || 'diverse'}
          onChange={(e) => handleChange('hairColor', e.target.value === 'diverse' ? null : e.target.value as HairColor)}
          options={hairColorOptions}
        />
        <Select
          label="Eye Color"
          value={data.eyeColor || 'diverse'}
          onChange={(e) => handleChange('eyeColor', e.target.value === 'diverse' ? null : e.target.value as EyeColor)}
          options={eyeColorOptions}
        />
      </div>

      {/* Gender and Pronouns - side by side on larger screens */}
      <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-4`}>
        <Select
          label="Gender"
          value={data.gender || 'diverse'}
          onChange={(e) => handleChange('gender', e.target.value === 'diverse' ? null : e.target.value as Gender)}
          options={genderOptions}
        />
        <Select
          label="Pronouns"
          value={data.pronouns || 'diverse'}
          onChange={(e) => handleChange('pronouns', e.target.value === 'diverse' ? null : e.target.value as Pronouns)}
          options={pronounOptions}
        />
      </div>

      {/* Additional note about defaults */}
      <p className="text-xs text-gray-500">
        All fields default to "Diverse" which means the AI can choose any characteristics when
        generating illustrations. You can change these settings at any time.
      </p>
    </div>
  );
}
