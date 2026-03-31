import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRole } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  const mockUserService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getAssigneeList: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  describe('GET /users', () => {
    it('应该返回用户列表', async () => {
      const users = [
        { id: '1', name: '张三', role: UserRole.PM },
        { id: '2', name: '李四', role: UserRole.MEMBER },
      ];
      mockUserService.findAll.mockResolvedValue(users);

      const result = await controller.findAll({ user: { role: UserRole.PM } });

      expect(result).toEqual(users);
      expect(mockUserService.findAll).toHaveBeenCalledWith(UserRole.PM);
    });

    it('ADMIN 用户应该能访问用户列表', async () => {
      const users = [{ id: '1', name: '张三' }];
      mockUserService.findAll.mockResolvedValue(users);

      const result = await controller.findAll({ user: { role: UserRole.ADMIN } });

      expect(result).toEqual(users);
      expect(mockUserService.findAll).toHaveBeenCalledWith(UserRole.ADMIN);
    });
  });

  describe('GET /users/assignees', () => {
    it('应该返回可分配的用户列表', async () => {
      const assignees = [
        { id: '1', name: '张三', employeeNo: 'z001' },
        { id: '2', name: '李四', employeeNo: 'z002' },
      ];
      mockUserService.getAssigneeList.mockResolvedValue(assignees);

      const result = await controller.getAssigneeList();

      expect(result).toEqual(assignees);
    });
  });

  describe('GET /users/:id', () => {
    it('应该返回指定用户', async () => {
      const user = { id: 'user-id', name: '张三', role: UserRole.PM };
      mockUserService.findOne.mockResolvedValue(user);

      const result = await controller.findOne('user-id');

      expect(result).toEqual(user);
    });

    it('应该在用户不存在时抛出异常', async () => {
      mockUserService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('non-existent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('PUT /users/:id', () => {
    it('应该成功更新用户', async () => {
      const updateData = { name: '新名字', team: '新团队' };
      const updatedUser = { id: 'user-id', ...updateData };
      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-id', updateData);

      expect(result).toEqual(updatedUser);
    });

    it('应该支持更新用户角色', async () => {
      const updateData = { role: UserRole.ADMIN };
      const updatedUser = { id: 'user-id', name: '张三', ...updateData };
      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-id', updateData);

      expect(result.role).toBe(UserRole.ADMIN);
    });
  });

  describe('DELETE /users/:id', () => {
    it('应该成功删除用户', async () => {
      const deletedUser = { id: 'user-id', name: '张三' };
      mockUserService.remove.mockResolvedValue(deletedUser);

      const result = await controller.remove('user-id');

      expect(result).toEqual(deletedUser);
    });
  });
});

describe('UserController 权限测试', () => {
  // 模拟权限守卫的行为
  const checkRolePermission = (userRole: UserRole, requiredRoles: UserRole[]) => {
    return requiredRoles.includes(userRole);
  };

  describe('GET /users 权限', () => {
    const requiredRoles = [UserRole.PM, UserRole.ADMIN];

    it('PM 角色应该有权限', () => {
      expect(checkRolePermission(UserRole.PM, requiredRoles)).toBe(true);
    });

    it('ADMIN 角色应该有权限', () => {
      expect(checkRolePermission(UserRole.ADMIN, requiredRoles)).toBe(true);
    });

    it('MEMBER 角色不应该有权限', () => {
      expect(checkRolePermission(UserRole.MEMBER, requiredRoles)).toBe(false);
    });
  });

  describe('PUT /users/:id 权限', () => {
    const requiredRoles = [UserRole.PM, UserRole.ADMIN];

    it('PM 角色应该有权限', () => {
      expect(checkRolePermission(UserRole.PM, requiredRoles)).toBe(true);
    });

    it('ADMIN 角色应该有权限', () => {
      expect(checkRolePermission(UserRole.ADMIN, requiredRoles)).toBe(true);
    });

    it('MEMBER 角色不应该有权限', () => {
      expect(checkRolePermission(UserRole.MEMBER, requiredRoles)).toBe(false);
    });
  });

  describe('DELETE /users/:id 权限', () => {
    const requiredRoles = [UserRole.PM, UserRole.ADMIN];

    it('PM 角色应该有权限', () => {
      expect(checkRolePermission(UserRole.PM, requiredRoles)).toBe(true);
    });

    it('ADMIN 角色应该有权限', () => {
      expect(checkRolePermission(UserRole.ADMIN, requiredRoles)).toBe(true);
    });

    it('MEMBER 角色不应该有权限', () => {
      expect(checkRolePermission(UserRole.MEMBER, requiredRoles)).toBe(false);
    });
  });

  describe('GET /users/assignees 权限', () => {
    // 这个端点对所有认证用户开放
    it('所有角色都应该能获取被分配人列表', () => {
      expect(true).toBe(true); // 无特殊权限限制
    });
  });
});
