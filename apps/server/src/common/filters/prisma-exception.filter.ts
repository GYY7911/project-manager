import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    console.error('[PrismaExceptionFilter] Database error:', {
      code: exception.code,
      meta: exception.meta,
      message: exception.message,
    });

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '数据库操作失败';
    let errorDetails: any = {};

    switch (exception.code) {
      case 'P2002': // Unique constraint violation
        status = HttpStatus.CONFLICT;
        const target = exception.meta?.target as string[] | undefined;
        message = target
          ? `${target.join(', ')} 已存在`
          : '数据已存在';
        errorDetails.field = target;
        break;

      case 'P2003': // Foreign key constraint violation
        status = HttpStatus.BAD_REQUEST;
        const field = exception.meta?.field_name as string | undefined;
        message = field
          ? `关联的 ${field.split('_')[0]} 不存在`
          : '关联数据不存在';
        errorDetails.field = field;
        break;

      case 'P2025': // Record not found
        status = HttpStatus.NOT_FOUND;
        message = '数据不存在';
        break;

      case 'P2016': // Query interpretation error
        status = HttpStatus.BAD_REQUEST;
        message = '查询参数错误';
        break;

      default:
        // Log unknown error codes for debugging
        console.error('[PrismaExceptionFilter] Unknown Prisma error code:', exception.code);
        break;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.code,
      details: errorDetails,
    });
  }
}
