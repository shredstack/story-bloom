'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Child } from '@/lib/types'
import { Header } from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'

const SELECTED_CHILD_KEY = 'storybloom-selected-child'

interface ChildContextType {
  children: Child[]
  selectedChild: Child | null
  selectChild: (child: Child) => void
  createChild: (childData: Omit<Child, 'id' | 'user_id' | 'created_at'>) => Promise<Child | null>
  updateChild: (childId: string, childData: Partial<Omit<Child, 'id' | 'user_id' | 'created_at'>>) => Promise<boolean>
  deleteChild: (childId: string) => Promise<boolean>
  refreshChildren: () => Promise<void>
  loading: boolean
}

const ChildContext = createContext<ChildContextType | null>(null)

export function useChild() {
  const context = useContext(ChildContext)
  if (!context) {
    throw new Error('useChild must be used within ProtectedLayoutClient')
  }
  return context
}

interface AuthContextType {
  user: User
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within ProtectedLayoutClient')
  }
  return context
}

interface Props {
  user: User
  initialChildren: Child[]
  children: ReactNode
}

export default function ProtectedLayoutClient({ user, initialChildren, children: pageChildren }: Props) {
  const [childrenList, setChildrenList] = useState<Child[]>(initialChildren)
  const [selectedChild, setSelectedChild] = useState<Child | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // Initialize selected child from localStorage or first child
  useEffect(() => {
    if (childrenList.length > 0) {
      const savedChildId = localStorage.getItem(SELECTED_CHILD_KEY)
      const savedChild = childrenList.find(c => c.id === savedChildId)
      setSelectedChild(savedChild || childrenList[0])
    }
  }, [childrenList])

  const selectChild = (child: Child) => {
    setSelectedChild(child)
    localStorage.setItem(SELECTED_CHILD_KEY, child.id)
  }

  const refreshChildren = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('children')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (data) {
      setChildrenList(data)
      // Update selected child if still exists
      if (selectedChild) {
        const stillExists = data.find(c => c.id === selectedChild.id)
        if (!stillExists && data.length > 0) {
          setSelectedChild(data[0])
          localStorage.setItem(SELECTED_CHILD_KEY, data[0].id)
        } else if (!stillExists) {
          setSelectedChild(null)
          localStorage.removeItem(SELECTED_CHILD_KEY)
        }
      }
    }
    setLoading(false)
  }

  const createChild = async (childData: Omit<Child, 'id' | 'user_id' | 'created_at'>): Promise<Child | null> => {
    const { data, error } = await supabase
      .from('children')
      .insert([{ ...childData, user_id: user.id }])
      .select()
      .single()

    if (error) {
      console.error('Error creating child:', error)
      return null
    }

    setChildrenList(prev => [...prev, data])
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

    setChildrenList(prev =>
      prev.map(c => c.id === childId ? { ...c, ...childData } as Child : c)
    )

    if (selectedChild?.id === childId) {
      setSelectedChild(prev => prev ? { ...prev, ...childData } as Child : null)
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

    const remaining = childrenList.filter(c => c.id !== childId)
    setChildrenList(remaining)

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

  const childContextValue: ChildContextType = {
    children: childrenList,
    selectedChild,
    selectChild,
    createChild,
    updateChild,
    deleteChild,
    refreshChildren,
    loading,
  }

  return (
    <AuthContext.Provider value={{ user }}>
      <ChildContext.Provider value={childContextValue}>
        <div className="min-h-screen flex flex-col">
          <Header
            user={user}
            children={childrenList}
            selectedChild={selectedChild}
            onSelectChild={selectChild}
          />
          <main className="flex-1">
            {pageChildren}
          </main>
        </div>
      </ChildContext.Provider>
    </AuthContext.Provider>
  )
}
