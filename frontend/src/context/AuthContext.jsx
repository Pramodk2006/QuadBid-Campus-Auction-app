import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getAuthToken, setAuthToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getAuthToken());
  const [loading, setLoading] = useState(true);

  // Load existing session on startup
  useEffect(() => {
    async function loadUser() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const profile = await api.getMe();
        setUser(profile);
      } catch (err) {
        console.warn('Session expired or invalid, logging out:', err.message);
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const loginWithDev = async (studentData) => {
    const data = await api.devLogin(studentData);
    setAuthToken(data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const loginWithToken = async (accessToken) => {
    setAuthToken(accessToken);
    setToken(accessToken);
    const profile = await api.getMe();
    setUser(profile);
    return profile;
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        loginWithDev,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

