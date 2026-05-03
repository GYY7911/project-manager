import { IsString, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreditSourceType, CreditRuleType } from '@prisma/client';

export class CreateCreditRecordDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  ruleId?: string;

  @IsNumber()
  score: number;

  @IsEnum(CreditSourceType)
  sourceType: CreditSourceType;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  versionId?: string;

  @IsOptional()
  @IsString()
  requirementId?: string;

  @IsOptional()
  @IsString()
  issueId?: string;

  @IsOptional()
  @IsString()
  workflowStage?: string;

  @IsOptional()
  @IsNumber()
  delayDays?: number;

  @IsOptional()
  plannedDate?: Date;

  @IsOptional()
  actualDate?: Date;
}

export class CorrectRecordDto {
  @IsString()
  recordId: string;

  @IsOptional()
  @IsString()
  plannedDate?: string;

  @IsOptional()
  @IsString()
  actualDate?: string;

  @IsOptional()
  @IsNumber()
  overrideScore?: number;

  @IsString()
  reason: string;
}

export class BatchCorrectDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CorrectRecordDto)
  corrections: CorrectRecordDto[];
}

export class CreateCreditRuleDto {
  @IsEnum(CreditRuleType)
  ruleType: CreditRuleType;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  score: number;

  @IsOptional()
  @IsNumber()
  delayDays?: number;

  @IsOptional()
  isCustom?: boolean;
}
