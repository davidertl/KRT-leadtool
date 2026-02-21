import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';

function App() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-krt-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-krt-accent mx-auto mb-4" />
          <p className="text-gray-400">Loading KRT Leadtool...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1f2e',
            color: '#e5e7eb',
            border: '1px solid #374151',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#1a1f2e' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#1a1f2e' }, duration: 5000 },
        }}
      />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/" element={user ? <DashboardPage /> : <Navigate to="/login" />} />
        <Route path="/map/:missionId" element={user ? <MapPage /> : <Navigate to="/login" />} />
      </Routes>
      <div className="fixed bottom-1 left-1 text-[10px] text-gray-700 pointer-events-none select-none z-[9999]">
        v{__APP_VERSION__}
      </div>
    </>
  );
}

export default App;
