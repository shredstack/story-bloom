'use client'

import Link from 'next/link'
import { useChild } from '../../../ProtectedLayoutClient'
import { Button, Card } from '@/components/ui'
import { MyFindsGallery } from '../components/MyFindsGallery'

export default function MyFindsPage() {
  const { selectedChild } = useChild()

  if (!selectedChild) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">No Child Selected</h2>
          <p className="text-gray-600 mb-4">
            Please select a child from the dropdown in the header.
          </p>
          <Link href="/profile">
            <Button>Go to Profile</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Finds 📷</h1>
          <p className="text-gray-600">
            Everything {selectedChild.name} has found on hunts!
          </p>
        </div>
        <Link href="/games/scavenger-hunt">
          <Button variant="outline">New Hunt</Button>
        </Link>
      </div>

      <MyFindsGallery childId={selectedChild.id} />
    </div>
  )
}
