import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateTestCycleDto {
  name: string;
  versionId: string;
}

@Injectable()
export class TestCycleService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTestCycleDto, userId: string) {
    // 获取当前最大的order
    const maxOrder = await this.prisma.testCycle.aggregate({
      where: { versionId: dto.versionId },
      _max: { order: true },
    });

    return this.prisma.testCycle.create({
      data: {
        name: dto.name,
        versionId: dto.versionId,
        order: (maxOrder._max.order || 0) + 1,
        createdById: userId,
      },
    });
  }

  async findByVersion(versionId: string) {
    return this.prisma.testCycle.findMany({
      where: { versionId },
      orderBy: { order: 'asc' },
    });
  }

  async update(id: string, data: { name?: string; order?: number }) {
    return this.prisma.testCycle.update({
      where: { id },
      data,
    });
  }

  async reorder(testCycles: { id: string; order: number }[]) {
    const updates = testCycles.map((tc) =>
      this.prisma.testCycle.update({
        where: { id: tc.id },
        data: { order: tc.order },
      }),
    );

    return Promise.all(updates);
  }

  async remove(id: string) {
    const testCycle = await this.prisma.testCycle.findUnique({
      where: { id },
    });

    if (!testCycle) {
      throw new NotFoundException('转测版本不存在');
    }

    return this.prisma.testCycle.delete({
      where: { id },
    });
  }
}
