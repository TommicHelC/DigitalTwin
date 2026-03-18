import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({
    status: 200,
    description: 'Aplikacja działa poprawnie',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        version: { type: 'string', example: '0.1.0' },
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date(),
      version: process.env.npm_package_version || '0.1.0',
    };
  }
}
