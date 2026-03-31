import { Module } from '@nestjs/common';
import { TestCycleService } from './test-cycle.service';
import { TestCycleController } from './test-cycle.controller';

@Module({
  controllers: [TestCycleController],
  providers: [TestCycleService],
  exports: [TestCycleService],
})
export class TestCycleModule {}
