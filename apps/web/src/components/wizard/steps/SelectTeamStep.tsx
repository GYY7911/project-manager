'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { OnboardingData } from '@/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Users, Check, Info, UserPlus, ArrowRight } from 'lucide-react';

interface SelectTeamStepProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  versionId: string | null;
}

export function SelectTeamStep({
  data,
  updateData,
  versionId,
}: SelectTeamStepProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(data.teamMemberIds);

  // Get all users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: api.getUsers,
  });

  const toggleMember = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  useEffect(() => {
    updateData({ teamMemberIds: selectedIds });
  }, [selectedIds, updateData]);

  if (isLoading) {
    return (
      <Card className="glass border-white/20 min-h-[720px] flex flex-col">
        <CardContent className="py-8 text-center flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">加载用户列表...</p>
        </CardContent>
      </Card>
    );
  }

  // 无成员时显示明确的引导
  if (users.length === 0) {
    return (
      <Card className="glass border-white/20 min-h-[720px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            选择团队成员
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">还没有可分配的团队成员</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              需要先添加组员，才能在创建需求时分配任务。
              您可以稍后在「用户管理」中添加成员。
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/onboard')}
                className="text-muted-foreground"
              >
                跳过此步
              </Button>
              <Button onClick={() => router.push('/users')}>
                <UserPlus className="h-4 w-4 mr-2" />
                前往用户管理
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-white/20 min-h-[720px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          选择团队成员
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          这些是你关注的成员。后续创建需求时可以快速选择他们作为负责人。
        </p>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {users.map((user: any) => {
            const isSelected = selectedIds.includes(user.id);
            return (
              <button
                key={user.id}
                onClick={() => toggleMember(user.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all",
                  "hover:bg-white/5 dark:hover:bg-white/5 hover:bg-slate-100",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-white/10 dark:border-white/10 border-slate-200"
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {user.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.employeeNo}
                    {user.team && ` · ${user.team}`}
                  </p>
                </div>
                {isSelected && (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 选中状态提示 */}
        <div className={cn(
          "mt-6 p-4 rounded-lg border transition-all",
          selectedIds.length > 0
            ? "border-green-500/20 bg-green-500/10"
            : "border-blue-500/20 bg-blue-500/10"
        )}>
          <div className="flex items-start gap-3">
            <Info className={cn(
              "h-5 w-5 mt-0.5",
              selectedIds.length > 0 ? "text-green-400" : "text-blue-400"
            )} />
            <div>
              {selectedIds.length > 0 ? (
                <>
                  <h4 className="font-medium text-green-400 mb-1">已选择 {selectedIds.length} 人</h4>
                  <p className="text-sm text-muted-foreground">
                    可以继续下一步创建需求了。您也可以点击成员取消选择。
                  </p>
                </>
              ) : (
                <>
                  <h4 className="font-medium text-blue-400 mb-1">选择建议</h4>
                  <p className="text-sm text-muted-foreground">
                    点击上方成员卡片选择你关注的成员。这是一个可选步骤，也可以跳过。
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
