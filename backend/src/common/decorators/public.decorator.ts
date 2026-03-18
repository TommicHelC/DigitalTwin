import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Oznacza endpoint jako publiczny — globalny JwtAuthGuard przepuszcza
 * żądania bez sprawdzania tokenu Bearer.
 *
 * Użycie:
 * @Public()
 * @Get('health')
 * getHealth() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
