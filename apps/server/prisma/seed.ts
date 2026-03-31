import { PrismaClient, UserRole, VersionStatus, WorkflowStage, RequirementStatus, IssueSeverity, IssueStatus, CreditRuleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据...');

  // ============================================
  // 基础账号（三个核心角色）
  // ============================================

  // 1. 管理员账号 (ADMIN)
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      employeeNo: 'admin001',
      name: '系统管理员',
      username: 'admin',
      password: adminPassword,
      role: UserRole.ADMIN,
      team: '管理组',
    },
  });
  console.log('✅ 创建管理员账号:', { username: admin.username, role: admin.role, password: 'admin123' });

  // 2. 版本经理账号 (PM)
  const pmPassword = await bcrypt.hash('pm123', 10);
  const pm = await prisma.user.upsert({
    where: { username: 'pm' },
    update: {},
    create: {
      employeeNo: 'pm001',
      name: '版本经理',
      username: 'pm',
      password: pmPassword,
      role: UserRole.PM,
      team: '项目管理组',
    },
  });
  console.log('✅ 创建版本经理账号:', { username: pm.username, role: pm.role, password: 'pm123' });

  // 3. 组员账号 (MEMBER)
  const memberPassword = await bcrypt.hash('member123', 10);
  const member = await prisma.user.upsert({
    where: { username: 'member' },
    update: {},
    create: {
      employeeNo: 'member001',
      name: '开发组员',
      username: 'member',
      password: memberPassword,
      role: UserRole.MEMBER,
      team: '开发一组',
    },
  });
  console.log('✅ 创建组员账号:', { username: member.username, role: member.role, password: 'member123' });

  // ============================================
  // 扩展测试用户
  // ============================================
  const users = [
    { employeeNo: 'z00123123', name: '张三', team: '开发一组' },
    { employeeNo: 'l00342234', name: '李四', team: '开发一组' },
    { employeeNo: 'w30023424', name: '王五', team: '开发二组' },
    { employeeNo: 'z00123454', name: '赵六', team: '测试组' },
    { employeeNo: 'z00666886', name: '张三', team: '开发二组' }, // 同名不同人
  ];

  for (const userData of users) {
    const password = await bcrypt.hash('123456', 10);
    await prisma.user.upsert({
      where: { employeeNo: userData.employeeNo },
      update: {},
      create: {
        ...userData,
        username: userData.employeeNo,
        password,
        role: UserRole.MEMBER,
      },
    });
  }
  console.log('✅ 创建扩展测试用户完成');

  // 创建版本
  const version = await prisma.version.upsert({
    where: { name: 'V2026.Q1' },
    update: {},
    create: {
      name: 'V2026.Q1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: VersionStatus.DEVELOPMENT,
    },
  });
  console.log('创建版本:', version.name);

  // 创建转测版本
  const testCycles = ['转测1', '转测2', '转测3'];
  for (let i = 0; i < testCycles.length; i++) {
    await prisma.testCycle.upsert({
      where: {
        versionId_name: {
          versionId: version.id,
          name: testCycles[i],
        },
      },
      update: {},
      create: {
        name: testCycles[i],
        order: i + 1,
        versionId: version.id,
      },
    });
  }
  console.log('创建转测版本完成');

  // 创建信用规则
  const creditRules = [
    {
      ruleType: CreditRuleType.REQUIREMENT_COMPLETE,
      name: '需求完成',
      description: '按期完成需求',
      score: 10,
    },
    {
      ruleType: CreditRuleType.ISSUE_COMPLETE,
      name: '问题单完成',
      description: '按期完成问题单',
      score: 5,
    },
    {
      ruleType: CreditRuleType.DELAY,
      name: '延期1天',
      description: '延期1天扣分',
      score: -2,
      delayDays: 1,
    },
    {
      ruleType: CreditRuleType.REVIEW_DELAY,
      name: '评审延期',
      description: '架构师评审延期',
      score: -2,
    },
  ];

  for (const rule of creditRules) {
    await prisma.creditRule.upsert({
      where: {
        ruleType_name: {
          ruleType: rule.ruleType,
          name: rule.name,
        },
      },
      update: {},
      create: {
        ...rule,
        createdById: admin.id,
      },
    });
  }
  console.log('创建信用规则完成');

  console.log('数据初始化完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
