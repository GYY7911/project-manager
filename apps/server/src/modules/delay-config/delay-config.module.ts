import { Module } from '@nestjs/common';
import { DelayConfigService } from './delay-config.service';
import { DelayConfigController } from './delay-config.controller';

@Module({
  controllers: [DelayConfigController],
  providers: [DelayConfigService],
  exports: [DelayConfigService],
})
export class DelayConfigModule {}
