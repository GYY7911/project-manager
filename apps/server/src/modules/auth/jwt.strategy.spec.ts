import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    name: '测试用户',
    employeeNo: 'z001',
    role: UserRole.PM,
    team: '开发组',
    password: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('validate', () => {
    const payload = {
      sub: 'user-1',
      username: 'testuser',
      role: 'PM',
    };

    it('应该验证成功并返回用户信息（不含密码）', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-1',
        username: 'testuser',
        name: '测试用户',
        employeeNo: 'z001',
        role: UserRole.PM,
        team: '开发组',
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('用户不存在时应该返回 null', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await strategy.validate(payload);

      expect(result).toBeNull();
    });

    it('应该使用 payload.sub 查找用户', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await strategy.validate(payload);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('应该返回 MEMBER 角色用户', async () => {
      const memberUser = {
        ...mockUser,
        role: UserRole.MEMBER,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(memberUser);

      const result = await strategy.validate({
        sub: 'user-1',
        username: 'member',
        role: 'MEMBER',
      });

      expect(result).not.toBeNull();
      expect(result!.role).toBe(UserRole.MEMBER);
    });

    it('应该返回 ADMIN 角色用户', async () => {
      const adminUser = {
        ...mockUser,
        role: UserRole.ADMIN,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(adminUser);

      const result = await strategy.validate({
        sub: 'user-1',
        username: 'admin',
        role: 'ADMIN',
      });

      expect(result).not.toBeNull();
      expect(result!.role).toBe(UserRole.ADMIN);
    });
  });

  describe('constructor', () => {
    it('应该使用配置服务获取 JWT 密钥', () => {
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });

    it('当 JWT_SECRET 未配置时应该使用默认密钥', async () => {
      const mockConfigNoSecret = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: ConfigService,
            useValue: mockConfigNoSecret,
          },
        ],
      }).compile();

      const strategyWithDefaultSecret = module.get<JwtStrategy>(JwtStrategy);

      expect(strategyWithDefaultSecret).toBeDefined();
      expect(mockConfigNoSecret.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });
});
