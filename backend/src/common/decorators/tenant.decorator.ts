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
