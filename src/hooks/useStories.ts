import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Story, StoryGenerationResponse, Illustration, SkinTone, HairColor, EyeColor, Gender, Pronouns } from '../types';

export interface PhysicalCharacteristicsForApi {
  skinTone: SkinTone | null;
  hairColor: HairColor | null;
  eyeColor: EyeColor | null;
  gender: Gender | null;
  pronouns: Pronouns | null;
}

export interface SourceIllustrationForApi {
  url: string;
  title: string;
  description: string | null;
}

export function useStories(childId: string | undefined) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = useCallback(async () => {
    if (!childId) {
      setStories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching stories:', error);
      setLoading(false);
      return;
    }

    setStories(data || []);
    setLoading(false);
  }, [childId]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const createStory = async (
    title: string,
    content: string,
    customPrompt: string | null,
    illustrations: Illustration[] | null,
    sourceIllustrationUrl: string | null = null
  ): Promise<Story | null> => {
    if (!childId) return null;

    const { data, error } = await supabase
      .from('stories')
      .insert([{
        child_id: childId,
        title,
        content,
        custom_prompt: customPrompt,
        illustrations,
        is_favorited: false,
        source_illustration_url: sourceIllustrationUrl,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating story:', error);
      return null;
    }

    setStories(prev => [data, ...prev]);
    return data;
  };

  const toggleFavorite = async (storyId: string): Promise<boolean> => {
    const story = stories.find(s => s.id === storyId);
    if (!story) return false;

    const { error } = await supabase
      .from('stories')
      .update({ is_favorited: !story.is_favorited })
      .eq('id', storyId);

    if (error) {
      console.error('Error toggling favorite:', error);
      return false;
    }

    setStories(prev =>
      prev.map(s => s.id === storyId ? { ...s, is_favorited: !s.is_favorited } : s)
    );
    return true;
  };

  const deleteStory = async (storyId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId);

    if (error) {
      console.error('Error deleting story:', error);
      return false;
    }

    setStories(prev => prev.filter(s => s.id !== storyId));
    return true;
  };

  const updateStoryIllustrations = async (
    storyId: string,
    illustrations: Illustration[]
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('stories')
      .update({ illustrations })
      .eq('id', storyId);

    if (error) {
      console.error('Error updating story illustrations:', error);
      return false;
    }

    setStories(prev =>
      prev.map(s => s.id === storyId ? { ...s, illustrations } : s)
    );
    return true;
  };

  return {
    stories,
    loading,
    createStory,
    toggleFavorite,
    deleteStory,
    updateStoryIllustrations,
    refreshStories: fetchStories,
  };
}

export function useGenerateStory() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateStory = async (
    childName: string,
    childAge: number,
    readingLevel: string,
    favoriteThings: string[],
    parentSummary: string | null,
    customPrompt: string | null,
    sourceIllustration: SourceIllustrationForApi | null = null,
    physicalCharacteristics: PhysicalCharacteristicsForApi | null = null
  ): Promise<StoryGenerationResponse | null> => {
    setGenerating(true);
    setError(null);

    // Use AbortController for timeout - 90 seconds to account for AI generation time
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName,
          childAge,
          readingLevel,
          favoriteThings,
          parentSummary,
          customPrompt,
          sourceIllustration,
          physicalCharacteristics,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Log more details for debugging
        let responseText = '';
        try {
          responseText = await response.text();
        } catch {
          responseText = 'Could not read response body';
        }
        console.error('API returned non-JSON response:', {
          status: response.status,
          statusText: response.statusText,
          contentType,
          url: response.url,
          responsePreview: responseText.substring(0, 500),
        });

        // Provide more specific error messages based on status
        if (response.status === 504 || response.status === 524) {
          throw new Error('Story generation timed out. Please try again.');
        } else if (response.status === 502 || response.status === 503) {
          throw new Error('Server is temporarily unavailable. Please try again in a moment.');
        } else if (response.status === 404) {
          throw new Error('Story generation service not found. Please refresh the page.');
        } else {
          throw new Error('Story generation failed. Please try again.');
        }
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        throw new Error(errorData.error || 'Failed to generate story');
      }

      const data: StoryGenerationResponse = await response.json();
      return data;
    } catch (err) {
      clearTimeout(timeoutId);

      let errorMessage: string;
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'Story generation took too long. Please try again.';
        } else {
          errorMessage = err.message;
        }
      } else {
        errorMessage = 'An error occurred';
      }

      console.error('Story generation failed:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { generateStory, generating, error };
}
