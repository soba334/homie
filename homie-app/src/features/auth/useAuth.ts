import { useCallback, createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import { MeResponseSchema } from '@/lib/schemas';
import type { MeResponse } from '@/lib/schemas';

export type { HomeMember } from '@/lib/schemas/auth';

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
  const queryClient = useQueryClient();

  const { data: user, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => api.getWithSchema('/api/v1/auth/me', MeResponseSchema),
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const login = useCallback(() => {
    window.location.href = `${API_BASE}/api/v1/auth/google`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // ignore
    }
    queryClient.clear();
  }, [queryClient]);

  const refetchMe = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return { user: user ?? null, loading, login, logout, refetchMe };
}

export function useAuth() {
  return useContext(AuthContext);
}
