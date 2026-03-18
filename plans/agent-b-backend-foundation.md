# Agent B — Backend Foundation (NestJS scaffold + auth + common + Docker)

## 1. Cel i zakres

Agent B odpowiada za zbudowanie fundamentów backendu platformy HVAC Digital Twin dla HellCold sp. z o.o. Zadaniem jest stworzenie projektu NestJS 10 od zera: scaffold aplikacji, moduł uwierzytelniania JWT (access + refresh token), wspólne elementy (guards, filters, interceptors, decorators) oraz konfigurację Docker (dev i produkcja).

Po zakończeniu pracy Agenta B musi działać:
- `cd backend && npm install && npm run build` — bez błędów
- Kontener uruchamiany przez `docker-compose up backend` przyjmuje żądania na porcie 3001
- `GET /api/health` zwraca `{ status: 'ok', ... }`
- `POST /api/auth/login` z poprawnymi danymi zwraca `accessToken` i `refreshToken`
- Swagger UI dostępny pod `/api/docs`

Zakres NIE obejmuje: modułów telemetrycznych, integracji Daikin/ThingsBoard/D365, modułu urządzeń, frontendu. Te dodają kolejni agenci.

---

## 2. Lista plików do stworzenia

```
backend/
├── package.json                              ← definicja projektu i zależności
├── tsconfig.json                             ← konfiguracja TypeScript (bazowa)
├── tsconfig.build.json                       ← konfiguracja TS dla builda (wyklucza testy)
├── nest-cli.json                             ← konfiguracja NestJS CLI
├── .eslintrc.js                              ← reguły ESLint dla TypeScript
├── docker/
│   ├── Dockerfile                            ← obraz produkcyjny (multi-stage)
│   └── Dockerfile.dev                        ← obraz deweloperski z hot-reload
└── src/
    ├── main.ts                               ← punkt wejścia aplikacji
    ├── app.module.ts                         ← root moduł, konfiguracja TypeORM / Config / Schedule
    ├── app.controller.ts                     ← endpoint /health
    ├── app.controller.spec.ts                ← testy jednostkowe AppController
    ├── common/
    │   ├── decorators/
    │   │   ├── tenant.decorator.ts           ← @CurrentTenant() — wyciąga clientId z JWT
    │   │   └── public.decorator.ts           ← @Public() — pomija globalny guard
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts             ← globalny guard JWT, respektuje @Public()
    │   │   └── roles.guard.ts                ← guard ról (admin only)
    │   ├── interceptors/
    │   │   └── logging.interceptor.ts        ← loguje req/res w trybie dev
    │   └── filters/
    │       └── http-exception.filter.ts      ← ujednolicony format odpowiedzi błędów
    └── auth/
        ├── auth.module.ts                    ← moduł auth, rejestruje strategie i kontroler
        ├── auth.service.ts                   ← logika login/refresh/validateUser
        ├── auth.controller.ts                ← POST /auth/login, POST /auth/refresh
        ├── auth.controller.spec.ts           ← testy jednostkowe AuthController
        ├── strategies/
        │   ├── jwt.strategy.ts               ← Passport strategy dla access token
        │   └── jwt-refresh.strategy.ts       ← Passport strategy dla refresh token
        └── dto/
            ├── login.dto.ts                  ← DTO żądania logowania
            └── auth-response.dto.ts          ← DTO odpowiedzi z tokenami
```

---

## 3. Szczegóły każdego pliku

### 3.1 `backend/package.json`

Definicja projektu NestJS. Zawiera wszystkie zależności runtime (w tym Azure Identity, MQTT, TypeORM, bcrypt) oraz devDependencies. Wersje są przypięte zgodnie ze stackiem projektu.

```json
{
  "name": "hvac-backend",
  "version": "0.1.0",
  "description": "HVAC Digital Twin Platform — NestJS backend",
  "author": "HellCold Sp. z o.o.",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/schedule": "^4.1.0",
    "@nestjs/swagger": "^7.4.0",
    "@nestjs/typeorm": "^10.0.2",
    "@azure/identity": "^4.4.0",
    "axios": "^1.7.0",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "mqtt": "^5.10.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pg": "^8.13.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "@types/passport-jwt": "^4.0.1",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "jest": "^29.7.0",
    "prettier": "^3.3.0",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.0",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.4.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

---

### 3.2 `backend/tsconfig.json`

Bazowa konfiguracja TypeScript. Włącza dekoratory eksperymentalne (wymagane przez NestJS i TypeORM).

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false
  }
}
```

