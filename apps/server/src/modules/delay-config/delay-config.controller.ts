import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DelayConfigService, CreateDelayConfigDto, BatchImportDto } from './delay-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Controller('delay-configs')
@UseGuards(JwtAuthGuard)
export class DelayConfigController {
  constructor(private delayConfigService: DelayConfigService) {}

  @Get(':versionId')
  async getByVersion(@Param('versionId') versionId: string) {
    return this.delayConfigService.findByVersion(versionId);
  }

  @Post()
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async createOrUpdate(@Body() dto: CreateDelayConfigDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.delayConfigService.createOrUpdate({
      ...dto,
      operatedBy: user.sub,
    });
  }

  @Delete(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async remove(@Param('id') id: string) {
    return this.delayConfigService.remove(id);
  }

  @Post('batch')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async batchImport(@Body() dto: BatchImportDto) {
    return this.delayConfigService.batchImport(dto);
  }
}
