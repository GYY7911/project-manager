import { IsString } from 'class-validator';

export class CreateTestCycleDto {
  @IsString()
  name: string;

  @IsString()
  versionId: string;
}
