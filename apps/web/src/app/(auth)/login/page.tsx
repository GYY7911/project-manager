'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const router = useRouter();
  const { setUser, setToken } = useAppStore();

  // 4秒后自动清除错误提示
  useEffect(() => {
    if (usernameError) {
      const timer = setTimeout(() => setUsernameError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [usernameError]);

  useEffect(() => {
    if (passwordError) {
      const timer = setTimeout(() => setPasswordError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [passwordError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUsernameError('');
    setPasswordError('');

    try {
      const { user, access_token } = await api.login(username, password);
      api.setToken(access_token);
      setToken(access_token);
      setUser(user);
      router.push('/board');
    } catch (err: any) {
      const msg = err.message || '登录失败';
      // 根据错误信息判断是用户名还是密码错误
      if (msg.includes('用户') || msg.includes('账号')) {
        setUsernameError(msg);
      } else {
        setPasswordError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <Card className="w-full max-w-md relative glass">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            项目管理系统
          </CardTitle>
          <p className="text-muted-foreground text-sm">版本发布跟踪系统</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameError('');
                }}
                placeholder="请输入用户名"
                required
                className={usernameError ? 'border-red-500' : ''}
              />
              {usernameError && (
                <p className="text-red-400 text-sm">{usernameError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="请输入密码"
                required
                className={passwordError ? 'border-red-500' : ''}
              />
              {passwordError && (
                <p className="text-red-400 text-sm">{passwordError}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>测试账号：</p>
            <p>管理员: admin / admin123</p>
            <p>组员: z00123123 / 123456</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
