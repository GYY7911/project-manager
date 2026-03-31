'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Users, CreditCard, Settings, LogOut, SwitchCamera, Sparkles, Moon, Sun } from 'lucide-react';
import { useAppStore, useHasHydrated, isPMOrAdmin } from '@/store';
import { api } from '@/lib/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WelcomeDialog } from '@/components/welcome';

const navItems = [
  { href: '/board', icon: LayoutDashboard, label: '看板' },
  { href: '/versions', icon: FolderKanban, label: '版本管理' },
  { href: '/users', icon: Users, label: '用户管理', pmOnly: true },
  { href: '/credits', icon: CreditCard, label: '信用管理', pmOnly: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, token, logout, interactionMode, setInteractionMode, theme, setTheme } = useAppStore();
  const hasHydrated = useHasHydrated();
  const pathname = usePathname();
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);

  // 同步 token 到 api 客户端
  useEffect(() => {
    if (hasHydrated && token) {
      api.setToken(token);
    }
  }, [hasHydrated, token]);

  // Apply theme class to document
  useEffect(() => {
    if (hasHydrated) {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
    }
  }, [hasHydrated, theme]);

  const handleLogout = () => {
    api.setToken(null);
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 glass border-r">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b border-white/10">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              PM System
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              if (item.pmOnly && !isPMOrAdmin(user?.role)) return null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                    pathname.startsWith(item.href)
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}

            {/* Onboarding Guide Entry - only for PM */}
            {isPMOrAdmin(user?.role) && (
              <button
                onClick={() => setShowWelcomeDialog(true)}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
              >
                <Sparkles className="h-4 w-4" />
                新手引导
              </button>
            )}
          </nav>

          {/* Interaction Mode Toggle & Theme Toggle */}
          <div className="border-t border-white/10 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">交互模式</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setInteractionMode(interactionMode === 'drag' ? 'click' : 'drag')
                }
                title={interactionMode === 'drag' ? '拖拽模式' : '点击模式'}
              >
                <SwitchCamera className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              当前: {interactionMode === 'drag' ? '拖拽' : '点击'}
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-sm text-muted-foreground">主题</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title={theme === 'dark' ? '深色模式' : '浅色模式'}
              >
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              当前: {theme === 'dark' ? '深色' : '浅色'}
            </p>
          </div>

          {/* User Info */}
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.employeeNo}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        {children}
      </main>

      {/* Welcome Dialog for manual trigger from sidebar */}
      <WelcomeDialog
        open={showWelcomeDialog}
        onOpenChange={setShowWelcomeDialog}
        forceOpen={showWelcomeDialog}
      />
    </div>
  );
}