---

### 3.3 `backend/tsconfig.build.json`

Rozszerza bazową konfigurację. Wyklucza pliki testowe i node_modules z kompilacji produkcyjnej.

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

---

### 3.4 `backend/nest-cli.json`

Konfiguracja NestJS CLI — wskazuje katalog źródłowy i opcje kompilatora.

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

---

### 3.5 `backend/.eslintrc.js`

Konfiguracja ESLint z regułami TypeScript i Prettier.

```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
```

---

### 3.6 `backend/docker/Dockerfile`

Obraz produkcyjny. Buduje aplikację w etapie `builder`, następnie kopiuje tylko skompilowane pliki do lekkiego obrazu produkcyjnego. Użytkownik `node` (non-root) dla bezpieczeństwa.

```dockerfile
# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

WORKDIR /app

# Kopiujemy tylko package.json żeby zainstalować production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Kopiujemy skompilowane pliki
COPY --from=builder /app/dist ./dist

# Użytkownik non-root
USER node

EXPOSE 3001

CMD ["node", "dist/main"]
```

---

### 3.7 `backend/docker/Dockerfile.dev`

Obraz deweloperski. Instaluje wszystkie zależności (w tym devDependencies), montuje kod przez volume i uruchamia hot-reload. Eksponuje port debuggera 9229.

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Instalujemy zależności w osobnej warstwie (cache)
COPY package*.json ./
RUN npm install

# Kod aplikacji jest montowany przez volume w docker-compose.yml
# dlatego nie kopiujemy src tutaj

EXPOSE 3001
EXPOSE 9229

CMD ["npm", "run", "start:dev"]
```

---

### 3.8 `backend/src/main.ts`

Punkt wejścia aplikacji. Konfiguruje CORS, ValidationPipe, globalny prefix `api`, Swagger oraz graceful shutdown.

Ważne uwagi:
- `excludeGlobalPrefixes` nie istnieje w NestJS — zamiast tego endpoint `/health` i `/webhook` są definiowane z pełną ścieżką z prefixem `/api/health` (lub kontroler ma własny prefix). W tym projekcie `/health` jest dostępne jako `/api/health`.
- Swagger jest wyłączony w produkcji (`NODE_ENV !== 'production'`) dla bezpieczeństwa — możesz to zmienić jeśli potrzebujesz dokumentacji w prod.

```typescript
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors (tylko w dev)
  if (process.env.NODE_ENV !== 'production') {
    app.useGlobalInterceptors(new LoggingInterceptor());
  }

  // Global guard JWT (reflector wymagany do obsługi @Public())
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // Swagger (wyłączony w produkcji)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('HVAC Digital Twin API')
      .setDescription('API platformy HVAC Digital Twin — HellCold Sp. z o.o.')
      .setVersion('0.1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Wprowadź JWT access token',
          in: 'header',
        },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`[Bootstrap] Application running on port ${port}`);
  console.log(`[Bootstrap] Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Bootstrap] Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
```

---

### 3.9 `backend/src/app.module.ts`

Root moduł aplikacji. Konfiguruje globalnie: ConfigModule, TypeORM (async z ConfigService), ScheduleModule. Importuje AuthModule. Zawiera zakomentowane placeholdery dla modułów dodawanych przez innych agentów.

Uwaga: `synchronize: false` — migracje są zarządzane ręcznie lub przez dedykowanego agenta. Encje są wykrywane automatycznie z `dist/**/*.entity.js`.

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';

// TODO: Dodawane przez kolejnych agentów:
// import { DevicesModule } from './devices/devices.module';
// import { TelemetryModule } from './telemetry/telemetry.module';
// import { DaikinModule } from './daikin/daikin.module';
// import { ThingsBoardModule } from './thingsboard/thingsboard.module';
// import { D365Module } from './d365/d365.module';

@Module({
  imports: [
    // Konfiguracja globalna — dostępna w całej aplikacji
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // TypeORM — async config z ConfigService
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'hvac_user'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME', 'hvac'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') === 'development',
        ssl: configService.get<string>('NODE_ENV') === 'production'
          ? { rejectUnauthorized: false }
          : false,
        // Połączenie pool
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
    }),

    // Cron jobs (używane przez DaikinModule i inne)
    ScheduleModule.forRoot(),

    // Auth
    AuthModule,

    // TODO: pozostałe moduły
  ],
  controllers: [AppController],
})
export class AppModule {}
```

---

### 3.10 `backend/src/app.controller.ts`

Kontroler root. Udostępnia endpoint `/api/health` oznaczony jako `@Public()` — nie wymaga tokenu JWT.

```typescript
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
```

---

### 3.11 `backend/src/app.controller.spec.ts`

Podstawowe testy jednostkowe kontrolera health.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('should return status ok', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('ok');
    });

    it('should return a timestamp', () => {
      const result = appController.getHealth();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return version', () => {
      const result = appController.getHealth();
      expect(result.version).toBeDefined();
    });
  });
});
```

