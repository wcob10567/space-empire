import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-cyan-400 text-xl tracking-widest animate-pulse">
          Loading Empire...
        </div>
      </div>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}

function GamePlaceholder() {
  const { profile, signOut } = useAuth()
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-cyan-400 mb-2">
          Welcome, Commander {profile?.username}
        </h1>
        <p className="text-gray-400 mb-6">Your empire awaits. Game UI coming soon.</p>
        <button
          onClick={signOut}
          className="px-6 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg transition-all"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <GamePlaceholder />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}