'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useChild } from '../ProtectedLayoutClient'
import { useStories, useGenerateStory } from '@/lib/hooks/useStories'
import { useCustomIllustrations } from '@/lib/hooks/useCustomIllustrations'
import { Button, TextArea, Card, IllustrationPicker } from '@/components/ui'
import type { CustomIllustration } from '@/lib/types'

type GenerationMode = 'random' | 'topic' | 'illustration'

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { selectedChild, children } = useChild()
  const { stories, createStory } = useStories(selectedChild?.id)
  const { generateStory, generating, error: generateError } = useGenerateStory()
  const { illustrations, loading: illustrationsLoading, uploadIllustration } = useCustomIllustrations(user?.id)

  const [customPrompt, setCustomPrompt] = useState('')
  const [generationMode, setGenerationMode] = useState<GenerationMode | null>(null)
  const [selectedIllustration, setSelectedIllustration] = useState<CustomIllustration | null>(null)
  const [illustrationWarning, setIllustrationWarning] = useState<string | null>(null)

  const handleGenerateStory = async () => {
    if (!selectedChild) return

    if (generationMode === 'illustration' && !selectedIllustration) {
      return
    }

    setIllustrationWarning(null)

    const sourceIllustration = generationMode === 'illustration' && selectedIllustration
      ? {
          url: selectedIllustration.image_url,
          title: selectedIllustration.name,
          description: selectedIllustration.description,
        }
      : null

    const physicalCharacteristics = {
      skinTone: selectedChild.skin_tone,
      hairColor: selectedChild.hair_color,
      eyeColor: selectedChild.eye_color,
      gender: selectedChild.gender,
      pronouns: selectedChild.pronouns,
    }

    const result = await generateStory(
      selectedChild.name,
      selectedChild.age,
      selectedChild.reading_level,
      selectedChild.favorite_things,
      selectedChild.parent_summary,
      customPrompt.trim() || null,
      sourceIllustration,
      physicalCharacteristics
    )

    if (result) {
      if (result.warning === 'illustration_content_policy') {
        setIllustrationWarning(
          'We couldn\'t generate an illustration for this story because the image contained people. ' +
          'Try using a drawing, artwork, or scene without real people for best results. ' +
          'Your story was still created successfully!'
        )
      }

      const story = await createStory(
        result.title,
        result.content,
        customPrompt.trim() || null,
        result.illustrations,
        sourceIllustration?.url ?? null
      )

      if (story) {
        setGenerationMode(null)
        setCustomPrompt('')
        setSelectedIllustration(null)

        if (result.warning === 'illustration_content_policy') {
          setTimeout(() => {
            router.push(`/story/${story.id}`)
          }, 4000)
        } else {
          router.push(`/story/${story.id}`)
        }
      }
    }
  }

  const handleUploadNewIllustration = async (file: File, name: string): Promise<CustomIllustration | null> => {
    return await uploadIllustration(file, name, null)
  }

  const resetGenerationMode = () => {
    setGenerationMode(null)
    setCustomPrompt('')
    setSelectedIllustration(null)
  }

  if (!selectedChild) {
    if (children.length === 0) {
      return (
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">No child profiles yet</h2>
          <p className="text-gray-600 mb-6">Create a profile to start generating personalized stories!</p>
          <Button onClick={() => router.push('/onboarding')}>Create First Profile</Button>
        </div>
      )
    }
    return null
  }

  const recentStories = stories.slice(0, 3)
  const favoriteStories = stories.filter(s => s.is_favorited).slice(0, 3)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Hi, {selectedChild.name}!
        </h1>
        <p className="text-gray-600">Ready for a new adventure?</p>
      </div>

      <Card className="mb-8 bg-gradient-to-br from-primary-50 to-secondary-50 border-2 border-primary-100">
        <div className="text-center py-4">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white shadow-lg flex items-center justify-center">
            <svg className="w-12 h-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Create a New Story</h2>

          {generationMode === 'topic' ? (
            <div className="max-w-md mx-auto mb-4">
              <TextArea
                placeholder="What kind of story would you like? (e.g., 'a story about rainbow dinosaurs' or 'an adventure in outer space')"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  onClick={resetGenerationMode}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateStory}
                  loading={generating}
                  className="flex-1"
                >
                  Generate Story
                </Button>
              </div>
            </div>
          ) : generationMode === 'illustration' ? (
            <div className="max-w-md mx-auto mb-4 text-left">
              <p className="text-sm text-gray-600 mb-3 text-center">
                Select an illustration to inspire your story
              </p>
              <IllustrationPicker
                illustrations={illustrations}
                loading={illustrationsLoading}
                onSelect={setSelectedIllustration}
                onUploadNew={handleUploadNewIllustration}
                selectedIllustration={selectedIllustration}
              />
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={resetGenerationMode}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateStory}
                  loading={generating}
                  disabled={!selectedIllustration}
                  className="flex-1"
                >
                  Generate Story
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-w-md mx-auto">
              <Button size="lg" onClick={handleGenerateStory} loading={generating}>
                Generate Random Story
              </Button>
              <div className="flex gap-3">
                <Button size="lg" variant="outline" onClick={() => setGenerationMode('topic')} className="flex-1">
                  Choose a Topic
                </Button>
                <Button size="lg" variant="outline" onClick={() => setGenerationMode('illustration')} className="flex-1">
                  From Illustration
                </Button>
              </div>
            </div>
          )}

          {generateError && (
            <p className="mt-4 text-red-500 text-sm">{generateError}</p>
          )}

          {illustrationWarning && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left max-w-md mx-auto">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm text-amber-800 font-medium mb-1">Illustration Notice</p>
                  <p className="text-sm text-amber-700">{illustrationWarning}</p>
                  <p className="text-xs text-amber-600 mt-2">Redirecting to your story...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {recentStories.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Recent Stories</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push('/library')}>
              View All
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentStories.map(story => {
              const thumbnailUrl = story.illustrations?.[0]?.imageUrl || story.source_illustration_url
              return (
                <Card
                  key={story.id}
                  hoverable
                  onClick={() => router.push(`/story/${story.id}`)}
                  className="cursor-pointer"
                >
                  {thumbnailUrl && (
                    <div className="relative -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-xl">
                      <img
                        src={thumbnailUrl}
                        alt={`Illustration for ${story.title}`}
                        className="w-full h-28 object-cover"
                      />
                      {story.is_favorited && (
                        <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow-sm">
                          <svg className="w-4 h-4 text-accent-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`flex items-start justify-between ${thumbnailUrl ? '' : 'mb-2'}`}>
                    <h3 className="font-bold text-gray-800 line-clamp-1">{story.title}</h3>
                    {!thumbnailUrl && story.is_favorited && (
                      <svg className="w-5 h-5 text-accent-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2 mt-1">{story.content.slice(0, 100)}...</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(story.created_at).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {favoriteStories.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Favorite Stories</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push('/library?filter=favorites')}>
              View All
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteStories.map(story => {
              const thumbnailUrl = story.illustrations?.[0]?.imageUrl || story.source_illustration_url
              return (
                <Card
                  key={story.id}
                  hoverable
                  onClick={() => router.push(`/story/${story.id}`)}
                  className="cursor-pointer border-2 border-accent-100"
                >
                  {thumbnailUrl && (
                    <div className="relative -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-xl">
                      <img
                        src={thumbnailUrl}
                        alt={`Illustration for ${story.title}`}
                        className="w-full h-28 object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow-sm">
                        <svg className="w-4 h-4 text-accent-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className={`flex items-start justify-between ${thumbnailUrl ? '' : 'mb-2'}`}>
                    <h3 className="font-bold text-gray-800 line-clamp-1">{story.title}</h3>
                    {!thumbnailUrl && (
                      <svg className="w-5 h-5 text-accent-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2 mt-1">{story.content.slice(0, 100)}...</p>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {stories.length === 0 && (
        <Card className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No stories yet</h3>
          <p className="text-gray-500">Generate your first story to start {selectedChild.name}'s reading adventure!</p>
        </Card>
      )}
    </div>
  )
}
