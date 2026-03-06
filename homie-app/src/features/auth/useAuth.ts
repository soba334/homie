import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api, API_BASE, ApiError } from '@/utils/api';

export interface HomeMember {
  id: string;
  name: string;
  displayName?: string;
  email: string;
  avatarUrl?: string;
  role: string;
}

interface MeResponse {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatarUrl?: string;
  home?: {
    id: string;
    name: string;
    members: HomeMember[];
  };
}

interface AuthContextType {
  user: MeResponse | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetchMe: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  refetchMe: async () => {},
});

export function useAuthProvider() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<MeResponse>('/api/v1/auth/me');
      setUser(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Try refresh
        try {
          await api.post('/api/v1/auth/refresh');
          const data = await api.get<MeResponse>('/api/v1/auth/me');
          setUser(data);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(() => {
    window.location.href = `${API_BASE}/api/v1/auth/google`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  return { user, loading, login, logout, refetchMe: fetchMe };
}

export function useAuth() {
  return useContext(AuthContext);
}
