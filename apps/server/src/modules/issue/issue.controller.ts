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
import { IssueService } from './issue.service';
import { CreateIssueDto, UpdateIssueDto, UpdateIssueStageDto } from './issue.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('issues')
@UseGuards(JwtAuthGuard)
export class IssueController {
  constructor(private issueService: IssueService) {}

  @Post()
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async create(@Body() dto: CreateIssueDto) {
    return this.issueService.create(dto);
  }

  @Get()
  async findAll(
    @Query('versionId') versionId?: string,
    @Query('testCycleId') testCycleId?: string,
  ) {
    return this.issueService.findAll(versionId, testCycleId);
  }

  @Get('generate-code')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async generateCode(@Query('versionId') versionId: string) {
    return { code: await this.issueService.generateCode(versionId) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.issueService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateIssueDto) {
    return this.issueService.update(id, dto);
  }

  @Put(':id/stage')
  async updateStage(
    @Param('id') id: string,
    @Body() dto: UpdateIssueStageDto,
    @Request() req: any,
  ) {
    return this.issueService.updateStage(id, dto, req.user.id, req.user.role);
  }

  @Put(':id/ccb')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async updateCcbStatus(
    @Param('id') id: string,
    @Body('ccbApproved') ccbApproved: boolean,
  ) {
    return this.issueService.updateCcbStatus(id, ccbApproved);
  }

  @Delete(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async remove(@Param('id') id: string) {
    return this.issueService.remove(id);
  }

  @Post(':id/duplicate')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async duplicate(@Param('id') id: string) {
    return this.issueService.duplicate(id);
  }
}
