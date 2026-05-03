import { IsString, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowStage } from '@prisma/client';

export class StageDeadlineDto {
  @IsEnum(WorkflowStage)
  stage: WorkflowStage;

  @IsString()
  plannedDate: string;
}

export class CreateDelayConfigDto {
  @IsString()
  entityId: string;

  @IsString()
  entityType: 'requirement' | 'issue';

  @IsString()
  versionId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageDeadlineDto)
  stageDeadlines: StageDeadlineDto[];

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  operatedBy?: string;
}

export class BatchImportItemDto {
  @IsString()
  code: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageDeadlineDto)
  stageDeadlines: StageDeadlineDto[];
}

export class BatchImportDto {
  @IsString()
  versionId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchImportItemDto)
  items: BatchImportItemDto[];
}
