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
  Request,
} from '@nestjs/common';
import {
  RequirementService,
  CreateRequirementDto,
  UpdateRequirementDto,
  UpdateStageDto,
} from './requirement.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('requirements')
@UseGuards(JwtAuthGuard)
export class RequirementController {
  constructor(private requirementService: RequirementService) {}

  @Post()
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async create(@Body() dto: CreateRequirementDto) {
    try {
      return await this.requirementService.create(dto);
    } catch (error: any) {
      console.error('[RequirementController] Create failed:', {
        error: error.message,
        code: error.code,
        meta: error.meta,
        dto: { ...dto, workload: dto.workload, dueDate: dto.dueDate },
      });
      throw error;
    }
  }

  @Get()
  async findAll(
    @Query('versionId') versionId?: string,
    @Request() req?: any,
  ) {
    return this.requirementService.findAll(versionId, req.user.role);
  }

  @Get('generate-code')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async generateCode(@Query('versionId') versionId: string) {
    return { code: await this.requirementService.generateCode(versionId) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.requirementService.findOne(id, req.user.role);
  }

  @Put(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateRequirementDto) {
    return this.requirementService.update(id, dto);
  }

  @Put(':id/stage')
  async updateStage(
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
    @Request() req: any,
  ) {
    return this.requirementService.updateStage(
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async remove(@Param('id') id: string) {
    return this.requirementService.remove(id);
  }

  @Post(':id/duplicate')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async duplicate(@Param('id') id: string) {
    return this.requirementService.duplicate(id);
  }
}
