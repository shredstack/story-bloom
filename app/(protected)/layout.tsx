import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProtectedLayoutClient from './ProtectedLayoutClient'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Fetch children for the header
  const { data: childrenData } = await supabase
    .from('children')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return (
    <ProtectedLayoutClient
      user={user}
      initialChildren={childrenData || []}
    >
      {children}
    </ProtectedLayoutClient>
  )
}