---

### 3.12 `backend/src/common/decorators/public.decorator.ts`

Dekorator `@Public()` — oznacza endpoint jako publiczny. Globalny `JwtAuthGuard` sprawdza ten metadata i przepuszcza żądanie bez weryfikacji tokenu.

```typescript
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
```

---

### 3.13 `backend/src/common/decorators/tenant.decorator.ts`

Dekorator parametru `@CurrentTenant()` — wyciąga `clientId` z obiektu `request.user` (ustawionego przez JwtAuthGuard po walidacji tokenu). Używany w kontrolerach do filtrowania danych per-tenant.

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Wyciąga clientId (tenant ID) z JWT payload ustawionego przez JwtStrategy.
 *
 * Użycie:
 * @Get('devices')
 * getDevices(@CurrentTenant() tenantId: string) {
 *   return this.devicesService.findAll(tenantId);
 * }
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return user?.clientId;
  },
);

/**
 * Wyciąga cały obiekt user z request (ustawiony przez JwtStrategy).
 * Użycie: @CurrentUser() user: RequestUser
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

---

### 3.14 `backend/src/common/guards/jwt-auth.guard.ts`

Globalny guard JWT. Sprawdza metadata `isPublic` — jeśli ustawione przez `@Public()`, przepuszcza żądanie. W przeciwnym razie deleguje do standardowego `AuthGuard('jwt')` z Passport, który weryfikuje Bearer token i ustawia `request.user`.

```typescript
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Sprawdź czy endpoint jest publiczny (@Public())
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Deleguj do AuthGuard('jwt') — weryfikuje Bearer token
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Nieprawidłowy lub brakujący token JWT');
    }
    return user;
  }
}
```

---

### 3.15 `backend/src/common/guards/roles.guard.ts`

Guard ról. Sprawdza czy zalogowany użytkownik (`request.user`) ma wymaganą rolę. Używany razem z dekoratorem `@Roles('admin')`.

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';

/**
 * Dekorator @Roles(...roles) — definiuje wymagane role dla endpointu.
 * Używany razem z RolesGuard.
 *
 * Użycie:
 * @Roles('admin')
 * @Delete(':id')
 * remove(@Param('id') id: string) { ... }
 */
import { SetMetadata } from '@nestjs/common';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Jeśli nie ma wymaganych ról — przepuszczamy
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    return requiredRoles.includes(user.role);
  }
}
```

---

### 3.16 `backend/src/common/interceptors/logging.interceptor.ts`

Interceptor logowania. Aktywny tylko w trybie deweloperskim (włączany warunkowo w `main.ts`). Loguje metodę HTTP, URL, czas odpowiedzi i status.

```typescript
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
```

---

### 3.17 `backend/src/common/filters/http-exception.filter.ts`

Globalny filtr wyjątków HTTP. Zapewnia ujednolicony format odpowiedzi błędów we wszystkich endpointach. Obsługuje zarówno wbudowane wyjątki NestJS (`HttpException`) jak i nieoczekiwane błędy (500).

Format odpowiedzi błędu:
```json
{
  "statusCode": 401,
  "message": "Nieprawidłowy token JWT",
  "error": "Unauthorized",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "path": "/api/devices"
}
```

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.message;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message || exception.message;
        error = resp.error || exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else {
      // Nieoczekiwany błąd — logujemy stack trace
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'Internal Server Error';
      this.logger.error(
        `Unhandled exception: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    const errorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(errorResponse);
  }
}
```

---

### 3.18 `backend/src/auth/dto/login.dto.ts`

DTO dla żądania logowania. Walidacja przez class-validator. Swagger dekoratory dla dokumentacji.

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Adres email użytkownika',
    example: 'admin@hellcold.pl',
  })
  @IsEmail({}, { message: 'Nieprawidłowy format adresu email' })
  email: string;

  @ApiProperty({
    description: 'Hasło użytkownika',
    example: 'SecurePassword123!',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Hasło musi mieć co najmniej 6 znaków' })
  password: string;
}
```

---

### 3.19 `backend/src/auth/dto/auth-response.dto.ts`

