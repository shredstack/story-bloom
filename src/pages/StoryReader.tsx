import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useChild } from '../context/ChildContext';
import { useStories } from '../hooks/useStories';
import { useFontSize } from '../hooks/useFontSize';
import { Button, Card } from '../components/ui';
import { FONT_SIZE_CLASSES, type FontSize, type Story } from '../types';

export function StoryReader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedChild } = useChild();
  const { stories, toggleFavorite, deleteStory } = useStories(selectedChild?.id);
  const { fontSize, setFontSize } = useFontSize();

  const [story, setStory] = useState<Story | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id && stories.length > 0) {
      const found = stories.find(s => s.id === id);
      setStory(found || null);
    }
  }, [id, stories]);

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

  const fontSizes: FontSize[] = ['small', 'medium', 'large', 'extra-large'];

  const renderStoryContent = () => {
    return <p className={`${FONT_SIZE_CLASSES[fontSize]} whitespace-pre-wrap`}>{story.content}</p>;
  };

  const renderIllustration = () => {
    const illustrations = story.illustrations || [];
    if (illustrations.length === 0) return null;

    const illustration = illustrations[0];

    if (illustration.imageUrl) {
      return (
        <div className="mt-8 rounded-2xl overflow-hidden shadow-lg">
          <img
            src={illustration.imageUrl}
            alt={illustration.description}
            className="w-full h-auto"
          />
          <p className="text-sm text-gray-500 italic text-center py-3 px-4 bg-gray-50">
            {illustration.description}
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
        <p className="text-gray-600 italic">{illustration.description}</p>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Button>

          <div className="flex items-center gap-2">
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

        <Card className="mb-6">
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
              Created {new Date(story.created_at).toLocaleDateString()}
            </p>
          </header>

          <div className="prose prose-lg max-w-none">
            {renderStoryContent()}
          </div>

          {renderIllustration()}

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
      </div>
    </Layout>
  );
}
