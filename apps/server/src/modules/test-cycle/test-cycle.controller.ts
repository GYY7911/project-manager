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
import { TestCycleService } from './test-cycle.service';
import { CreateTestCycleDto } from './test-cycle.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('test-cycles')
@UseGuards(JwtAuthGuard)
export class TestCycleController {
  constructor(private testCycleService: TestCycleService) {}

  @Post()
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async create(@Body() dto: CreateTestCycleDto, @Request() req: any) {
    return this.testCycleService.create(dto, req.user.id);
  }

  @Get()
  async findByVersion(@Query('versionId') versionId: string) {
    return this.testCycleService.findByVersion(versionId);
  }

  @Put(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async update(
    @Param('id') id: string,
    @Body() data: { name?: string; order?: number },
  ) {
    return this.testCycleService.update(id, data);
  }

  @Put('reorder')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async reorder(@Body() testCycles: { id: string; order: number }[]) {
    return this.testCycleService.reorder(testCycles);
  }

  @Delete(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async remove(@Param('id') id: string) {
    return this.testCycleService.remove(id);
  }
}
