import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthResponse = {
    accessToken: 'mock.access.token',
    refreshToken: 'mock.refresh.token',
    tokenType: 'Bearer',
    expiresIn: 86400,
  };

  beforeEach(async () => {
    const mockAuthService = {
      login: jest.fn(),
      refresh: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('login', () => {
    it('should return auth response on valid credentials', async () => {
      const loginDto: LoginDto = {
        email: 'admin@hellcold.pl',
        password: 'password123',
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await authController.login(loginDto);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('refresh', () => {
    it('should return new access token', async () => {
      const mockRequest = { user: { userId: 'user-uuid-123' } };
      const mockRefreshResponse = {
        accessToken: 'new.access.token',
        tokenType: 'Bearer',
      };

      authService.refresh.mockResolvedValue(mockRefreshResponse);

      const result = await authController.refresh(mockRequest);

      expect(result).toEqual(mockRefreshResponse);
      expect(authService.refresh).toHaveBeenCalledWith('user-uuid-123');
    });
  });
});
