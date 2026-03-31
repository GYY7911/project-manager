import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VersionService, CreateVersionDto, CreateOrUseVersionDto, UpdateVersionDto } from './version.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('versions')
@UseGuards(JwtAuthGuard)
export class VersionController {
  constructor(private versionService: VersionService) {}

  @Post()
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async create(@Body() dto: CreateVersionDto) {
    return this.versionService.create(dto);
  }

  /**
   * 创建版本（支持使用已存在的版本）
   * 用于引导流程，当版本已存在时可以返回现有版本信息
   */
  @Post('create-or-use')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async createOrUse(@Body() dto: CreateOrUseVersionDto) {
    return this.versionService.createOrUse(dto);
  }

  /**
   * 检查版本名称是否已存在
   */
  @Get('check-name')
  async checkName(@Query('name') name: string) {
    if (!name) {
      return { exists: false };
    }
    const existing = await this.versionService.findByName(name);
    if (!existing) {
      return { exists: false };
    }
    return {
      exists: true,
      version: {
        id: existing.id,
        name: existing.name,
        startDate: existing.startDate,
        endDate: existing.endDate,
        status: existing.status,
        testCyclesCount: existing.testCycles?.length || 0,
      },
    };
  }

  @Get()
  async findAll() {
    return this.versionService.findAll();
  }

  @Get('current')
  async getCurrentVersion() {
    return this.versionService.getCurrentVersion();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.versionService.findOne(id);
  }

  @Get(':id/board')
  async getVersionBoard(@Param('id') id: string) {
    return this.versionService.getVersionBoard(id);
  }

  @Put(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateVersionDto) {
    return this.versionService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async remove(
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    const forceDelete = force === 'true';
    return this.versionService.remove(id, forceDelete);
  }
}
