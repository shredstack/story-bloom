import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Child } from '../types';

interface ChildContextType {
  children: Child[];
  selectedChild: Child | null;
  loading: boolean;
  selectChild: (child: Child) => void;
  createChild: (child: Omit<Child, 'id' | 'user_id' | 'created_at'>) => Promise<Child | null>;
  updateChild: (id: string, updates: Partial<Child>) => Promise<boolean>;
  deleteChild: (id: string) => Promise<boolean>;
  refreshChildren: () => Promise<void>;
}

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export function ChildProvider({ children: childrenProp }: { children: ReactNode }) {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChildren = async () => {
    if (!user) {
      setChildren([]);
      setSelectedChild(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching children:', error);
      setLoading(false);
      return;
    }

    setChildren(data || []);

    if (data && data.length > 0 && !selectedChild) {
      const savedChildId = localStorage.getItem('selectedChildId');
      const savedChild = savedChildId ? data.find(c => c.id === savedChildId) : null;
      setSelectedChild(savedChild || data[0]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchChildren();
  }, [user]);

  const selectChild = (child: Child) => {
    setSelectedChild(child);
    localStorage.setItem('selectedChildId', child.id);
  };

  const createChild = async (childData: Omit<Child, 'id' | 'user_id' | 'created_at'>): Promise<Child | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('children')
      .insert([{ ...childData, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('Error creating child:', error);
      return null;
    }

    setChildren(prev => [...prev, data]);
    if (!selectedChild) {
      selectChild(data);
    }
    return data;
  };

  const updateChild = async (id: string, updates: Partial<Child>): Promise<boolean> => {
    const { error } = await supabase
      .from('children')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating child:', error);
      return false;
    }

    setChildren(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    if (selectedChild?.id === id) {
      setSelectedChild(prev => prev ? { ...prev, ...updates } : null);
    }
    return true;
  };

  const deleteChild = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting child:', error);
      return false;
    }

    const newChildren = children.filter(c => c.id !== id);
    setChildren(newChildren);

    if (selectedChild?.id === id) {
      setSelectedChild(newChildren[0] || null);
    }
    return true;
  };

  return (
    <ChildContext.Provider value={{
      children,
      selectedChild,
      loading,
      selectChild,
      createChild,
      updateChild,
      deleteChild,
      refreshChildren: fetchChildren,
    }}>
      {childrenProp}
    </ChildContext.Provider>
  );
}

export function useChild() {
  const context = useContext(ChildContext);
  if (context === undefined) {
    throw new Error('useChild must be used within a ChildProvider');
  }
  return context;
}
