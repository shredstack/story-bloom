import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useChild } from '../context/ChildContext';
import { useStories } from '../hooks/useStories';
import { useCustomIllustrations } from '../hooks/useCustomIllustrations';
import { useFontSize } from '../hooks/useFontSize';
import { Button, Card } from '../components/ui';
import { FONT_SIZE_CLASSES, type FontSize, type Story, type CustomIllustration } from '../types';

export function StoryReader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedChild } = useChild();
  const { stories, loading: storiesLoading, toggleFavorite, deleteStory, updateStoryIllustrations } = useStories(selectedChild?.id);
  const { illustrations: customIllustrations } = useCustomIllustrations(user?.id);
  const { fontSize, setFontSize } = useFontSize();

  const [story, setStory] = useState<Story | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showIllustrationPicker, setShowIllustrationPicker] = useState(false);
  const [savingIllustration, setSavingIllustration] = useState(false);

  useEffect(() => {
    if (id && stories.length > 0) {
      const found = stories.find(s => s.id === id);
      setStory(found || null);
    }
  }, [id, stories]);

  // Set font size to child's default when story loads
  useEffect(() => {
    if (selectedChild?.default_text_size) {
      setFontSize(selectedChild.default_text_size);
    }
  }, [selectedChild, setFontSize]);

  if (storiesLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-medium text-gray-600">Loading story...</h2>
          </div>
        </div>
      </Layout>
    );
  }

  if (!story) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Story not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </Layout>
    );
  }

  const handleToggleFavorite = async () => {
    await toggleFavorite(story.id);
  };

  const handleDelete = async () => {
    const success = await deleteStory(story.id);
    if (success) {
      navigate('/library');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSelectCustomIllustration = async (customIllustration: CustomIllustration) => {
    if (!story) return;

    setSavingIllustration(true);
    const newIllustration = {
      description: customIllustration.description || customIllustration.name,
      position: 0,
      imageUrl: customIllustration.image_url,
      customIllustrationId: customIllustration.id,
    };

    const existingIllustrations = story.illustrations || [];
    const updatedIllustrations = [newIllustration, ...existingIllustrations.filter(i => !i.customIllustrationId)];

    const success = await updateStoryIllustrations(story.id, updatedIllustrations);
    if (success) {
      setStory(prev => prev ? { ...prev, illustrations: updatedIllustrations } : null);
    }
    setSavingIllustration(false);
    setShowIllustrationPicker(false);
  };

  const handleRemoveCustomIllustration = async () => {
    if (!story) return;

    setSavingIllustration(true);
    const updatedIllustrations = (story.illustrations || []).filter(i => !i.customIllustrationId);

    const success = await updateStoryIllustrations(story.id, updatedIllustrations);
    if (success) {
      setStory(prev => prev ? { ...prev, illustrations: updatedIllustrations } : null);
    }
    setSavingIllustration(false);
  };

  const fontSizes: FontSize[] = ['small', 'medium', 'large', 'extra-large'];
  const customIllustration = story?.illustrations?.find(i => i.customIllustrationId);

  const renderStoryContent = () => {
    return <p className={`${FONT_SIZE_CLASSES[fontSize]} whitespace-pre-wrap`}>{story.content}</p>;
  };

  const renderIllustration = () => {
    const illustrations = story.illustrations || [];
    // Get generated (non-custom) illustration
    const generatedIllustration = illustrations.find(i => !i.customIllustrationId);

    if (!generatedIllustration) return null;

    if (generatedIllustration.imageUrl) {
      return (
        <div className="mt-8 rounded-2xl overflow-hidden shadow-lg">
          <img
            src={generatedIllustration.imageUrl}
            alt={generatedIllustration.description}
            className="w-full h-auto"
          />
          <p className="text-sm text-gray-500 italic text-center py-3 px-4 bg-gray-50">
            {generatedIllustration.description}
          </p>
        </div>
      );
    }

    // Fallback for stories without generated images
    return (
      <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-primary-50 to-secondary-50 border-2 border-dashed border-primary-200">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-primary-600">Illustration</span>
        </div>
        <p className="text-gray-600 italic">{generatedIllustration.description}</p>
      </div>
    );
  };

  const renderCustomIllustrationSection = () => {
    // If no custom illustration, hide the entire section when printing
    if (!customIllustration) {
      return (
        <div className="mt-8 no-print">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Custom Illustration</h3>
            <Button size="sm" variant="outline" onClick={() => setShowIllustrationPicker(true)}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Illustration
            </Button>
          </div>
          <div
            onClick={() => setShowIllustrationPicker(true)}
            className="p-8 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 text-center cursor-pointer hover:border-secondary-300 hover:bg-secondary-50/30 transition-colors"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Add a custom illustration from your library</p>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Custom Illustration</h3>
          <div className="flex gap-2 no-print">
            <Button size="sm" variant="outline" onClick={() => setShowIllustrationPicker(true)}>
              Change
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRemoveCustomIllustration}
              loading={savingIllustration}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              Remove
            </Button>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-lg border-2 border-secondary-200">
          <img
            src={customIllustration.imageUrl}
            alt={customIllustration.description}
            className="w-full h-auto"
          />
          <p className="text-sm text-gray-500 italic text-center py-3 px-4 bg-secondary-50">
            {customIllustration.description}
          </p>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8 print-story">
        <div className="flex items-center justify-between mb-6 no-print">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
              title="Print story"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>

            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-lg transition-colors ${
                story.is_favorited
                  ? 'text-accent-500 bg-accent-50 hover:bg-accent-100'
                  : 'text-gray-400 hover:text-accent-500 hover:bg-gray-100'
              }`}
            >
              <svg
                className="w-6 h-6"
                fill={story.is_favorited ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <Card className="mb-6 no-print">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-500">Font Size</span>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {fontSizes.map(size => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    fontSize === size
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {size === 'small' && 'A'}
                  {size === 'medium' && 'A+'}
                  {size === 'large' && 'A++'}
                  {size === 'extra-large' && 'A+++'}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <article className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <header className="mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              {story.title}
            </h1>
            {story.custom_prompt && (
              <p className="text-sm text-gray-500 italic">
                Inspired by: "{story.custom_prompt}"
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Created {new Date(story.created_at).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </header>

          <div className="prose prose-lg max-w-none">
            {renderStoryContent()}
          </div>

          {renderIllustration()}

          {renderCustomIllustrationSection()}

          <footer className="mt-12 pt-8 border-t border-gray-100 text-center">
            <p className="text-gray-500 font-medium">The End</p>
            <div className="flex justify-center gap-4 mt-4">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                New Story
              </Button>
              <Button variant="ghost" onClick={() => navigate('/library')}>
                Story Library
              </Button>
            </div>
          </footer>
        </article>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-sm w-full">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Story?</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete "{story.title}"? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  className="flex-1 bg-red-500 hover:bg-red-600"
                >
                  Delete
                </Button>
              </div>
            </Card>
          </div>
        )}

        {showIllustrationPicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Choose an Illustration</h3>
                <button
                  onClick={() => setShowIllustrationPicker(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {customIllustrations.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-4">You haven't uploaded any illustrations yet.</p>
                  <Button onClick={() => navigate('/illustrations')}>
                    Go to Illustrations
                  </Button>
                </div>
              ) : (
                <div className="overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {customIllustrations.map(illustration => (
                      <button
                        key={illustration.id}
                        onClick={() => handleSelectCustomIllustration(illustration)}
                        disabled={savingIllustration}
                        className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          customIllustration?.customIllustrationId === illustration.id
                            ? 'border-secondary-500 ring-2 ring-secondary-200'
                            : 'border-gray-200 hover:border-secondary-300'
                        } ${savingIllustration ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <img
                          src={illustration.image_url}
                          alt={illustration.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-white text-sm font-medium truncate">{illustration.name}</p>
                          </div>
                        </div>
                        {customIllustration?.customIllustrationId === illustration.id && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-secondary-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <Button variant="outline" onClick={() => setShowIllustrationPicker(false)}>
                  Cancel
                </Button>
                <Button variant="ghost" onClick={() => navigate('/illustrations')}>
                  Manage Illustrations
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
