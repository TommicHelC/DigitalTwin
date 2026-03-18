import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, RefreshResponseDto } from './dto/auth-response.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logowanie użytkownika' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Pomyślne logowanie — zwraca access i refresh token',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Nieprawidłowy email lub hasło',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Odświeżenie access tokenu' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'Ważny refresh token',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Nowy access token',
    type: RefreshResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Nieprawidłowy lub wygasły refresh token',
  })
  async refresh(@Request() req: any): Promise<{ accessToken: string; tokenType: string }> {
    return this.authService.refresh(req.user.userId);
  }
}
