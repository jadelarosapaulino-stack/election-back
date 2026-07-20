import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Guard para proteger endpoints GDPR.
 * Requiere rol `dpo` o `superadmin`.
 * En modo dev (sin usuario autenticado) permite el acceso para facilitar pruebas.
 *
 * Uso a nivel de controller:
 * ```ts
 * @Controller('gdpr')
 * @UseGuards(DpoGuard)
 * export class GdprController { ... }
 * ```
 *
 * Uso a nivel de método (override por ruta):
 * ```ts
 * @Get('health')
 * @Public() // o aplicar guard custom que niegue DpoGuard
 * async health() { ... }
 * ```
 */
@Injectable()
export class DpoGuard implements CanActivate {
  private readonly logger = new Logger(DpoGuard.name);
  private static readonly DPO_ROLES = ['dpo', 'superadmin'] as const;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Si el handler tiene @Public() o @SkipDpoGuard, permitir acceso
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Modo dev: si no hay usuario autenticado, permitir acceso
    if (!user) {
      this.logger.debug(
        'DpoGuard: no user in request — allowing (dev mode)',
      );
      return true;
    }

    const userRoles: string[] = (user.roles || []).map((role: string) =>
      role.trim().toLowerCase(),
    );

    const hasRequiredRole = DpoGuard.DPO_ROLES.some((requiredRole) =>
      userRoles.includes(requiredRole),
    );

    if (!hasRequiredRole) {
      this.logger.warn(
        `DpoGuard: user ${user.id ?? 'unknown'} denied — ` +
          `roles [${userRoles.join(', ')}] do not include [${DpoGuard.DPO_ROLES.join(', ')}]`,
      );
    }

    return hasRequiredRole;
  }
}
