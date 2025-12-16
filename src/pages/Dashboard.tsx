import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useChild } from '../context/ChildContext';
import { useStories, useGenerateStory } from '../hooks/useStories';
import { Button, TextArea, Card } from '../components/ui';

export function Dashboard() {
  const navigate = useNavigate();
  const { selectedChild, children } = useChild();
  const { stories, createStory } = useStories(selectedChild?.id);
  const { generateStory, generating, error: generateError } = useGenerateStory();

  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);

  const handleGenerateStory = async () => {
    if (!selectedChild) return;

    const result = await generateStory(
      selectedChild.name,
      selectedChild.age,
      selectedChild.reading_level,
      selectedChild.favorite_things,
      selectedChild.parent_summary,
      customPrompt.trim() || null
    );

    if (result) {
      const story = await createStory(
        result.title,
        result.content,
        customPrompt.trim() || null,
        result.illustrations
      );

      if (story) {
        navigate(`/story/${story.id}`);
      }
    }
  };

  if (!selectedChild) {
    if (children.length === 0) {
      return (
        <Layout>
          <div className="max-w-4xl mx-auto px-4 py-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">No child profiles yet</h2>
            <p className="text-gray-600 mb-6">Create a profile to start generating personalized stories!</p>
            <Button onClick={() => navigate('/onboarding')}>Create First Profile</Button>
          </div>
        </Layout>
      );
    }
    return null;
  }

  const recentStories = stories.slice(0, 3);
  const favoriteStories = stories.filter(s => s.is_favorited).slice(0, 3);

  return (
    <Layout>
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

            {showPromptInput ? (
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
                    onClick={() => {
                      setShowPromptInput(false);
                      setCustomPrompt('');
                    }}
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
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" onClick={handleGenerateStory} loading={generating}>
                  Generate Random Story
                </Button>
                <Button size="lg" variant="outline" onClick={() => setShowPromptInput(true)}>
                  Choose a Topic
                </Button>
              </div>
            )}

            {generateError && (
              <p className="mt-4 text-red-500 text-sm">{generateError}</p>
            )}
          </div>
        </Card>

        {recentStories.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Recent Stories</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/library')}>
                View All
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentStories.map(story => (
                <Card
                  key={story.id}
                  hoverable
                  onClick={() => navigate(`/story/${story.id}`)}
                  className="cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-800 line-clamp-1">{story.title}</h3>
                    {story.is_favorited && (
                      <svg className="w-5 h-5 text-accent-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2">{story.content.slice(0, 100)}...</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(story.created_at).toLocaleDateString()}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {favoriteStories.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Favorite Stories</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/library?filter=favorites')}>
                View All
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favoriteStories.map(story => (
                <Card
                  key={story.id}
                  hoverable
                  onClick={() => navigate(`/story/${story.id}`)}
                  className="cursor-pointer border-2 border-accent-100"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-800 line-clamp-1">{story.title}</h3>
                    <svg className="w-5 h-5 text-accent-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2">{story.content.slice(0, 100)}...</p>
                </Card>
              ))}
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
    </Layout>
  );
}
