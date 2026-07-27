import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';

@Injectable()
export class WorkshopContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user?.membershipId || !user.workshopId || !user.role) {
      throw new ForbiddenException('An active workshop is required.');
    }

    return true;
  }
}
