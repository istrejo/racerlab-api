import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WorkshopContext } from '../auth/workshop-context';
import { AuthenticatedUser } from '../auth/authenticated-user';

export const CurrentWorkshop = createParamDecorator(
  (_data: unknown, context: ExecutionContext): WorkshopContext => {
    const user = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>().user;

    return {
      membershipId: user.membershipId as string,
      workshopId: user.workshopId as string,
      role: user.role as WorkshopContext['role'],
    };
  },
);
