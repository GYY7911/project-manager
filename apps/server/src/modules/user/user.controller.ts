import {
  Controller,
  Get,
  Param,
  Put,
  Body,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async findAll(@Request() req: { user: { role: UserRole } }) {
    return this.userService.findAll(req.user.role);
  }

  @Get('assignees')
  async getAssigneeList() {
    return this.userService.getAssigneeList();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async update(
    @Param('id') id: string,
    @Body() data: { name?: string; team?: string; role?: UserRole },
  ) {
    return this.userService.update(id, data);
  }

  @Delete(':id')
  @Roles(UserRole.PM, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
