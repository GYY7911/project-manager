import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { WorkflowStage, IssueSeverity } from '@prisma/client';

export class CreateIssueDto {
  @IsString()
  code: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(IssueSeverity)
  severity?: IssueSeverity;

  @IsString()
  versionId: string;

  @IsString()
  assigneeId: string;

  @IsOptional()
  @IsString()
  requirementId?: string;

  @IsOptional()
  @IsString()
  testCycleId?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class UpdateIssueDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(IssueSeverity)
  severity?: IssueSeverity;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  testCycleId?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class UpdateIssueStageDto {
  @IsEnum(WorkflowStage)
  stage: WorkflowStage;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsBoolean()
  ccbApproved?: boolean;
}
