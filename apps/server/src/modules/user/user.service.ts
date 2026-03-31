import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUserRole: UserRole) {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        employeeNo: true,
        name: true,
        username: true,
        role: true,
        team: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return users;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeNo: true,
        name: true,
        username: true,
        role: true,
        team: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  async update(
    id: string,
    data: { name?: string; team?: string; role?: UserRole },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        employeeNo: true,
        name: true,
        username: true,
        role: true,
        team: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async getAssigneeList() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        employeeNo: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
