'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore, useHasHydrated } from '@/store';
import { api } from '@/lib/api';
import { AppInitializer } from '@/components/AppInitializer';

// 使用 useMemo 确保 QueryClient 只创建一次
let queryClientInstance: QueryClient | null = null;
const getQueryClient = () => {
  if (!queryClientInstance) {
    queryClientInstance = new QueryClient();
  }
  return queryClientInstance;
};

// 全局加载组件
function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <div className="text-muted-foreground">加载中...</div>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const { user, token, setUser, setToken, logout } = useAppStore();
  const hasHydrated = useHasHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useMemo(() => getQueryClient(), []);

  // 401 未授权处理回调
  const handleUnauthorized = useCallback(() => {
    console.log('[Providers] 401 Unauthorized, clearing state');
    logout();
  }, [logout]);

  // 设置 API 401 回调
  useEffect(() => {
    api.setOnUnauthorized(handleUnauthorized);
  }, [handleUnauthorized]);

  // 当 hydration 完成时，立即同步 token 到 api client
  useEffect(() => {
    if (hasHydrated && token) {
      api.setToken(token);
    }
  }, [token, hasHydrated]);

  // 验证 token 并获取用户信息（仅在刷新页面时需要）
  useEffect(() => {
    if (!hasHydrated) return;

    if (token && !user) {
      // 确保 token 已设置
      api.setToken(token);
      api
        .getMe()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          // Token 无效，清除状态
          setToken(null);
          setUser(null);
        });
    }
  }, [token, user, setUser, setToken, hasHydrated]);

  // hydration 完成前显示加载状态
  if (!hasHydrated) {
    return (
      <QueryClientProvider client={queryClient}>
        <GlobalLoading />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppInitializer>{children}</AppInitializer>
      {/* Toaster 已移到 layout.tsx */}
    </QueryClientProvider>
  );
}
