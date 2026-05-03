import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { UserRole } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
  };

  const mockLoginResult = {
    user: {
      id: 'user-1',
      username: 'testuser',
      name: '测试用户',
      role: UserRole.PM,
      employeeNo: 'z001',
    },
    access_token: 'mock-jwt-token',
  };

  const mockRegisterResult = {
    id: 'user-2',
    username: 'newuser',
    name: '新用户',
    role: UserRole.MEMBER,
    employeeNo: 'z002',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'password123',
    };

    it('应该成功登录并返回用户信息和 token', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResult);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockLoginResult);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });

    it('应该调用 authService.login', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResult);

      await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledTimes(1);
    });

    it('登录失败时应该抛出异常', async () => {
      const error = new Error('用户名或密码错误');
      mockAuthService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow('用户名或密码错误');
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      employeeNo: 'z002',
      name: '新用户',
      username: 'newuser',
      password: 'password123',
    };

    it('应该成功注册新用户', async () => {
      mockAuthService.register.mockResolvedValue(mockRegisterResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockRegisterResult);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });

    it('应该调用 authService.register', async () => {
      mockAuthService.register.mockResolvedValue(mockRegisterResult);

      await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledTimes(1);
    });

    it('注册失败时应该抛出异常', async () => {
      const error = new Error('用户名已存在');
      mockAuthService.register.mockRejectedValue(error);

      await expect(controller.register(registerDto)).rejects.toThrow('用户名已存在');
    });

    it('应该支持指定角色注册', async () => {
      const pmRegisterDto: RegisterDto = {
        ...registerDto,
        role: UserRole.PM,
      };

      mockAuthService.register.mockResolvedValue({
        ...mockRegisterResult,
        role: UserRole.PM,
      });

      const result = await controller.register(pmRegisterDto);

      expect(result.role).toBe(UserRole.PM);
    });
  });

  describe('getCurrentUser', () => {
    it('应该返回当前登录用户信息', async () => {
      const mockRequest = {
        user: {
          id: 'user-1',
          username: 'testuser',
          role: 'PM',
        },
      };

      const result = await controller.getCurrentUser(mockRequest);

      expect(result).toEqual(mockRequest.user);
    });

    it('应该返回请求中的用户对象', async () => {
      const mockRequest = {
        user: {
          id: 'user-2',
          username: 'admin',
          role: 'ADMIN',
        },
      };

      const result = await controller.getCurrentUser(mockRequest);

      expect(result.id).toBe('user-2');
      expect(result.username).toBe('admin');
      expect(result.role).toBe('ADMIN');
    });
  });
});

describe('Auth Controller DTO 验证', () => {
  it('LoginDto 应该包含 username 和 password', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'password123',
    };

    expect(loginDto.username).toBe('testuser');
    expect(loginDto.password).toBe('password123');
  });

  it('RegisterDto 应该包含必要字段', () => {
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
});
