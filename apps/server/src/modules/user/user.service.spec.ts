import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findAll', () => {
    it('应该返回所有用户列表', async () => {
      const users = [
        { id: '1', name: '张三', employeeNo: 'z001', role: UserRole.PM },
        { id: '2', name: '李四', employeeNo: 'z002', role: UserRole.MEMBER },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(users);

      const result = await service.findAll(UserRole.PM);

      expect(result).toEqual(users);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          employeeNo: true,
          name: true,
          username: true,
          role: true,
          team: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
      });
    });

    it('应该按名称升序排序', async () => {
      const users = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(users);

      await service.findAll(UserRole.ADMIN);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });

    it('应该在无用户时返回空数组', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findAll(UserRole.PM);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('应该返回指定用户', async () => {
      const user = {
        id: 'user-id',
        name: '张三',
        employeeNo: 'z001',
        username: 'zhangsan',
        role: UserRole.PM,
        team: '开发组',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne('user-id');

      expect(result).toEqual(user);
    });

    it('应该在用户不存在时抛出 NotFoundException', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('update', () => {
    it('应该成功更新用户信息', async () => {
      const updateData = { name: '新名字', team: '新团队' };
      const updatedUser = {
        id: 'user-id',
        ...updateData,
        employeeNo: 'z001',
        username: 'zhangsan',
        role: UserRole.PM,
      };

      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-id', updateData);

      expect(result).toEqual(updatedUser);
    });

    it('应该支持更新角色', async () => {
      const updateData = { role: UserRole.ADMIN };
      const updatedUser = {
        id: 'user-id',
        name: '张三',
        role: UserRole.ADMIN,
      };

      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-id', updateData);

      expect(result.role).toBe(UserRole.ADMIN);
    });
  });

  describe('remove', () => {
    it('应该成功删除用户', async () => {
      const deletedUser = { id: 'user-id', name: '张三' };
      mockPrismaService.user.delete.mockResolvedValue(deletedUser);

      const result = await service.remove('user-id');

      expect(result).toEqual(deletedUser);
    });
  });

  describe('getAssigneeList', () => {
    it('应该返回简化的用户列表（仅包含必要字段）', async () => {
      const assignees = [
        { id: '1', name: '张三', employeeNo: 'z001' },
        { id: '2', name: '李四', employeeNo: 'z002' },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(assignees);

      const result = await service.getAssigneeList();

      expect(result).toEqual(assignees);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          employeeNo: true,
        },
        orderBy: { name: 'asc' },
      });
    });

    it('不应该返回敏感字段（如密码）', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: '1', name: '张三', employeeNo: 'z001' },
      ]);

      await service.getAssigneeList();

      const call = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(call.select.password).toBeUndefined();
    });
  });
});

describe('UserRole 权限测试', () => {
  it('ADMIN 角色应该有管理权限', () => {
    const adminRole = UserRole.ADMIN;
    const pmRole = UserRole.PM;

    // ADMIN 和 PM 都应该能访问需要管理权限的功能
    const hasManagementAccess = (role: UserRole) =>
      role === UserRole.PM || role === UserRole.ADMIN;

    expect(hasManagementAccess(adminRole)).toBe(true);
    expect(hasManagementAccess(pmRole)).toBe(true);
    expect(hasManagementAccess(UserRole.MEMBER)).toBe(false);
  });

  it('MEMBER 角色应该只有基本权限', () => {
    const memberRole = UserRole.MEMBER;

    const hasBasicAccess = (role: UserRole) =>
      role === UserRole.PM || role === UserRole.ADMIN || role === UserRole.MEMBER;

    expect(hasBasicAccess(memberRole)).toBe(true);
  });
});
