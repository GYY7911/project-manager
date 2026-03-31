import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('team-overview')
  async getTeamOverview(
    @Query('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.analyticsService.getTeamOverview(
      versionId,
      user.sub,
      user.role as any,
    );
  }

  @Get('workload')
  async getWorkload(
    @Query('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.analyticsService.getWorkload(
      versionId,
      user.sub,
      user.role as any,
    );
  }

  @Get('requirement-risks')
  async getRequirementRisks(
    @Query('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.analyticsService.getRequirementRisks(
      versionId,
      user.sub,
      user.role as any,
    );
  }

  @Get('issue-risks')
  async getIssueRisks(
    @Query('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.analyticsService.getIssueRisks(
      versionId,
      user.sub,
      user.role as any,
    );
  }

  @Get('gantt')
  async getGanttData(
    @Query('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.analyticsService.getGanttData(
      versionId,
      user.sub,
      user.role as any,
    );
  }
}
