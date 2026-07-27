import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isObservable, lastValueFrom } from 'rxjs';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { ALLOW_PASSWORD_CHANGE_REQUIRED_KEY } from '../decorators/allow-password-change-required.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const activation = super.canActivate(context);
    const allowed = isObservable(activation)
      ? await lastValueFrom(activation)
      : await Promise.resolve(activation);

    if (!allowed) {
      return false;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const mayChangePassword = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (request.user?.mustChangePassword && !mayChangePassword) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password change required.',
      });
    }

    return true;
  }
}
