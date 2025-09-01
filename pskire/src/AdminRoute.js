// src/components/AdminRoute.js
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

function AdminRoute() {
  const { currentUser } = useAuth();
  
  // Kullanıcı giriş yapmamışsa veya rolü admin/moderator değilse anasayfaya yönlendir.
  const isAuthorized = currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'moderator');

  return isAuthorized ? <Outlet /> : <Navigate to="/" />;
}

export default AdminRoute;

