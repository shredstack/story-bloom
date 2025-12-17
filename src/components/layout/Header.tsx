import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChild } from '../../context/ChildContext';
import { Button } from '../ui';

export function Header() {
  const { user, signOut } = useAuth();
  const { children, selectedChild, selectChild } = useChild();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
            StoryBloom
          </span>
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            {children.length > 1 && (
              <select
                value={selectedChild?.id || ''}
                onChange={(e) => {
                  const child = children.find(c => c.id === e.target.value);
                  if (child) selectChild(child);
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:border-primary-400"
              >
                {children.map(child => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            )}

            <nav className="flex items-center gap-2">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Link to="/library">
                <Button variant="ghost" size="sm">Library</Button>
              </Link>
              <Link to="/illustrations">
                <Button variant="ghost" size="sm">Illustrations</Button>
              </Link>
              <Link to="/profile">
                <Button variant="ghost" size="sm">Profiles</Button>
              </Link>
            </nav>

            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
