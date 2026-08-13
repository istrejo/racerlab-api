import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    const currentRole = request.user?.role;

    if (!currentRole) {
      return false;
    }

    if (currentRole === UserRole.OWNER) {
      return (
        requiredRoles.includes(UserRole.OWNER) ||
        requiredRoles.includes(UserRole.ADMIN)
      );
    }

    return requiredRoles.includes(currentRole);
  }
}
