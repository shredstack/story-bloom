'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useChild } from '../ProtectedLayoutClient'
import { useStories } from '@/lib/hooks/useStories'
import { Button, Input, Card } from '@/components/ui'

type FilterType = 'all' | 'favorites'

export default function LibraryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedChild } = useChild()
  const { stories, loading } = useStories(selectedChild?.id)

  const [searchQuery, setSearchQuery] = useState('')
  const filter = (searchParams.get('filter') as FilterType) || 'all'

  const setFilter = (newFilter: FilterType) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newFilter === 'all') {
      params.delete('filter')
    } else {
      params.set('filter', newFilter)
    }
    router.push(`/library?${params.toString()}`)
  }

  const filteredStories = useMemo(() => {
    let result = stories

    if (filter === 'favorites') {
      result = result.filter(s => s.is_favorited)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.content.toLowerCase().includes(query) ||
        s.custom_prompt?.toLowerCase().includes(query)
      )
    }

    return result
  }, [stories, filter, searchQuery])

  if (!selectedChild) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">No child selected</h2>
        <Button onClick={() => router.push('/profile')}>Manage Profiles</Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{selectedChild.name}'s Stories</h1>
          <p className="text-gray-600">{stories.length} stories in library</p>
        </div>
        <Button onClick={() => router.push('/dashboard')}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Story
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Stories
          </button>
          <button
            onClick={() => setFilter('favorites')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              filter === 'favorites'
                ? 'bg-accent-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill={filter === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Favorites
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin" />
          <p className="text-gray-500">Loading stories...</p>
        </div>
      ) : filteredStories.length === 0 ? (
        <Card className="text-center py-12">
          {stories.length === 0 ? (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No stories yet</h3>
              <p className="text-gray-500 mb-4">Create your first story to start building your library!</p>
              <Button onClick={() => router.push('/dashboard')}>Generate First Story</Button>
            </>
          ) : filter === 'favorites' ? (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No favorites yet</h3>
              <p className="text-gray-500">Mark stories as favorites to see them here!</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No results found</h3>
              <p className="text-gray-500">Try a different search term</p>
            </>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStories.map(story => {
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
                      className="w-full h-32 object-cover"
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
                <div className={`flex items-start justify-between ${thumbnailUrl ? '' : 'mb-3'}`}>
                  <h3 className="font-bold text-gray-800 text-lg line-clamp-1 flex-1">
                    {story.title}
                  </h3>
                  {!thumbnailUrl && story.is_favorited && (
                    <svg className="w-5 h-5 text-accent-500 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  )}
                </div>
                <p className="text-gray-600 text-sm line-clamp-3 mb-3 mt-2">
                  {story.content.slice(0, 150)}...
                </p>
                {story.custom_prompt && (
                  <p className="text-xs text-primary-600 mb-2 line-clamp-1">
                    Topic: {story.custom_prompt}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{new Date(story.created_at).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}</span>
                  <span className="text-primary-500 font-medium">Read story →</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
