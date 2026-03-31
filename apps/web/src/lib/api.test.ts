import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Import after mocking
import { api } from './api';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.setToken(null);
    api.setOnUnauthorized(() => {});
    mockLocation.href = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token 管理', () => {
    it('setToken 应该正确设置 token', () => {
      api.setToken('test-token');
      expect(api.getToken()).toBe('test-token');
    });

    it('setToken(null) 应该清除 token', () => {
      api.setToken('test-token');
      api.setToken(null);
      expect(api.getToken()).toBe(null);
    });

    it('getToken 初始应该返回 null', () => {
      expect(api.getToken()).toBe(null);
    });
  });

  describe('onUnauthorized 回调', () => {
    it('setOnUnauthorized 应该设置回调', () => {
      const callback = vi.fn();
      api.setOnUnauthorized(callback);
      // 回调会在 401 时被调用，后续测试验证
    });
  });

  describe('request 方法', () => {
    it('成功的请求应该返回 JSON 数据', async () => {
      const mockData = { id: '1', name: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      // 通过调用 getVersions 测试 request
      const result = await api.getVersions();
      expect(result).toEqual(mockData);
    });

    it('请求应该包含 Content-Type header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await api.getVersions();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('设置 token 后请求应该包含 Authorization header', async () => {
      api.setToken('bearer-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await api.getVersions();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer bearer-token',
          }),
        })
      );
    });

    it('POST 请求应该包含 body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1' }),
      });

      await api.createVersion({
        name: 'V1.0',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'V1.0',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          }),
        })
      );
    });

    it('401 响应应该触发回调并跳转登录页', async () => {
      const callback = vi.fn();
      api.setOnUnauthorized(callback);
      api.setToken('expired-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      await expect(api.getVersions()).rejects.toThrow();

      expect(callback).toHaveBeenCalled();
      expect(api.getToken()).toBe(null);
      expect(mockLocation.href).toBe('/login');
    });

    it('错误响应应该抛出带有 response.data 的错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: '参数错误', code: 'INVALID_PARAM' }),
      });

      try {
        await api.getVersions();
        expect.fail('应该抛出错误');
      } catch (error: any) {
        expect(error.message).toBe('参数错误');
        expect(error.response).toEqual({
          data: { message: '参数错误', code: 'INVALID_PARAM' },
        });
      }
    });

    it('响应 JSON 解析失败应该使用默认错误消息', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(api.getVersions()).rejects.toThrow('请求失败');
    });

    it('错误响应无 message 时应该使用默认消息', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      await expect(api.getVersions()).rejects.toThrow('请求失败');
    });
  });

  describe('Auth API', () => {
    describe('login', () => {
      it('应该发送登录请求', async () => {
        const mockResponse = {
          user: { id: '1', name: 'Test', role: 'PM', employeeNo: 'E001' },
          token: 'jwt-token',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await api.login('testuser', 'password123');

        expect(result).toEqual(mockResponse);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/login'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ username: 'testuser', password: 'password123' }),
          })
        );
      });
    });

    describe('getMe', () => {
      it('应该获取当前用户信息', async () => {
        const mockResponse = {
          id: '1',
          name: 'Test User',
          role: 'PM',
          employeeNo: 'E001',
          team: '开发组',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await api.getMe();

        expect(result).toEqual(mockResponse);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/me'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Versions API', () => {
    describe('getVersions', () => {
      it('应该获取版本列表', async () => {
        const mockVersions = [
          { id: '1', name: 'V1.0', status: 'DEVELOPMENT' },
          { id: '2', name: 'V2.0', status: 'PLANNING' },
        ];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersions),
        });

        const result = await api.getVersions();

        expect(result).toEqual(mockVersions);
      });
    });

    describe('getVersionBoard', () => {
      it('应该获取看板数据', async () => {
        const mockBoard = {
          requirements: [],
          testCycles: [],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBoard),
        });

        const result = await api.getVersionBoard('version-123');

        expect(result).toEqual(mockBoard);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/versions/version-123/board'),
          expect.any(Object)
        );
      });
    });

    describe('createVersion', () => {
      it('应该创建版本', async () => {
        const mockResponse = { id: 'new-version', name: 'V1.0' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await api.createVersion({
          name: 'V1.0',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        });

        expect(result).toEqual(mockResponse);
      });
    });

    describe('createOrUseVersion', () => {
      it('应该发送创建或使用版本请求', async () => {
        const mockResponse = {
          id: 'version-123',
          name: 'V1.0',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          status: 'PLANNING',
          isExisting: false,
          message: '版本创建成功',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await api.createOrUseVersion({
          name: 'V1.0',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        });

        expect(result).toEqual(mockResponse);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/versions/create-or-use'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              name: 'V1.0',
              startDate: '2026-01-01',
              endDate: '2026-01-31',
            }),
          })
        );
      });

      it('useExisting=true 应该包含在请求中', async () => {
        const mockResponse = {
          id: 'existing-123',
          isExisting: true,
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        await api.createOrUseVersion({
          name: 'V1.0',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          useExisting: true,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('"useExisting":true'),
          })
        );
      });
    });

    describe('checkVersionName', () => {
      it('应该检查版本名称是否存在', async () => {
        const mockResponse = {
          exists: true,
          version: { id: '1', name: 'V1.0' },
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await api.checkVersionName('V1.0');

        expect(result).toEqual(mockResponse);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/versions/check-name?name=V1.0'),
          expect.any(Object)
        );
      });

      it('应该正确编码特殊字符', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ exists: false }),
        });

        await api.checkVersionName('V1.0 & 特殊版本');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('V1.0%20%26%20%E7%89%B9%E6%AE%8A%E7%89%88%E6%9C%AC'),
          expect.any(Object)
        );
      });
    });

    describe('updateVersion', () => {
      it('应该发送更新版本请求', async () => {
        const mockResponse = {
          id: 'version-123',
          name: 'V1.0-Updated',
          startDate: '2026-01-01',
          endDate: '2026-02-28',
          status: 'DEVELOPMENT',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await api.updateVersion('version-123', {
          name: 'V1.0-Updated',
          endDate: '2026-02-28',
        });

        expect(result).toEqual(mockResponse);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/versions/version-123'),
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({
              name: 'V1.0-Updated',
              endDate: '2026-02-28',
            }),
          })
        );
      });

      it('应该支持更新状态', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'version-123', status: 'TESTING' }),
        });

        await api.updateVersion('version-123', { status: 'TESTING' });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('"status":"TESTING"'),
          })
        );
      });

      it('应该处理版本名称冲突错误', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ message: '版本名称已存在' }),
        });

        await expect(
          api.updateVersion('version-123', { name: 'ExistingName' })
        ).rejects.toThrow('版本名称已存在');
      });
    });

    describe('deleteVersion', () => {
      it('应该发送删除版本请求', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(undefined),
        });

        await api.deleteVersion('version-123');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/versions/version-123'),
          expect.objectContaining({ method: 'DELETE' })
        );
      });

      it('应该处理关联数据存在错误', async () => {
        const errorResponse = {
          message: '无法删除：该版本下存在关联数据',
          details: {
            requirements: 5,
            issues: 3,
            testCycles: 2,
          },
        };
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve(errorResponse),
        });

        try {
          await api.deleteVersion('version-123');
          expect.fail('应该抛出错误');
        } catch (error: any) {
          expect(error.message).toBe('无法删除：该版本下存在关联数据');
          expect(error.response.data.details).toEqual({
            requirements: 5,
            issues: 3,
            testCycles: 2,
          });
        }
      });

      it('应该处理版本不存在错误', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ message: '版本不存在' }),
        });

        await expect(api.deleteVersion('non-existent')).rejects.toThrow('版本不存在');
      });
    });
  });

  describe('Requirements API', () => {
    describe('getRequirements', () => {
      it('应该获取需求列表（不带参数）', async () => {
        const mockRequirements = [
          { id: '1', title: '需求1' },
          { id: '2', title: '需求2' },
        ];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRequirements),
        });

        const result = await api.getRequirements();

        expect(result).toEqual(mockRequirements);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/requirements'),
          expect.any(Object)
        );
      });

      it('应该获取需求列表（带 versionId）', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await api.getRequirements('version-123');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/requirements?versionId=version-123'),
          expect.any(Object)
        );
      });
    });

    describe('createRequirement', () => {
      it('应该创建需求', async () => {
        const mockResponse = { id: 'req-1', code: 'REQ-001' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await api.createRequirement({
          title: '新需求',
          versionId: 'version-123',
          assigneeId: 'user-1',
        });

        expect(result).toEqual(mockResponse);
      });
    });

    describe('updateRequirementStage', () => {
      it('应该更新需求阶段（不带备注）', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

        await api.updateRequirementStage('req-1', 'DEVELOPMENT');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/requirements/req-1/stage'),
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ stage: 'DEVELOPMENT', remark: undefined }),
          })
        );
      });

      it('应该更新需求阶段（带备注）', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

        await api.updateRequirementStage('req-1', 'TESTING', '开始测试');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('开始测试'),
          })
        );
      });
    });

    describe('generateRequirementCode', () => {
      it('应该生成需求编码', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ code: 'REQ-001' }),
        });

        const result = await api.generateRequirementCode('version-123');

        expect(result).toEqual({ code: 'REQ-001' });
      });
    });
  });

  describe('Issues API', () => {
    describe('getIssues', () => {
      it('应该获取问题单列表', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await api.getIssues();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/issues'),
          expect.any(Object)
        );
      });

      it('应该获取问题单列表（带 versionId）', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await api.getIssues('version-123');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/issues?versionId=version-123'),
          expect.any(Object)
        );
      });
    });

    describe('createIssue', () => {
      it('应该创建问题单', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'issue-1' }),
        });

        await api.createIssue({
          title: 'Bug 修复',
          versionId: 'version-123',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/issues'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    describe('updateIssueStage', () => {
      it('应该更新问题单阶段', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

        await api.updateIssueStage('issue-1', 'RESOLVED', '已修复');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/issues/issue-1/stage'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('RESOLVED'),
          })
        );
      });

      it('应该支持 ccbApproved 参数', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

        await api.updateIssueStage('issue-1', 'CLOSED', undefined, true);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('"ccbApproved":true'),
          })
        );
      });
    });

    describe('generateIssueCode', () => {
      it('应该生成问题单编码', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ code: 'ISS-001' }),
        });

        const result = await api.generateIssueCode('version-123');

        expect(result).toEqual({ code: 'ISS-001' });
      });
    });
  });

  describe('Test Cycles API', () => {
    describe('getTestCycles', () => {
      it('应该获取测试轮次列表', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await api.getTestCycles('version-123');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/test-cycles?versionId=version-123'),
          expect.any(Object)
        );
      });
    });

    describe('createTestCycle', () => {
      it('应该创建测试轮次', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'tc-1' }),
        });

        await api.createTestCycle({
          name: 'SIT1',
          versionId: 'version-123',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/test-cycles'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    describe('deleteTestCycle', () => {
      it('应该删除测试轮次', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(undefined),
        });

        await api.deleteTestCycle('tc-1');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/test-cycles/tc-1'),
          expect.objectContaining({ method: 'DELETE' })
        );
      });
    });
  });

  describe('Users API', () => {
    describe('getAssignees', () => {
      it('应该获取可分配人员列表', async () => {
        const mockUsers = [
          { id: '1', name: '张三', employeeNo: 'E001' },
        ];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsers),
        });

        const result = await api.getAssignees();

        expect(result).toEqual(mockUsers);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/users/assignees'),
          expect.any(Object)
        );
      });
    });

    describe('getUsers', () => {
      it('应该获取所有用户列表', async () => {
        const mockUsers = [
          { id: '1', name: '张三' },
          { id: '2', name: '李四' },
        ];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsers),
        });

        const result = await api.getUsers();

        expect(result).toEqual(mockUsers);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/users'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Credits API', () => {
    describe('getCreditSummaries', () => {
      it('应该获取积分汇总', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await api.getCreditSummaries('version-123');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/credits/summaries?versionId=version-123'),
          expect.any(Object)
        );
      });
    });

    describe('getCreditRules', () => {
      it('应该获取积分规则', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await api.getCreditRules();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/credits/rules'),
          expect.any(Object)
        );
      });
    });

    describe('createCreditRule', () => {
      it('应该创建积分规则', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'rule-1' }),
        });

        await api.createCreditRule({
          name: '完成需求',
          score: 10,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/credits/rules'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    describe('manualAdjustCredit', () => {
      it('应该手动调整积分', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'adjust-1' }),
        });

        await api.manualAdjustCredit({
          userId: 'user-1',
          versionId: 'version-123',
          score: 5,
          remark: '奖励',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/credits/adjust'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              userId: 'user-1',
              versionId: 'version-123',
              score: 5,
              remark: '奖励',
            }),
          })
        );
      });
    });
  });
});
