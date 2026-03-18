import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token (ważność: JWT_EXPIRES_IN, domyślnie 24h)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token (ważność: JWT_REFRESH_EXPIRES_IN, domyślnie 7d)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Typ tokenu',
    example: 'Bearer',
  })
  tokenType: string;

  @ApiProperty({
    description: 'Czas wygaśnięcia access tokenu w sekundach',
    example: 86400,
  })
  expiresIn: number;
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'Nowy JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Typ tokenu',
    example: 'Bearer',
  })
  tokenType: string;
}

/**
 * Payload przechowywany w JWT.
 * Pola zgodne z konfiguracją projektu.
 */
export interface JwtPayload {
  sub: string;        // userId (UUID)
  email: string;
  clientId: string;   // tenant ID
  role: 'admin' | 'user' | 'guest';
  iat?: number;       // issued at (automatycznie przez @nestjs/jwt)
  exp?: number;       // expiration (automatycznie przez @nestjs/jwt)
}
