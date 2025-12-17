import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useCustomIllustrations } from '../hooks/useCustomIllustrations';
import { Button, Input, Card } from '../components/ui';
import { FileUpload } from '../components/ui/FileUpload';
import type { CustomIllustration } from '../types';

export function CustomIllustrations() {
  const { user } = useAuth();
  const { illustrations, loading, uploadIllustration, deleteIllustration, updateIllustration } = useCustomIllustrations(user?.id);

  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) {
      setUploadError('Please select a file and enter a name');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const result = await uploadIllustration(selectedFile, name.trim(), description.trim() || null);

    if (result) {
      setShowUploadForm(false);
      setSelectedFile(null);
      setName('');
      setDescription('');
    } else {
      setUploadError('Failed to upload illustration. Please try again.');
    }

    setIsUploading(false);
  };

  const handleCancelUpload = () => {
    setShowUploadForm(false);
    setSelectedFile(null);
    setName('');
    setDescription('');
    setUploadError(null);
  };

  const handleEdit = (illustration: CustomIllustration) => {
    setEditingId(illustration.id);
    setEditName(illustration.name);
    setEditDescription(illustration.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    const success = await updateIllustration(editingId, editName.trim(), editDescription.trim() || null);
    if (success) {
      setEditingId(null);
      setEditName('');
      setEditDescription('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteIllustration(id);
    setDeletingId(null);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Custom Illustrations</h1>
            <p className="text-gray-600">Upload your own illustrations to use in stories</p>
          </div>
          {!showUploadForm && (
            <Button onClick={() => setShowUploadForm(true)}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Upload Illustration
            </Button>
          )}
        </div>

        {showUploadForm && (
          <Card className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Upload New Illustration</h2>
            <div className="space-y-4">
              <FileUpload
                label="Image"
                onFileSelect={setSelectedFile}
                error={!selectedFile && uploadError ? 'Please select an image' : undefined}
              />
              <Input
                label="Name"
                placeholder="Give your illustration a name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={!name.trim() && uploadError ? 'Name is required' : undefined}
              />
              <Input
                label="Description (optional)"
                placeholder="Describe your illustration"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {uploadError && (
                <p className="text-sm text-red-500">{uploadError}</p>
              )}
              <div className="flex gap-3">
                <Button onClick={handleUpload} loading={isUploading}>
                  Upload
                </Button>
                <Button variant="outline" onClick={handleCancelUpload} disabled={isUploading}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin" />
            <p className="text-gray-500">Loading illustrations...</p>
          </div>
        ) : illustrations.length === 0 ? (
          <Card className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No illustrations yet</h3>
            <p className="text-gray-500 mb-4">Upload your first illustration to get started!</p>
            {!showUploadForm && (
              <Button onClick={() => setShowUploadForm(true)}>Upload First Illustration</Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {illustrations.map(illustration => (
              <Card key={illustration.id} className="overflow-hidden">
                <div className="aspect-square relative">
                  <img
                    src={illustration.image_url}
                    alt={illustration.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  {editingId === illustration.id ? (
                    <div className="space-y-3">
                      <Input
                        placeholder="Name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      <Input
                        placeholder="Description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-bold text-gray-800 mb-1">{illustration.name}</h3>
                      {illustration.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{illustration.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mb-3">
                        {new Date(illustration.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(illustration)}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(illustration.id)}
                          loading={deletingId === illustration.id}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
