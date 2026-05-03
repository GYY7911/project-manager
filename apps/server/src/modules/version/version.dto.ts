import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { VersionStatus } from '@prisma/client';

export class CreateVersionDto {
  @IsString()
  name: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}

export class CreateOrUseVersionDto extends CreateVersionDto {
  @IsOptional()
  @IsBoolean()
  useExisting?: boolean;
}

export class UpdateVersionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(VersionStatus)
  status?: VersionStatus;
}