DTO odpowiedzi autoryzacji. Zwracane po pomyślnym logowaniu lub odświeżeniu tokenu.

```typescript
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
```

---

### 3.20 `backend/src/auth/strategies/jwt.strategy.ts`

Passport strategy dla access tokenu. Wyciąga token z nagłówka `Authorization: Bearer <token>`, weryfikuje podpis używając `JWT_SECRET`, zwraca sparsowany payload jako `request.user`.

```typescript
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
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-secret-change-in-production',
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
```

---

### 3.21 `backend/src/auth/strategies/jwt-refresh.strategy.ts`

Passport strategy dla refresh tokenu. Obsługuje dwa sposoby przekazania tokenu:
1. Z nagłówka `Authorization: Bearer <token>`
2. Z ciała żądania `body.refreshToken`

Używa osobnego sekretu `JWT_REFRESH_SECRET`.

```typescript
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
      secretOrKey:
        configService.get<string>('JWT_REFRESH_SECRET') ||
        'fallback-refresh-secret-change-in-production',
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
```

---

### 3.22 `backend/src/auth/auth.service.ts`

Serce modułu auth. Obsługuje logowanie, odświeżanie tokenów i walidację użytkownika.

Ważna uwaga o encji `User`: Agent B definiuje interfejs użytkownika jako `UserEntity` z polami `id`, `email`, `passwordHash`, `clientId`, `role`. Pełna definicja encji z TypeORM (tabela `config.users`) należy do Agenta C (moduł urządzeń/użytkowników) lub może być stworzona tutaj jako minimalna encja.

W tym pliku zakładamy, że `UserEntity` istnieje w `src/users/user.entity.ts`. Agent B tworzy minimalną encję w sekcji 3.23.

```typescript
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
```

---

### 3.23 `backend/src/users/user.entity.ts`

Minimalna encja użytkownika wymagana przez `AuthService`. Używa schematu `config` (tabela `config.users`). Pełne rozbudowanie tej encji (relacje do urządzeń, klientów itp.) należy do kolejnych agentów.

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users', schema: 'config' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @Column({ default: 'user' })
  role: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

### 3.24 `backend/src/auth/auth.controller.ts`

Kontroler autoryzacji. Oba endpointy oznaczone `@Public()` — nie wymagają tokenu. Używa Swagger dekoratorów dla dokumentacji.

```typescript
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
```

---

### 3.25 `backend/src/auth/auth.controller.spec.ts`

Testy jednostkowe kontrolera auth z mockowanym `AuthService`.

```typescript
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
```

---

### 3.26 `backend/src/auth/auth.module.ts`

Moduł auth. Rejestruje `JwtModule` z konfiguracją z `ConfigService`, importuje `TypeOrmModule` dla `UserEntity`, dostarcza strategie Passport i `AuthService`.

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { UserEntity } from '../users/user.entity';

