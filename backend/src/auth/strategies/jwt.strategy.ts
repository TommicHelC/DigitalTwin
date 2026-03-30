import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../dto/auth-response.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Wywoływane przez Passport po weryfikacji podpisu JWT.
   * Zwrócony obiekt jest ustawiany jako request.user.
   */
  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.email || !payload.clientId) {
      throw new UnauthorizedException('Nieprawidłowy payload tokenu JWT');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      clientId: payload.clientId,
      role: payload.role,
    };
  }
}
