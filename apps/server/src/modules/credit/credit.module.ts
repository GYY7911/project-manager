import { Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditRuleService } from './credit-rule.service';
import { CreditCorrectionService } from './credit-correction.service';
import { CreditController } from './credit.controller';
import { CreditScheduler } from './credit.scheduler';

@Module({
  controllers: [CreditController],
  providers: [CreditService, CreditRuleService, CreditCorrectionService, CreditScheduler],
  exports: [CreditService, CreditRuleService, CreditCorrectionService],
})
export class CreditModule {}