@Module({
  imports: [
    // PassportModule z domyślną strategią jwt
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JwtModule async — pobiera sekret z ConfigService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'fallback-secret-change-in-production',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '24h',
        },
      }),
    }),

    // Repozytorium użytkowników (schema config)
    TypeOrmModule.forFeature([UserEntity]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
```

---

## 4. Kolejność implementacji

Implementuj w tej kolejności — każdy krok musi skompilować się bez błędów przed przejściem do następnego:

### Krok 1 — Konfiguracja projektu (pliki konfiguracyjne)
1. `package.json` — zainstaluj zależności (`npm install`)
2. `tsconfig.json`
3. `tsconfig.build.json`
4. `nest-cli.json`
5. `.eslintrc.js`

Weryfikacja: `npm install` powinien zakończyć się bez błędów.

### Krok 2 — Common (dekoratory, guards, interceptors, filters)
6. `src/common/decorators/public.decorator.ts`
7. `src/common/decorators/tenant.decorator.ts`
8. `src/common/filters/http-exception.filter.ts`
9. `src/common/interceptors/logging.interceptor.ts`
10. `src/common/guards/jwt-auth.guard.ts`
11. `src/common/guards/roles.guard.ts`

Weryfikacja: `npx tsc --noEmit` na tych plikach nie powinien zgłaszać błędów.

### Krok 3 — Encja User
12. `src/users/user.entity.ts`

### Krok 4 — Auth (DTOs → strategie → serwis → kontroler → moduł)
13. `src/auth/dto/login.dto.ts`
14. `src/auth/dto/auth-response.dto.ts`
15. `src/auth/strategies/jwt.strategy.ts`
16. `src/auth/strategies/jwt-refresh.strategy.ts`
17. `src/auth/auth.service.ts`
18. `src/auth/auth.controller.ts`
19. `src/auth/auth.controller.spec.ts`
20. `src/auth/auth.module.ts`

### Krok 5 — Root aplikacji
21. `src/app.controller.ts`
22. `src/app.controller.spec.ts`
23. `src/app.module.ts`
24. `src/main.ts`

### Krok 6 — Docker
25. `docker/Dockerfile`
26. `docker/Dockerfile.dev`

### Krok 7 — Weryfikacja końcowa
```bash
cd backend
npm run build
# Powinno wypisać: "Successfully compiled X files" bez błędów

npm run test
# Powinny przejść testy AppController i AuthController

npm run lint
# Powinno zwrócić 0 błędów (lub tylko warnings)
```

---

## 5. Weryfikacja

### Build
```bash
cd backend
npm install
npm run build
```
Oczekiwany wynik: katalog `dist/` z skompilowanymi plikami JS. Brak błędów TypeScript.

### Testy jednostkowe
```bash
npm run test
```
Oczekiwany wynik: `AppController` i `AuthController` — wszystkie testy zielone.

### Uruchomienie lokalne (bez Docker)
Wymagany plik `.env` w katalogu `backend/`:
```env
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=hvac_user
DB_PASSWORD=your_password
DB_NAME=hvac
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

```bash
npm run start:dev
# Oczekiwane logi:
# [Bootstrap] Application running on port 3001
# [Bootstrap] Environment: development
# [Bootstrap] Swagger docs: http://localhost:3001/api/docs
```

### Weryfikacja endpointów (curl)
```bash
# Health check (publiczny)
curl http://localhost:3001/api/health
# Oczekiwana odpowiedź: {"status":"ok","timestamp":"...","version":"0.1.0"}

# Swagger UI
# Otwórz w przeglądarce: http://localhost:3001/api/docs

# Chroniony endpoint bez tokenu (powinien zwrócić 401)
curl http://localhost:3001/api/some-protected-endpoint
# Oczekiwana odpowiedź: {"statusCode":401,"message":"Nieprawidłowy lub brakujący token JWT",...}
```

### Uruchomienie przez Docker (dev)
Zakładając że `docker-compose.yml` jest skonfigurowany przez Agenta A:
```bash
docker-compose up backend
```
Oczekiwane: kontener startuje, logi pokazują `Application running on port 3001`.

---

## 6. Uwagi i pułapki

1. **`emitDecoratorMetadata: true`** w `tsconfig.json` jest WYMAGANE dla NestJS i TypeORM. Bez tego dekoratory nie działają.

2. **`reflect-metadata`** musi być zaimportowane JAKO PIERWSZE w `main.ts`. NestJS robi to automatycznie przez `@nestjs/core`, ale upewnij się że nie ma konfliktów.

3. **TypeORM `synchronize: false`** — nigdy nie używaj `synchronize: true` w środowisku innym niż lokalne testy. Migracje muszą być zarządzane ręcznie.

4. **Schemat bazy `config`** — tabela users jest w schemacie `config`, nie w domyślnym `public`. Upewnij się że w PostgreSQL schemat `config` istnieje (tworzy go Agent A przez migrację/init SQL).

5. **`@Public()` i globalny guard** — globalny guard jest rejestrowany w `main.ts` przez `app.useGlobalGuards()`, co oznacza że NIE jest wstrzykiwany przez DI container NestJS. Dlatego `Reflector` musi być pobierany przez `app.get(Reflector)` i przekazywany do konstruktora.

6. **Fallback sekrety JWT** — stringi `'fallback-secret-...'` są tylko zabezpieczeniem przed crashem przy braku env. W produkcji ZAWSZE ustaw `JWT_SECRET` i `JWT_REFRESH_SECRET` przez zmienne środowiskowe. Wartości muszą mieć min. 32 znaki.

7. **Swagger pod `/api/docs`** — prefix `api` jest ustawiany przez `app.setGlobalPrefix('api')`, więc `SwaggerModule.setup('api/docs', ...)` rejestruje Swagger pod `/api/docs` (nie duplikuje prefiksu — `setup` przyjmuje pełną ścieżkę).

8. **`UserEntity`** zdefiniowana w `src/users/user.entity.ts` — Agent C lub kolejni agenci mogą tę encję rozbudować (dodać relacje). Agent B tworzy minimalną wersję potrzebną do auth.
