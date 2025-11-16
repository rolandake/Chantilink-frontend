// src/components/ProtectedAdminRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedAdminRoute({ children }) {
  const { user, ready } = useAuth();

  // 1. ATTENDRE QUE TOUT SOIT CHARGÉ
  if (!ready) {
    return <LoadingSpinner fullScreen message="Vérification des privilèges..." />;
  }

  // 2. PAS D'UTILISATEUR → LOGIN
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // 3. RÔLE NON CHARGÉ → ATTENDRE (ÉVITE LE BUG)
  if (!user.role) {
    return <LoadingSpinner fullScreen message="Chargement du rôle..." />;
  }

  // 4. VÉRIFICATION FINALE
  const isAdminUser = ['admin', 'superadmin'].includes(user.role);
  if (!isAdminUser) {
    return <Navigate to="/" replace />;
  }

  // 5. ACCÈS AUTORISÉ
  return children;
}