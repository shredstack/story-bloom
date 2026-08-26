'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useChild } from '../../ProtectedLayoutClient'
import { useStrugglingWords } from '@/lib/hooks/useStrugglingWords'
import { useAppSettings } from '@/lib/hooks/useAppSettings'
import { Button, Input, Card, TextArea, NumberInput } from '@/components/ui'
import { VoiceRecordButton } from '@/components/VoiceRecordButton'
import { ReadingTapReviewQueue } from '@/components/parent/ReadingTapReviewQueue'
import { MASTERY_STAGE_INFO, type StrugglingWord, type WordMasteryStage } from '@/lib/types'
import { DEFAULT_FOCUS_REPEATS } from '@/lib/games/wordRescueSelection'

type TabFilter = 'all' | 'focus' | WordMasteryStage

export default function ParentStrugglingWordsPage() {
  const router = useRouter()
  const { children, selectedChild, selectChild } = useChild()
  const [activeTab, setActiveTab] = useState<TabFilter>('all')

  // Word management
  const {
    words,
    stats,
    isLoading,
    error,
    addWord,
    addWords,
    deleteWord,
    setWordFocus,
    refetch,
  } = useStrugglingWords({ childId: selectedChild?.id || '', autoFetch: !!selectedChild })

  // Settings
  const { settings, updateSettings } = useAppSettings()

  // Add word form state
  const [inputMode, setInputMode] = useState<'single' | 'bulk'>('single')
  const [singleWord, setSingleWord] = useState('')
  const [bulkWords, setBulkWords] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addResult, setAddResult] = useState<string | null>(null)

  // Word to delete
  const [deletingWordId, setDeletingWordId] = useState<string | null>(null)

  // Word whose star is being saved
  const [focusingWordId, setFocusingWordId] = useState<string | null>(null)

  // Track local audio changes for immediate UI update
  const [localAudioUpdates, setLocalAudioUpdates] = useState<
    Record<string, { url: string | null; storagePath: string | null }>
  >({})

  // Handle audio change from VoiceRecordButton
  const handleAudioChange = (
    wordId: string,
    audioUrl: string | null,
    storagePath: string | null
  ) => {
    setLocalAudioUpdates((prev) => ({
      ...prev,
      [wordId]: { url: audioUrl, storagePath },
    }))
  }

  // Get the current audio URL for a word (local update takes precedence)
  const getWordAudioUrl = (word: StrugglingWord) => {
    return localAudioUpdates[word.id]?.url ?? word.parent_audio_url
  }

  const getWordStoragePath = (word: StrugglingWord) => {
    return localAudioUpdates[word.id]?.storagePath ?? word.parent_audio_storage_path
  }

  // Filter words based on active tab
  const filteredWords =
    activeTab === 'all'
      ? words
      : activeTab === 'focus'
        ? words.filter((w) => (w.focus_repeats || 0) > 0)
        : words.filter((w) => w.current_stage === activeTab)

  const handleToggleFocus = async (word: StrugglingWord) => {
    setFocusingWordId(word.id)
    await setWordFocus(word.id, (word.focus_repeats || 0) > 0 ? 0 : DEFAULT_FOCUS_REPEATS)
    setFocusingWordId(null)
  }

  const handleAddSingle = async () => {
    if (!singleWord.trim()) return
    setIsAdding(true)
    setAddResult(null)

    const result = await addWord(singleWord.trim())

    if (result.success) {
      setSingleWord('')
      setAddResult(result.alreadyExisted ? 'Word already in list!' : 'Word added!')
    } else {
      setAddResult('Failed to add word')
    }

    setIsAdding(false)
    setTimeout(() => setAddResult(null), 3000)
  }

  const handleAddBulk = async () => {
    if (!bulkWords.trim()) return
    setIsAdding(true)
    setAddResult(null)

    // Parse words - support comma, newline, or space separated
    const wordList = bulkWords
      .split(/[,\n\s]+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length >= 2)

    const result = await addWords(wordList)

    setBulkWords('')
    setAddResult(
      `Added ${result.added} words${result.existing > 0 ? `, ${result.existing} already existed` : ''}${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`
    )

    setIsAdding(false)
    setTimeout(() => setAddResult(null), 5000)
  }

  const handleDelete = async (wordId: string) => {
    setDeletingWordId(wordId)
    await deleteWord(wordId)
    setDeletingWordId(null)
  }

  // No child selected
  if (!selectedChild) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">No Child Selected</h2>
          <p className="text-gray-600 mb-4">
            Please select a child from the dropdown in the header to manage their word list.
          </p>
          <Link href="/profile">
            <Button>Go to Profile</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedChild.name}&apos;s Word List
          </h1>
          <p className="text-gray-600">
            Manage struggling words for practice in Word Rescue
          </p>
        </div>
        <Link href="/games/word-rescue">
          <Button variant="outline">Back to Word Rescue</Button>
        </Link>
      </div>

      {/* Words she asked to hear while reading — parent confirms before any
          of them reach the practice list. */}
      <ReadingTapReviewQueue
        childId={selectedChild.id}
        childName={selectedChild.name}
        onAddWord={addWord}
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total</div>
        </Card>
        {(['seedling', 'growing', 'blooming', 'mastered'] as const).map((stage) => (
          <Card key={stage} className="p-4 text-center">
            <div className={`text-2xl font-bold ${MASTERY_STAGE_INFO[stage].color}`}>
              {MASTERY_STAGE_INFO[stage].emoji} {stats[stage]}
            </div>
            <div className="text-sm text-gray-600">{MASTERY_STAGE_INFO[stage].label}</div>
          </Card>
        ))}
      </div>

      {/* Add Words Section */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Add Words to Practice</h2>
        <p className="text-gray-600 mb-4">
          Add words from teacher lists, spelling homework, or any words {selectedChild.name} needs to practice.
        </p>

        {/* Toggle between single and bulk */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={inputMode === 'single' ? 'primary' : 'outline'}
            onClick={() => setInputMode('single')}
            size="sm"
          >
            Add One Word
          </Button>
          <Button
            variant={inputMode === 'bulk' ? 'primary' : 'outline'}
            onClick={() => setInputMode('bulk')}
            size="sm"
          >
            Add Multiple Words
          </Button>
        </div>

        {inputMode === 'single' ? (
          <div className="flex gap-2">
            <Input
              value={singleWord}
              onChange={(e) => setSingleWord(e.target.value)}
              placeholder="Type a word..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
            />
            <Button onClick={handleAddSingle} disabled={isAdding || !singleWord.trim()}>
              {isAdding ? 'Adding...' : 'Add Word'}
            </Button>
          </div>
        ) : (
          <div>
            <TextArea
              value={bulkWords}
              onChange={(e) => setBulkWords(e.target.value)}
              placeholder={`Paste or type multiple words here...

Examples:
because, friend, said

or one word per line:
because
friend
said`}
              className="w-full h-32 resize-none"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-500">
                {bulkWords.trim()
                  ? `${bulkWords.split(/[,\n\s]+/).filter((w) => w.trim().length >= 2).length} words detected`
                  : 'Separate words with commas, spaces, or new lines'}
              </span>
              <Button onClick={handleAddBulk} disabled={isAdding || !bulkWords.trim()}>
                {isAdding ? 'Adding...' : 'Add All Words'}
              </Button>
            </div>
          </div>
        )}

        {/* Result message */}
        {addResult && (
          <div className="mt-3 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
            {addResult}
          </div>
        )}
      </Card>

      {/* Word List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold">Current Word List</h2>
          <span className="text-sm text-gray-500">{filteredWords.length} words</span>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Tap ⭐ to put a word at the front of {selectedChild.name}&apos;s next{' '}
          {DEFAULT_FOCUS_REPEATS} Word Rescue sessions. Starred words go first, but
          never fill more than half a session — the rest of the list still gets
          practiced. When a star runs out, tap it again for another{' '}
          {DEFAULT_FOCUS_REPEATS}.
        </p>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setActiveTab('focus')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'focus'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⭐ Focus ({stats.focused})
          </button>
          {(['seedling', 'growing', 'blooming', 'mastered'] as const).map((stage) => (
            <button
              key={stage}
              onClick={() => setActiveTab(stage)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                activeTab === stage
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {MASTERY_STAGE_INFO[stage].emoji} {MASTERY_STAGE_INFO[stage].label} ({stats[stage]})
            </button>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500">Loading words...</div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-red-50 text-red-800 rounded-lg mb-4">
            {error}
            <Button variant="outline" size="sm" className="ml-4" onClick={refetch}>
              Try Again
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && filteredWords.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {activeTab === 'all' ? (
              <>
                <p className="mb-2">No words yet!</p>
                <p className="text-sm">
                  Words will be automatically added when {selectedChild.name} practices Sentence Shenanigans,
                  or you can add them manually above.
                </p>
              </>
            ) : activeTab === 'focus' ? (
              <p>No focus words — tap ⭐ next to a word to practice it first.</p>
            ) : (
              <p>No {MASTERY_STAGE_INFO[activeTab].label.toLowerCase()} words</p>
            )}
          </div>
        )}

        {/* Word list */}
        {!isLoading && filteredWords.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-sm text-gray-500 border-b">
                <tr>
                  <th className="pb-2 pr-4">Focus</th>
                  <th className="pb-2 pr-4">Word</th>
                  <th className="pb-2 pr-4">Stage</th>
                  <th className="pb-2 pr-4">Progress</th>
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2 pr-4">Voice</th>
                  <th className="pb-2 pr-4">Added</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredWords.map((word) => (
                  <tr key={word.id} className="text-sm">
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => handleToggleFocus(word)}
                        disabled={focusingWordId === word.id}
                        aria-pressed={(word.focus_repeats || 0) > 0}
                        aria-label={
                          (word.focus_repeats || 0) > 0
                            ? `Stop focusing on ${word.word}`
                            : `Focus on ${word.word} for the next ${DEFAULT_FOCUS_REPEATS} sessions`
                        }
                        title={
                          (word.focus_repeats || 0) > 0
                            ? `${word.focus_repeats} more ${word.focus_repeats === 1 ? 'session' : 'sessions'}`
                            : 'Practice this next'
                        }
                        className="flex items-center gap-1 disabled:opacity-50"
                      >
                        <span className={(word.focus_repeats || 0) > 0 ? '' : 'grayscale opacity-40'}>
                          ⭐
                        </span>
                        {(word.focus_repeats || 0) > 0 && (
                          <span className="text-xs text-gray-500">×{word.focus_repeats}</span>
                        )}
                      </button>
                    </td>
                    <td className="py-3 pr-4 font-medium">{word.word}</td>
                    <td className="py-3 pr-4">
                      <span className={MASTERY_STAGE_INFO[word.current_stage].color}>
                        {MASTERY_STAGE_INFO[word.current_stage].emoji}{' '}
                        {MASTERY_STAGE_INFO[word.current_stage].label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {word.times_correct}/{word.times_practiced} correct
                    </td>
                    <td className="py-3 pr-4 text-gray-500">
                      {word.source === 'manual' && 'Added manually'}
                      {word.source === 'sentence_shenanigans' && 'From practice'}
                      {word.source === 'word_quest' && 'From Word Quest'}
                    </td>
                    <td className="py-3 pr-4">
                      <VoiceRecordButton
                        wordId={word.id}
                        childId={selectedChild.id}
                        word={word.word}
                        currentAudioUrl={getWordAudioUrl(word)}
                        currentStoragePath={getWordStoragePath(word)}
                        onAudioChange={(url, path) =>
                          handleAudioChange(word.id, url, path)
                        }
                      />
                    </td>
                    <td className="py-3 pr-4 text-gray-500">
                      {new Date(word.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(word.id)}
                        disabled={deletingWordId === word.id}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        {deletingWordId === word.id ? '...' : 'Delete'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Settings Section */}
      <Card className="p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">Word Rescue Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mastery Threshold (times correct)
            </label>
            <NumberInput
              value={settings?.mastery_correct_threshold ?? 2}
              onChange={(value) => updateSettings({ mastery_correct_threshold: value })}
              min={1}
              max={10}
              step={1}
              decimals={0}
            />
            <p className="text-sm text-gray-500 mt-2">
              How many times {selectedChild.name} must say a word correctly for it to be mastered
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Words per Session
            </label>
            <NumberInput
              value={settings?.words_per_session ?? 10}
              onChange={(value) => updateSettings({ words_per_session: value })}
              min={5}
              max={20}
              step={1}
              decimals={0}
            />
            <p className="text-sm text-gray-500 mt-2">
              How many words to practice in each Word Rescue session
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showWordCoach"
              checked={settings?.show_word_coach_automatically ?? true}
              onChange={(e) =>
                updateSettings({ show_word_coach_automatically: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            <label htmlFor="showWordCoach" className="text-sm text-gray-700">
              Automatically show Word Coach for new words (helps {selectedChild.name} learn pronunciation)
            </label>
          </div>
        </div>
      </Card>
    </div>
  )
}
