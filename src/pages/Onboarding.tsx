import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChild } from '../context/ChildContext';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Select, TextArea, TagInput, Card } from '../components/ui';
import { PhysicalCharacteristicsForm, type PhysicalCharacteristicsData } from '../components/ui/PhysicalCharacteristicsForm';
import { uploadProfileImage } from '../hooks/useProfileImage';
import { READING_LEVELS, type ReadingLevel } from '../types';

export function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createChild } = useChild();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>(READING_LEVELS[1]);
  const [favoriteThings, setFavoriteThings] = useState<string[]>([]);
  const [parentSummary, setParentSummary] = useState('');
  const [physicalCharacteristics, setPhysicalCharacteristics] = useState<PhysicalCharacteristicsData>({
    profileImageFile: null,
    profileImageUrl: null,
    skinTone: null,
    hairColor: null,
    eyeColor: null,
    gender: null,
    pronouns: null,
  });

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        setError('Please enter your child\'s name');
        return;
      }
      if (!age || parseInt(age) < 1 || parseInt(age) > 18) {
        setError('Please enter a valid age (1-18)');
        return;
      }
      setError('');
      setStep(2);
    } else if (step === 2) {
      if (favoriteThings.length === 0) {
        setError('Please add at least one interest');
        return;
      }
      setError('');
      setStep(3);
    } else if (step === 3) {
      setError('');
      setStep(4);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    setError('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    // Handle profile image upload if a file was selected
    let profileImageUrl: string | null = null;
    let profileImageStoragePath: string | null = null;

    if (physicalCharacteristics.profileImageFile && user) {
      const result = await uploadProfileImage(user.id, physicalCharacteristics.profileImageFile);
      if (result) {
        profileImageUrl = result.url;
        profileImageStoragePath = result.storagePath;
      } else {
        setError('Failed to upload profile image. Please try again.');
        setLoading(false);
        return;
      }
    }

    const child = await createChild({
      name: name.trim(),
      age: parseInt(age),
      reading_level: readingLevel,
      favorite_things: favoriteThings,
      parent_summary: parentSummary.trim() || null,
      default_text_size: 'medium',
      profile_image_url: profileImageUrl,
      profile_image_storage_path: profileImageStoragePath,
      skin_tone: physicalCharacteristics.skinTone,
      hair_color: physicalCharacteristics.hairColor,
      eye_color: physicalCharacteristics.eyeColor,
      gender: physicalCharacteristics.gender,
      pronouns: physicalCharacteristics.pronouns,
    });

    if (child) {
      navigate('/dashboard');
    } else {
      setError('Failed to create profile. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mb-4">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Let's set up your child's profile
          </h1>
          <p className="text-gray-600">
            This helps us create personalized stories they'll love
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                s === step ? 'bg-primary-500 w-8' : s < step ? 'bg-primary-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <Card>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Basic Information</h2>
              <Input
                label="Child's Name"
                placeholder="Enter their name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                type="number"
                label="Age"
                placeholder="Enter their age"
                min="1"
                max="18"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
              <Select
                label="Reading Level"
                value={readingLevel}
                onChange={(e) => setReadingLevel(e.target.value as ReadingLevel)}
                options={READING_LEVELS.map(level => ({ value: level, label: level }))}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Interests & Favorites</h2>
              <p className="text-gray-600 text-sm mb-4">
                What does {name || 'your child'} love? Add things like animals, activities, hobbies, or characters.
              </p>
              <TagInput
                label="Favorite Things"
                tags={favoriteThings}
                onChange={setFavoriteThings}
                placeholder="e.g., dinosaurs, soccer, unicorns..."
              />
              <div className="flex flex-wrap gap-2 mt-4">
                <p className="text-sm text-gray-500 w-full mb-2">Quick add:</p>
                {['Dinosaurs', 'Princesses', 'Space', 'Animals', 'Cars', 'Superheroes', 'Sports', 'Nature'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (!favoriteThings.includes(tag)) {
                        setFavoriteThings([...favoriteThings, tag]);
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      favoriteThings.includes(tag)
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Tell us more (Optional)</h2>
              <p className="text-gray-600 text-sm mb-4">
                Share anything else about {name || 'your child'} that might help us create better stories.
              </p>
              <TextArea
                label="About your child"
                placeholder="e.g., They love adventures with their dog Max, they're learning to read chapter books, they like stories with happy endings..."
                rows={4}
                value={parentSummary}
                onChange={(e) => setParentSummary(e.target.value)}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Physical Characteristics (Optional)</h2>
              <p className="text-gray-600 text-sm mb-4">
                Help us create story illustrations that look more like {name || 'your child'}.
                All fields are optional - skip any you'd prefer not to share.
              </p>
              <PhysicalCharacteristicsForm
                data={physicalCharacteristics}
                onChange={setPhysicalCharacteristics}
                showProfileImage={true}
              />
            </div>
          )}

          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={handleNext} className="flex-1">
                Continue
              </Button>
            ) : (
              <Button onClick={handleSubmit} loading={loading} className="flex-1">
                Create Profile
              </Button>
            )}
            {step === 4 && (
              <Button variant="ghost" onClick={handleSubmit} loading={loading} className="flex-1">
                Skip & Create
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
