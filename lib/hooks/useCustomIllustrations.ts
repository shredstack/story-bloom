'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CustomIllustration } from '@/lib/types'

const BUCKET_NAME = 'user-uploaded-story-illustrations'

export function useCustomIllustrations(userId: string | undefined) {
  const [illustrations, setIllustrations] = useState<CustomIllustration[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchIllustrations = useCallback(async () => {
    if (!userId) {
      setIllustrations([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('custom_illustrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching custom illustrations:', error)
      setLoading(false)
      return
    }

    setIllustrations(data || [])
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => {
    fetchIllustrations()
  }, [fetchIllustrations])

  const uploadIllustration = async (
    file: File,
    name: string,
    description: string | null
  ): Promise<CustomIllustration | null> => {
    if (!userId) return null

    const fileExt = file.name.split('.').pop()
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 9)
    const fileName = `${timestamp}-${randomId}.${fileExt}`
    const storagePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, {
        contentType: file.type,
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('Error uploading illustration:', uploadError)
      return null
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath)

    const imageUrl = publicUrlData.publicUrl

    const { data, error } = await supabase
      .from('custom_illustrations')
      .insert([{
        user_id: userId,
        name,
        description,
        image_url: imageUrl,
        storage_path: storagePath,
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating illustration record:', error)
      await supabase.storage.from(BUCKET_NAME).remove([storagePath])
      return null
    }

    setIllustrations(prev => [data, ...prev])
    return data
  }

  const deleteIllustration = async (illustrationId: string): Promise<boolean> => {
    const illustration = illustrations.find(i => i.id === illustrationId)
    if (!illustration) return false

    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([illustration.storage_path])

    if (storageError) {
      console.error('Error deleting illustration from storage:', storageError)
      return false
    }

    const { error } = await supabase
      .from('custom_illustrations')
      .delete()
      .eq('id', illustrationId)

    if (error) {
      console.error('Error deleting illustration record:', error)
      return false
    }

    setIllustrations(prev => prev.filter(i => i.id !== illustrationId))
    return true
  }

  const updateIllustration = async (
    illustrationId: string,
    name: string,
    description: string | null
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('custom_illustrations')
      .update({ name, description })
      .eq('id', illustrationId)

    if (error) {
      console.error('Error updating illustration:', error)
      return false
    }

    setIllustrations(prev =>
      prev.map(i => i.id === illustrationId ? { ...i, name, description } : i)
    )
    return true
  }

  return {
    illustrations,
    loading,
    uploadIllustration,
    deleteIllustration,
    updateIllustration,
    refreshIllustrations: fetchIllustrations,
  }
}
