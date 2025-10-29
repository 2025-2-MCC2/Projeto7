import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export default function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Carregando…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}