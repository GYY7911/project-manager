import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { WorkflowStage } from '@prisma/client';

export class CreateRequirementDto {
  @IsString()
  code: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsString()
  versionId: string;

  @IsString()
  assigneeId: string;

  @IsOptional()
  @IsNumber()
  workload?: number;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class UpdateRequirementDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsNumber()
  workload?: number;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class UpdateStageDto {
  @IsEnum(WorkflowStage)
  stage: WorkflowStage;

  @IsOptional()
  @IsString()
  remark?: string;
}
