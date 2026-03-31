'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAppStore, useHasHydrated, isPMOrAdmin } from '@/store';
import { api } from '@/lib/api';

interface AppInitializerProps {
  children: React.ReactNode;
}

// 全局加载组件
function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <div className="text-muted-foreground">加载中...</div>
      </div>
    </div>
  );
}

// 不需要版本检查的页面
const PUBLIC_PATHS = ['/login'];
const ONBOARD_PATH = '/onboard';

export function AppInitializer({ children }: AppInitializerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, onboardingStatus } = useAppStore();
  const hasHydrated = useHasHydrated();

  // 防止重复重定向的标记
  const hasCheckedOnboarding = useRef(false);

  // 获取版本列表（仅在需要时）
  const shouldFetchVersions = hasHydrated && !!token && !PUBLIC_PATHS.includes(pathname) && pathname !== ONBOARD_PATH;

  const { data: versions, isLoading: isVersionsLoading, isFetched, isError } = useQuery({
    queryKey: ['versions'],
    queryFn: async () => {
      console.log('[AppInitializer] Fetching versions...');
      const result = await api.getVersions();
      console.log('[AppInitializer] Versions fetched:', result);
      return result;
    },
    enabled: shouldFetchVersions,
    retry: 1,
    staleTime: 1000 * 60,
  });

  // 核心路由和引导逻辑
  useEffect(() => {
    if (!hasHydrated) {
      console.log('[AppInitializer] Waiting for hydration...');
      return;
    }

    // 1. 未登录用户访问受保护页面 → 跳转登录页
    if (!token || !user) {
      if (!PUBLIC_PATHS.includes(pathname)) {
        console.log('[AppInitializer] No auth, redirecting to login from:', pathname);
        router.replace('/login');
      }
      return;
    }

    // 2. 已登录用户访问登录页 → 跳转看板（后续会检查引导）
    if (pathname === '/login') {
      console.log('[AppInitializer] Already logged in, redirecting to board');
      router.replace('/board');
      return;
    }

    // 3. 在引导页时，不做任何重定向
    if (pathname === ONBOARD_PATH) {
      console.log('[AppInitializer] On onboard page, no redirect');
      return;
    }

    // 4. 等待版本数据加载
    if (isVersionsLoading || !isFetched) {
      console.log('[AppInitializer] Waiting for versions...', { isVersionsLoading, isFetched });
      return;
    }

    // 5. 版本请求失败，允许进入（降级处理）
    if (isError) {
      console.warn('[AppInitializer] Version fetch failed, allowing entry');
      return;
    }

    // 6. 检查是否需要引导（只检查一次）
    if (hasCheckedOnboarding.current) {
      return;
    }

    const hasVersions = Array.isArray(versions) && versions.length > 0;
    const userIsPM = isPMOrAdmin(user?.role);

    console.log('[AppInitializer] Onboarding check:', {
      userIsPM,
      hasVersions,
      versionsCount: versions?.length || 0,
      onboardingStatus,
    });

    // PM 首次使用（无版本 + 未引导）→ 强制引导
    if (userIsPM && !hasVersions && onboardingStatus === 'not_started') {
      console.log('[AppInitializer] First-time PM, redirecting to onboard');
      hasCheckedOnboarding.current = true;
      router.replace('/onboard');
      return;
    }

    // 标记已检查
    hasCheckedOnboarding.current = true;
    console.log('[AppInitializer] Onboarding check passed, user can proceed');

  }, [
    hasHydrated,
    user,
    token,
    pathname,
    versions,
    isVersionsLoading,
    isFetched,
    isError,
    onboardingStatus,
    router,
  ]);

  // 重置检查标记（当用户登出时）
  useEffect(() => {
    if (!token) {
      hasCheckedOnboarding.current = false;
    }
  }, [token]);

  // 渲染逻辑
  // hydration 完成前
  if (!hasHydrated) {
    return <GlobalLoading />;
  }

  // 未登录且在非公开页面
  if ((!token || !user) && !PUBLIC_PATHS.includes(pathname)) {
    return <GlobalLoading />;
  }

  // 已登录且在需要版本检查的页面，等待加载
  if (token && user && !PUBLIC_PATHS.includes(pathname) && pathname !== ONBOARD_PATH && isVersionsLoading) {
    return <GlobalLoading />;
  }

  return <>{children}</>;
}
