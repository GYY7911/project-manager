import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 配置全局验证管道
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // 设置全局前缀
    app.setGlobalPrefix('api');

    prisma = app.get(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    // 只清理测试创建的用户（通过 employeeNo 前缀识别）
    await prisma.workflowLog.deleteMany({});
    await prisma.creditRecord.deleteMany({});
    await prisma.issue.deleteMany({});
    await prisma.requirement.deleteMany({});
    await prisma.testCycle.deleteMany({});
    await prisma.version.deleteMany({});
    // 只删除测试用户，不影响种子数据
    await prisma.user.deleteMany({
      where: {
        OR: [
          { employeeNo: 'e2e_test_user' },
          { employeeNo: 'profile_test' },
        ],
      },
    });

    await app.close();
  });

  describe('/api/auth/login (POST)', () => {
    const testUser = {
      employeeNo: 'e2e_test_user',
      username: 'e2e_test_user',
      password: 'test123456',
      name: 'E2E测试用户',
      role: UserRole.MEMBER,
      team: '测试组',
    };

    beforeEach(async () => {
      // 创建测试用户
      const hashedPassword = await bcrypt.hash(testUser.password, 10);
      await prisma.user.upsert({
        where: { employeeNo: testUser.employeeNo },
        update: {},
        create: {
          ...testUser,
          password: hashedPassword,
        },
      });
    });

    it('应该成功登录并返回 token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.username).toBe(testUser.username);
          // 确保不返回旧的 token 字段（防止前后端字段名不一致）
          expect(res.body).not.toHaveProperty('token');
          // 确保返回完整的用户信息
          expect(res.body.user).toHaveProperty('id');
          expect(res.body.user).toHaveProperty('name');
          expect(res.body.user).toHaveProperty('role');
          expect(res.body.user).toHaveProperty('employeeNo');
        });
    });

    it('错误密码应该返回 401', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('不存在的用户应该返回 401', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'anypassword',
        })
        .expect(401);
    });
  });

  describe('/api/auth/me (GET)', () => {
    let authToken: string;

    beforeAll(async () => {
      // 创建用户并获取 token
      const hashedPassword = await bcrypt.hash('test123456', 10);
      await prisma.user.create({
        data: {
          employeeNo: 'profile_test',
          username: 'profile_test',
          password: hashedPassword,
          name: 'Profile测试用户',
          role: UserRole.MEMBER,
          team: '测试组',
        },
      });

      // 登录获取 token
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'profile_test',
          password: 'test123456',
        });

      authToken = response.body.access_token;
    });

    it('带 token 应该返回用户信息', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.username).toBe('profile_test');
        });
    });

    it('不带 token 应该返回 401', () => {
      return request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });
});
