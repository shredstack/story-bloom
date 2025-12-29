'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChild, useAuth } from '../ProtectedLayoutClient'
import { uploadProfileImage, deleteProfileImage } from '@/lib/hooks/useProfileImage'
import { Button, Input, Select, TextArea, TagInput, Card } from '@/components/ui'
import { PhysicalCharacteristicsForm, type PhysicalCharacteristicsData } from '@/components/ui/PhysicalCharacteristicsForm'
import {
  READING_LEVELS,
  type Child,
  type ReadingLevel,
  type FontSize,
} from '@/lib/types'

export default function ProfilePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { children, selectedChild, selectChild, createChild, updateChild, deleteChild } = useChild()

  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>(READING_LEVELS[1])
  const [favoriteThings, setFavoriteThings] = useState<string[]>([])
  const [parentSummary, setParentSummary] = useState('')
  const [defaultTextSize, setDefaultTextSize] = useState<FontSize>('medium')
  const [physicalCharacteristics, setPhysicalCharacteristics] = useState<PhysicalCharacteristicsData>({
    profileImageFile: null,
    profileImageUrl: null,
    skinTone: null,
    hairColor: null,
    eyeColor: null,
    gender: null,
    pronouns: null,
  })
  const [showCharacteristics, setShowCharacteristics] = useState(false)

  const resetForm = () => {
    setName('')
    setAge('')
    setReadingLevel(READING_LEVELS[1])
    setFavoriteThings([])
    setParentSummary('')
    setDefaultTextSize('medium')
    setPhysicalCharacteristics({
      profileImageFile: null,
      profileImageUrl: null,
      skinTone: null,
      hairColor: null,
      eyeColor: null,
      gender: null,
      pronouns: null,
    })
    setShowCharacteristics(false)
    setError('')
  }

  const startEditing = (child: Child) => {
    setEditingChild(child)
    setName(child.name)
    setAge(child.age.toString())
    setReadingLevel(child.reading_level as ReadingLevel)
    setFavoriteThings(child.favorite_things)
    setParentSummary(child.parent_summary || '')
    setDefaultTextSize(child.default_text_size)
    setPhysicalCharacteristics({
      profileImageFile: null,
      profileImageUrl: child.profile_image_url,
      skinTone: child.skin_tone,
      hairColor: child.hair_color,
      eyeColor: child.eye_color,
      gender: child.gender,
      pronouns: child.pronouns,
    })
    // Show characteristics section if any values are set
    const hasCharacteristics = child.profile_image_url || child.skin_tone || child.hair_color || child.eye_color || child.gender || child.pronouns
    setShowCharacteristics(!!hasCharacteristics)
    setIsCreating(false)
  }

  const startCreating = () => {
    resetForm()
    setEditingChild(null)
    setIsCreating(true)
  }

  const cancelEdit = () => {
    setEditingChild(null)
    setIsCreating(false)
    resetForm()
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a name')
      return
    }
    if (!age || parseInt(age) < 1 || parseInt(age) > 18) {
      setError('Please enter a valid age (1-18)')
      return
    }
    if (favoriteThings.length === 0) {
      setError('Please add at least one interest')
      return
    }

    setLoading(true)
    setError('')

    // Handle profile image upload if a new file was selected
    let profileImageUrl: string | null = physicalCharacteristics.profileImageUrl ?? null
    let profileImageStoragePath: string | null = editingChild?.profile_image_storage_path ?? null

    if (physicalCharacteristics.profileImageFile && user) {
      // Delete old image if exists
      if (editingChild?.profile_image_storage_path) {
        await deleteProfileImage(editingChild.profile_image_storage_path)
      }

      const result = await uploadProfileImage(user.id, physicalCharacteristics.profileImageFile)
      if (result) {
        profileImageUrl = result.url
        profileImageStoragePath = result.storagePath
      } else {
        setError('Failed to upload profile image')
        setLoading(false)
        return
      }
    } else if (physicalCharacteristics.profileImageUrl === null && editingChild?.profile_image_storage_path) {
      // Image was removed
      await deleteProfileImage(editingChild.profile_image_storage_path)
      profileImageStoragePath = null
    }

    const childData = {
      name: name.trim(),
      age: parseInt(age),
      reading_level: readingLevel,
      favorite_things: favoriteThings,
      parent_summary: parentSummary.trim() || null,
      default_text_size: defaultTextSize,
      profile_image_url: profileImageUrl,
      profile_image_storage_path: profileImageStoragePath,
      skin_tone: physicalCharacteristics.skinTone,
      hair_color: physicalCharacteristics.hairColor,
      eye_color: physicalCharacteristics.eyeColor,
      gender: physicalCharacteristics.gender,
      pronouns: physicalCharacteristics.pronouns,
    }

    if (isCreating) {
      const newChild = await createChild(childData)
      if (newChild) {
        cancelEdit()
      } else {
        setError('Failed to create profile')
      }
    } else if (editingChild) {
      const success = await updateChild(editingChild.id, childData)
      if (success) {
        cancelEdit()
      } else {
        setError('Failed to update profile')
      }
    }

    setLoading(false)
  }

  const handleDelete = async (childId: string) => {
    setLoading(true)
    const success = await deleteChild(childId)
    if (success) {
      setShowDeleteConfirm(null)
      if (children.length === 1) {
        router.push('/onboarding')
      }
    }
    setLoading(false)
  }

  const isEditing = editingChild || isCreating

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Child Profiles</h1>
          <p className="text-gray-600">Manage profiles for personalized stories</p>
        </div>
        {!isEditing && (
          <Button onClick={startCreating}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Child
          </Button>
        )}
      </div>

      {isEditing ? (
        <Card>
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            {isCreating ? 'Create New Profile' : `Edit ${editingChild?.name}'s Profile`}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Name"
                placeholder="Child's name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                type="number"
                label="Age"
                placeholder="Age"
                min="1"
                max="18"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>

            <Select
              label="Reading Level"
              value={readingLevel}
              onChange={(e) => setReadingLevel(e.target.value as ReadingLevel)}
              options={READING_LEVELS.map(level => ({ value: level, label: level }))}
            />

            <Select
              label="Default Text Size"
              value={defaultTextSize}
              onChange={(e) => setDefaultTextSize(e.target.value as FontSize)}
              options={[
                { value: 'small', label: 'Small (A)' },
                { value: 'medium', label: 'Medium (A+)' },
                { value: 'large', label: 'Large (A++)' },
                { value: 'extra-large', label: 'Extra Large (A+++)' },
              ]}
            />

            <TagInput
              label="Favorite Things"
              tags={favoriteThings}
              onChange={setFavoriteThings}
              placeholder="Add interests..."
            />

            <TextArea
              label="About (Optional)"
              placeholder="Tell us more about your child..."
              rows={3}
              value={parentSummary}
              onChange={(e) => setParentSummary(e.target.value)}
            />

            {/* Physical Characteristics Section */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setShowCharacteristics(!showCharacteristics)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Physical Characteristics</h3>
                  <p className="text-sm text-gray-500">Optional - for personalized story illustrations</p>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${showCharacteristics ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showCharacteristics && (
                <div className="mt-4">
                  <PhysicalCharacteristicsForm
                    data={physicalCharacteristics}
                    onChange={setPhysicalCharacteristics}
                    showProfileImage={true}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={cancelEdit} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} loading={loading} className="flex-1">
                {isCreating ? 'Create Profile' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map(child => (
            <Card
              key={child.id}
              className={`relative ${selectedChild?.id === child.id ? 'ring-2 ring-primary-500' : ''}`}
            >
              {selectedChild?.id === child.id && (
                <span className="absolute -top-2 -right-2 px-2 py-1 bg-primary-500 text-white text-xs font-medium rounded-full">
                  Active
                </span>
              )}

              <div className="flex items-start gap-4">
                {child.profile_image_url ? (
                  <img
                    src={child.profile_image_url}
                    alt={child.name}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                    {child.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-800">{child.name}</h3>
                  <p className="text-sm text-gray-600">
                    {child.age} years old • {child.reading_level}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {child.favorite_things.slice(0, 3).map(thing => (
                      <span
                        key={thing}
                        className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium"
                      >
                        {thing}
                      </span>
                    ))}
                    {child.favorite_things.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        +{child.favorite_things.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                {selectedChild?.id !== child.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectChild(child)}
                    className="flex-1"
                  >
                    Select
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEditing(child)}
                  className="flex-1"
                >
                  Edit
                </Button>
                <button
                  onClick={() => setShowDeleteConfirm(child.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </Card>
          ))}

          {children.length === 0 && (
            <Card className="sm:col-span-2 text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No profiles yet</h3>
              <p className="text-gray-500 mb-4">Create a child profile to start generating stories!</p>
              <Button onClick={startCreating}>Create First Profile</Button>
            </Card>
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Profile?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this profile? All stories associated with this profile will also be deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDelete(showDeleteConfirm)}
                loading={loading}
                className="flex-1 bg-red-500 hover:bg-red-600"
              >
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
