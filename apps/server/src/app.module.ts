import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { VersionModule } from './modules/version/version.module';
import { RequirementModule } from './modules/requirement/requirement.module';
import { IssueModule } from './modules/issue/issue.module';
import { CreditModule } from './modules/credit/credit.module';
import { TestCycleModule } from './modules/test-cycle/test-cycle.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { DelayConfigModule } from './modules/delay-config/delay-config.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UserModule,
    VersionModule,
    RequirementModule,
    IssueModule,
    CreditModule,
    TestCycleModule,
    WorkflowModule,
    DelayConfigModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
