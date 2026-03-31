import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma-exception.filter';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const mockHost = {
    switchToHttp: jest.fn().mockReturnThis(),
    getResponse: jest.fn().mockReturnValue(mockResponse),
  };

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    jest.clearAllMocks();
  });

  describe('P2002 - Unique constraint violation', () => {
    it('应该返回 409 CONFLICT 当唯一约束违反时', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        {
          code: 'P2002',
          clientVersion: '2.0.0',
          meta: { target: ['username'] },
          batchRequestIdx: undefined,
        }
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          message: 'username 已存在',
          error: 'P2002',
        })
      );
    });

    it('应该处理多个字段的唯一约束', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        {
          code: 'P2002',
          clientVersion: '2.0.0',
          meta: { target: ['username', 'email'] },
          batchRequestIdx: undefined,
        }
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'username, email 已存在',
        })
      );
    });

    it('应该处理没有 target 的情况', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        {
          code: 'P2002',
          clientVersion: '2.0.0',
          meta: {},
          batchRequestIdx: undefined,
        }
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '数据已存在',
        })
      );
    });
  });

  describe('P2003 - Foreign key constraint violation', () => {
    it('应该返回 400 BAD_REQUEST 当外键约束违反时', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint violation',
        {
          code: 'P2003',
          clientVersion: '2.0.0',
          meta: { field_name: 'versionId' },
          batchRequestIdx: undefined,
        }
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: '关联的 versionId 不存在',
          error: 'P2003',
        })
      );
    });

    it('应该处理没有 field_name 的情况', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint violation',
        {
          code: 'P2003',
          clientVersion: '2.0.0',
          meta: {},
          batchRequestIdx: undefined,
        }
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '关联数据不存在',
        })
      );
    });
  });

  describe('P2025 - Record not found', () => {
    it('应该返回 404 NOT_FOUND 当记录不存在时', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '2.0.0',
          meta: {},
          batchRequestIdx: undefined,
        }
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: '数据不存在',
          error: 'P2025',
        })
      );
    });
  });

  describe('P2016 - Query interpretation error', () => {
    it('应该返回 400 BAD_REQUEST 当查询解释错误时', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Query interpretation error',
        {
          code: 'P2016',
          clientVersion: '2.0.0',
          meta: {},
          batchRequestIdx: undefined,
        }
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: '查询参数错误',
          error: 'P2016',
        })
      );
    });
  });

  describe('未知错误码', () => {
    it('应该返回 500 INTERNAL_SERVER_ERROR 当错误码未知时', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unknown error',
        {
          code: 'P9999',
          clientVersion: '2.0.0',
          meta: {},
          batchRequestIdx: undefined,
        }
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: '数据库操作失败',
          error: 'P9999',
        })
      );
    });
  });

  describe('响应格式', () => {
    it('应该返回正确的响应结构', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Test error',
        {
          code: 'P2002',
          clientVersion: '2.0.0',
          meta: { target: ['test'] },
          batchRequestIdx: undefined,
        }
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: expect.any(Number),
          message: expect.any(String),
          error: expect.any(String),
          details: expect.any(Object),
        })
      );
    });
  });
});
