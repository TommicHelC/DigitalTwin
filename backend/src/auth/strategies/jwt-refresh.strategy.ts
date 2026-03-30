import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../dto/auth-response.dto';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    super({
      // Wyciągaj token z body.refreshToken lub Authorization header
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.body?.refreshToken ?? null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  /**
   * Wywoływane przez Passport po weryfikacji refresh tokenu.
   * Zwraca payload użytkownika — refresh token jest też przekazywany
   * żeby można było go unieważnić (blacklist) w przyszłości.
   */
  async validate(request: Request, payload: JwtPayload) {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Nieprawidłowy refresh token');
    }

    const refreshToken =
      request.body?.refreshToken ||
      request.headers.authorization?.replace('Bearer ', '');

    return {
      userId: payload.sub,
      email: payload.email,
      clientId: payload.clientId,
      role: payload.role,
      refreshToken,
    };
  }
}
