import { Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditRuleService } from './credit-rule.service';
import { CreditController } from './credit.controller';
import { CreditScheduler } from './credit.scheduler';

@Module({
  controllers: [CreditController],
  providers: [CreditService, CreditRuleService, CreditScheduler],
  exports: [CreditService, CreditRuleService],
})
export class CreditModule {}
