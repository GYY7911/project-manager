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
import { CreditService, CorrectRecordDto, BatchCorrectDto } from './credit.service';
import { CreditRuleService, CreateCreditRuleDto } from './credit-rule.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditController {
  constructor(
    private creditService: CreditService,
    private ruleService: CreditRuleService,
  ) {}

  // ===== 信用规则 =====

  @Post('rules')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async createRule(@Body() dto: CreateCreditRuleDto, @Request() req: any) {
    return this.ruleService.create(dto, req.user.id);
  }

  @Get('rules')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async findAllRules() {
    return this.ruleService.findAll();
  }

  @Put('rules/:id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async updateRule(
    @Param('id') id: string,
    @Body() data: Partial<CreateCreditRuleDto>,
  ) {
    return this.ruleService.update(id, data);
  }

  @Delete('rules/:id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async removeRule(@Param('id') id: string) {
    return this.ruleService.remove(id);
  }

  @Post('rules/init')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async initDefaultRules(@Request() req: any) {
    await this.ruleService.initDefaultRules(req.user.id);
    return { message: '默认规则初始化完成' };
  }

  // ===== 信用记录 =====

  @Get('records')
  async getUserRecords(
    @Query('versionId') versionId?: string,
    @Query('userId') userId?: string,
    @Request() req?: any,
  ) {
    // 组员只能看自己的记录
    if (req.user.role === UserRole.MEMBER) {
      return this.creditService.getUserRecords(req.user.id, versionId);
    }
    // PM可以看所有人的记录
    const targetUserId = userId || req.user.id;
    return this.creditService.getUserRecords(targetUserId, versionId);
  }

  @Post('adjust')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async manualAdjust(
    @Body()
    data: {
      userId: string;
      versionId: string;
      score: number;
      remark: string;
    },
    @Request() req: any,
  ) {
    return this.creditService.manualAdjust(
      data.userId,
      data.versionId,
      data.score,
      data.remark,
      req.user.name,
    );
  }

  // ===== 信用汇总 =====

  @Get('summary')
  async getUserSummary(
    @Query('versionId') versionId: string,
    @Request() req: any,
  ) {
    return this.creditService.getUserSummary(req.user.id, versionId);
  }

  @Get('summaries')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async getAllSummaries(@Query('versionId') versionId: string) {
    return this.creditService.getAllSummaries(versionId);
  }

  // ===== 新增：信用详情 =====

  @Get('detail/:userId')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async getUserCreditDetail(
    @Param('userId') userId: string,
    @Query('versionId') versionId: string,
  ) {
    return this.creditService.getUserCreditDetail(userId, versionId);
  }

  // ===== 新增：矫正功能 =====

  @Post('preview-correction')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async previewCorrection(@Body() dto: CorrectRecordDto) {
    return this.creditService.previewCorrection(dto);
  }

  @Post('correct')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async correctRecord(
    @Body() dto: CorrectRecordDto,
    @Request() req: any,
  ) {
    return this.creditService.correctRecord(dto, req.user.id);
  }

  @Post('batch-correct')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async batchCorrectRecords(
    @Body() dto: BatchCorrectDto,
    @Request() req: any,
  ) {
    return this.creditService.batchCorrectRecords(dto, req.user.id);
  }

  @Get('corrections/:recordId')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async getCorrectionHistory(@Param('recordId') recordId: string) {
    return this.creditService.getCorrectionHistory(recordId);
  }

  // ===== 新增：版本延期率检查 =====

  @Get('delay-check/:versionId')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async checkVersionDelayPenalty(@Param('versionId') versionId: string) {
    return this.creditService.checkVersionDelayPenalty(versionId);
  }
}
