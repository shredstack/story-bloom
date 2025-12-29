'use client'

import { createClient } from '@/lib/supabase/client'

const BUCKET_NAME = 'user-profile-images'

interface ProfileImageResult {
  url: string
  storagePath: string
}

export async function uploadProfileImage(
  userId: string,
  file: File
): Promise<ProfileImageResult | null> {
  const supabase = createClient()

  const fileExt = file.name.split('.').pop() || 'jpg'
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
    console.error('Error uploading profile image:', uploadError)
    return null
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath)

  return {
    url: publicUrlData.publicUrl,
    storagePath,
  }
}

export async function deleteProfileImage(storagePath: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath])

  if (error) {
    console.error('Error deleting profile image:', error)
    return false
  }

  return true
}
