import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const delay = Date.now() - start;
          this.logger.log(
            `${method} ${url} ${response.statusCode} — ${delay}ms [${ip}] "${userAgent}"`,
          );
        },
        error: (error) => {
          const delay = Date.now() - start;
          this.logger.error(
            `${method} ${url} ${error.status || 500} — ${delay}ms [${ip}] "${userAgent}" — ${error.message}`,
          );
        },
      }),
    );
  }
}
