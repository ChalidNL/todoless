import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/pocketbase-client';
import { pb } from '../lib/pocketbase';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string, inviteCode: string) => Promise<{ error: Error | null; user: User | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in via PocketBase authStore
    const checkAuth = async () => {
      if (pb.authStore.isValid && pb.authStore.record) {
        try {
          // Refresh auth state from PocketBase
          await pb.collection('users').authRefresh();
          const record = pb.authStore.record;
          setUser({
            id: record.id,
            email: record.email,
            name: record.name,
            firstName: record.first_name,
            lastName: record.last_name,
            displayName: record.display_name,
            role: record.role,
            avatarUrl: record.avatar,
            member_type: record.member_type || 'human',
            member_status: record.member_status,
            language: record.language || 'en',
            family_id: record.family_id,
            active: record.member_status ? record.member_status === 'active' : true,
          });
        } catch (error) {
          // Token expired or invalid
          pb.authStore.clear();
        }
      }
      setLoading(false);
    };

    checkAuth();

    // Listen to auth store changes
    const unsubscribe = pb.authStore.onChange((token, record) => {
      if (record) {
        setUser({
          id: record.id,
          email: record.email,
          name: record.name,
          firstName: record.first_name,
          lastName: record.last_name,
          displayName: record.display_name,
          role: record.role,
          avatarUrl: record.avatar,
          member_type: record.member_type || 'human',
          member_status: record.member_status,
          language: record.language || 'en',
          family_id: record.family_id,
          active: record.member_status ? record.member_status === 'active' : true,
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await api.login(email, password);
      setUser(data.user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, inviteCode: string) => {
    try {
      const data = await api.register(email, password, (firstName + ' ' + lastName).trim(), inviteCode, 'family_member');
      setUser(data.user);
      return { error: null, user: data.user };
    } catch (error) {
      return { error: error as Error, user: null };
    }
  };

  const signOut = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
