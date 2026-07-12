import { UserRole } from '@prisma/client';
import { CurrentUser } from './current-user.decorator';
import { ROLES_KEY, Roles } from './roles.decorator';

class ProtectedRoute {
  list(@CurrentUser() user: unknown): void {
    void user;
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(): void {}
}

describe('auth request decorators', () => {
  it('stores the required enum roles as route metadata', () => {
    const updateDescriptor = Object.getOwnPropertyDescriptor(
      ProtectedRoute.prototype,
      'update',
    );
    const update = updateDescriptor?.value as unknown;

    if (typeof update !== 'function') {
      throw new Error(
        'Expected the protected route to expose an update handler.',
      );
    }

    expect(Reflect.getMetadata(ROLES_KEY, update)).toEqual([
      UserRole.ADMIN,
      UserRole.MANAGER,
    ]);
  });

  it('marks a controller parameter as the current request user', () => {
    const metadata = Reflect.getMetadata(
      '__routeArguments__',
      ProtectedRoute,
      'list',
    ) as Record<
      string,
      { factory: (data: unknown, context: unknown) => unknown }
    >;
    const factory = Object.values(metadata)[0].factory;

    expect(
      factory(undefined, {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
              email: 'ada@example.com',
              role: UserRole.ADMIN,
              isActive: true,
            },
          }),
        }),
      }),
    ).toEqual({
      id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
      email: 'ada@example.com',
      role: UserRole.ADMIN,
      isActive: true,
    });
  });
});
