'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Child } from '@/lib/types'

const SELECTED_CHILD_KEY = 'storybloom-selected-child'

export function useChildren(userId: string | undefined) {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<Child | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchChildren = useCallback(async () => {
    if (!userId) {
      setChildren([])
      setSelectedChild(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching children:', error)
      setLoading(false)
      return
    }

    setChildren(data || [])

    // Restore selected child from localStorage or select first
    if (data && data.length > 0) {
      const savedChildId = localStorage.getItem(SELECTED_CHILD_KEY)
      const savedChild = data.find(c => c.id === savedChildId)
      setSelectedChild(savedChild || data[0])
    } else {
      setSelectedChild(null)
    }

    setLoading(false)
  }, [userId, supabase])

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  const selectChild = (child: Child) => {
    setSelectedChild(child)
    localStorage.setItem(SELECTED_CHILD_KEY, child.id)
  }

  const createChild = async (childData: Omit<Child, 'id' | 'user_id' | 'created_at'>): Promise<Child | null> => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('children')
      .insert([{ ...childData, user_id: userId }])
      .select()
      .single()

    if (error) {
      console.error('Error creating child:', error)
      return null
    }

    setChildren(prev => [...prev, data])
    setSelectedChild(data)
    localStorage.setItem(SELECTED_CHILD_KEY, data.id)
    return data
  }

  const updateChild = async (childId: string, childData: Partial<Omit<Child, 'id' | 'user_id' | 'created_at'>>): Promise<boolean> => {
    const { error } = await supabase
      .from('children')
      .update(childData)
      .eq('id', childId)

    if (error) {
      console.error('Error updating child:', error)
      return false
    }

    setChildren(prev =>
      prev.map(c => c.id === childId ? { ...c, ...childData } : c)
    )

    if (selectedChild?.id === childId) {
      setSelectedChild(prev => prev ? { ...prev, ...childData } : null)
    }

    return true
  }

  const deleteChild = async (childId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', childId)

    if (error) {
      console.error('Error deleting child:', error)
      return false
    }

    const remaining = children.filter(c => c.id !== childId)
    setChildren(remaining)

    if (selectedChild?.id === childId) {
      const newSelected = remaining[0] || null
      setSelectedChild(newSelected)
      if (newSelected) {
        localStorage.setItem(SELECTED_CHILD_KEY, newSelected.id)
      } else {
        localStorage.removeItem(SELECTED_CHILD_KEY)
      }
    }

    return true
  }

  return {
    children,
    selectedChild,
    loading,
    selectChild,
    createChild,
    updateChild,
    deleteChild,
    refreshChildren: fetchChildren,
  }
}
