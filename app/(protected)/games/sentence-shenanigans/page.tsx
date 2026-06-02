'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useChild } from '../../ProtectedLayoutClient'
import { useSentenceShenanigans } from '@/lib/hooks/useSentenceShenanigans'
import { Button, Card } from '@/components/ui'
import { MaterialCard } from './components/MaterialCard'
import { enterFullscreen } from '@/lib/fullscreen'

export default function SentenceShenanigansPage() {
  const router = useRouter()
  const { selectedChild, children } = useChild()
  const {
    materials,
    isLoadingMaterials,
    materialsError,
    fetchMaterials,
  } = useSentenceShenanigans({ childId: selectedChild?.id || '' })

  useEffect(() => {
    if (selectedChild) {
      fetchMaterials()
    }
  }, [selectedChild, fetchMaterials])

  if (!selectedChild) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        {children.length === 0 ? (
          <Card className="py-8">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Create a profile first
            </h2>
            <p className="text-gray-600 mb-6">
              To start practicing sentences, you need to create a child profile.
            </p>
            <Button onClick={() => router.push('/onboarding')}>
              Create Profile
            </Button>
          </Card>
        ) : (
          <Card className="py-8">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Select a child
            </h2>
            <p className="text-gray-600 mb-6">
              Please select a child from the menu to start practicing.
            </p>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/games')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Games</span>
        </button>
      </div>

      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-secondary-500 to-primary-500 flex items-center justify-center shadow-lg">
          <span className="text-4xl">📖</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Sentence Shenanigans
        </h1>
        <p className="text-gray-600">
          Practice reading sentences from school materials!
        </p>
      </div>

      {/* Add New Material Button */}
      <Card className="mb-8 bg-gradient-to-br from-secondary-50 to-primary-50 border-2 border-secondary-100">
        <div className="text-center py-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Add Reading Material
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            Scan a worksheet or book page to extract sentences for practice
          </p>
          <Button
            size="lg"
            onClick={() => router.push('/games/sentence-shenanigans/upload')}
            className="bg-gradient-to-r from-secondary-500 to-primary-500 px-8"
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Material
            </span>
          </Button>
        </div>
      </Card>

      {/* Materials List */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          My Reading Materials
        </h3>

        {isLoadingMaterials && (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-secondary-200 border-t-secondary-500 animate-spin" />
            <p className="text-gray-500">Loading materials...</p>
          </div>
        )}

        {materialsError && (
          <Card className="text-center py-8">
            <p className="text-red-500 mb-4">{materialsError}</p>
            <Button onClick={fetchMaterials}>Try Again</Button>
          </Card>
        )}

        {!isLoadingMaterials && !materialsError && materials.length === 0 && (
          <Card className="text-center py-8">
            <div className="text-5xl mb-4">📚</div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">
              No materials yet
            </h4>
            <p className="text-gray-600 text-sm mb-4">
              Add your first reading material to get started!
            </p>
          </Card>
        )}

        {!isLoadingMaterials && !materialsError && materials.length > 0 && (
          <div className="space-y-4">
            {materials.map((material) => (
              <MaterialCard
                key={material.id}
                material={material}
                onPractice={() => {
                  enterFullscreen()
                  router.push(
                    `/games/sentence-shenanigans/materials/${material.id}/practice`
                  )
                }}
                onEdit={() =>
                  router.push(
                    `/games/sentence-shenanigans/materials/${material.id}`
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <Card className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4">How it works</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-secondary-600 font-bold">1</span>
            </div>
            <p className="text-gray-600">
              Take a photo or upload an image of reading material (worksheet,
              book page, etc.)
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-secondary-600 font-bold">2</span>
            </div>
            <p className="text-gray-600">
              Review and edit the extracted sentences before saving
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-secondary-600 font-bold">3</span>
            </div>
            <p className="text-gray-600">
              Practice reading each sentence out loud - earn stars for accuracy!
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-secondary-600 font-bold">4</span>
            </div>
            <p className="text-gray-600">
              Complete sessions with 85%+ accuracy to earn pet rewards!
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
