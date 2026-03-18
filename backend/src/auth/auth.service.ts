import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, JwtPayload } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Waliduje użytkownika na podstawie email i hasła.
   * Zwraca obiekt user bez passwordHash lub null jeśli dane są błędne.
   */
  async validateUser(email: string, password: string): Promise<Omit<UserEntity, 'passwordHash'> | null> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`Próba logowania na nieistniejące konto: ${email}`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      this.logger.warn(`Błędne hasło dla konta: ${email}`);
      return null;
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  /**
   * Loguje użytkownika — waliduje dane i generuje tokeny.
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Nieprawidłowy email lub hasło');
    }

    return this.generateTokens(user);
  }

  /**
   * Odświeża access token na podstawie ważnego refresh tokenu.
   * Przyjmuje payload wyciągnięty przez JwtRefreshStrategy (już zwalidowany).
   */
  async refresh(userId: string): Promise<{ accessToken: string; tokenType: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Użytkownik nie istnieje');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      clientId: user.clientId,
      role: user.role as 'admin' | 'user' | 'guest',
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
    };
  }

  /**
   * Generuje parę access + refresh token dla użytkownika.
   */
  private generateTokens(user: Omit<UserEntity, 'passwordHash'>): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      clientId: user.clientId,
      role: user.role as 'admin' | 'user' | 'guest',
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    // Oblicz expiresIn w sekundach
    const expiresIn = this.parseExpiry(
      this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  /**
   * Parsuje string czasu (np. '24h', '7d', '3600') na sekundy.
   */
  private parseExpiry(expiry: string): number {
    if (!isNaN(Number(expiry))) {
      return Number(expiry);
    }
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 86400;
    }
  }
}
