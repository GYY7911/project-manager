import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('validateUser', () => {
    const mockUser = {
      id: 'user-id',
      username: 'testuser',
      password: 'hashed-password',
      name: '测试用户',
      employeeNo: 'z001',
      role: UserRole.MEMBER,
      team: '开发组',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('应该验证成功并返回用户信息（不含密码）', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password123');

      expect(result).toEqual({
        id: 'user-id',
        username: 'testuser',
        name: '测试用户',
        employeeNo: 'z001',
        role: UserRole.MEMBER,
        team: '开发组',
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('password');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
    });

    it('用户不存在时应该返回 null', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('密码错误时应该返回 null', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('应该使用 username 查找用户', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.validateUser('testuser', 'password');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-id',
      username: 'testuser',
      name: '测试用户',
      role: UserRole.PM,
      employeeNo: 'z001',
    };

    it('应该成功登录并返回 user 和 access_token', async () => {
      // Mock validateUser to return user
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: 'hashed-password',
        team: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result.user.id).toBe('user-id');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-id',
        username: 'testuser',
        role: UserRole.PM,
      });
    });

    it('验证失败时应该抛出 UnauthorizedException', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('应该为 PM 角色生成正确的 token payload', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: UserRole.PM,
        password: 'hashed-password',
        team: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('pm-token');

      await service.login(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.PM })
      );
    });

    it('应该为 ADMIN 角色生成正确的 token payload', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: UserRole.ADMIN,
        password: 'hashed-password',
        team: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('admin-token');

      await service.login(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN })
      );
    });

    it('应该为 MEMBER 角色生成正确的 token payload', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: UserRole.MEMBER,
        password: 'hashed-password',
        team: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('member-token');

      await service.login(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.MEMBER })
      );
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      employeeNo: 'z002',
      name: '新用户',
      username: 'newuser',
      password: 'password123',
    };

    const mockCreatedUser = {
      id: 'new-user-id',
      employeeNo: 'z002',
      name: '新用户',
      username: 'newuser',
      password: 'hashed-password',
      role: UserRole.MEMBER,
      team: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('应该成功注册新用户（默认角色为 MEMBER）', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        id: 'new-user-id',
        employeeNo: 'z002',
        name: '新用户',
        username: 'newuser',
        role: UserRole.MEMBER,
        team: null,
        createdAt: mockCreatedUser.createdAt,
        updatedAt: mockCreatedUser.updatedAt,
      });
      expect(result).not.toHaveProperty('password');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('应该允许指定角色注册', async () => {
      const pmRegisterDto: RegisterDto = {
        ...registerDto,
        role: UserRole.PM,
      };

      const pmUser = { ...mockCreatedUser, role: UserRole.PM };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(pmUser);

      const result = await service.register(pmRegisterDto);

      expect(result.role).toBe(UserRole.PM);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...pmRegisterDto,
          password: 'hashed-password',
          role: UserRole.PM,
        }),
      });
    });

    it('应该允许指定团队注册', async () => {
      const teamRegisterDto: RegisterDto = {
        ...registerDto,
        team: '开发一组',
      };

      const teamUser = { ...mockCreatedUser, team: '开发一组' };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(teamUser);

      const result = await service.register(teamRegisterDto);

      expect(result.team).toBe('开发一组');
    });

    it('应该对密码进行 hash 处理', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ password: 'hashed-password' }),
        })
      );
    });

    it('应该返回不包含密码的用户信息', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);

      const result = await service.register(registerDto);

      expect(result).not.toHaveProperty('password');
    });

    it('未指定角色时应该默认为 MEMBER', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);

      await service.register(registerDto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeNo: registerDto.employeeNo,
            name: registerDto.name,
            username: registerDto.username,
            password: 'hashed-password',
            role: UserRole.MEMBER,
          }),
        })
      );
    });
  });

  describe('validateToken', () => {
    const mockUser = {
      id: 'user-id',
      username: 'testuser',
      password: 'hashed-password',
      name: '测试用户',
      employeeNo: 'z001',
      role: UserRole.MEMBER,
      team: '开发组',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('应该验证成功并返回用户信息', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateToken('user-id');

      expect(result).toEqual({
        id: 'user-id',
        username: 'testuser',
        name: '测试用户',
        employeeNo: 'z001',
        role: UserRole.MEMBER,
        team: '开发组',
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('用户不存在时应该返回 null', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateToken('non-existent-id');

      expect(result).toBeNull();
    });

    it('应该使用 userId 查找用户', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await service.validateToken('user-id');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
    });
  });
});

describe('Auth DTO 验证', () => {
  it('LoginDto 应该包含 username 和 password', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'password123',
    };

    expect(loginDto.username).toBe('testuser');
    expect(loginDto.password).toBe('password123');
  });

  it('RegisterDto 应该包含所有必要字段', () => {
    const registerDto: RegisterDto = {
      employeeNo: 'z001',
      name: '张三',
      username: 'zhangsan',
      password: 'password123',
      role: UserRole.PM,
      team: '开发组',
    };

    expect(registerDto.employeeNo).toBe('z001');
    expect(registerDto.name).toBe('张三');
    expect(registerDto.username).toBe('zhangsan');
    expect(registerDto.password).toBe('password123');
    expect(registerDto.role).toBe(UserRole.PM);
    expect(registerDto.team).toBe('开发组');
  });

  it('RegisterDto 可选字段应该可以为 undefined', () => {
    const registerDto: RegisterDto = {
      employeeNo: 'z001',
      name: '张三',
      username: 'zhangsan',
      password: 'password123',
    };

    expect(registerDto.role).toBeUndefined();
    expect(registerDto.team).toBeUndefined();
  });
});
