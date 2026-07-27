import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard forced password change', () => {
  const handler = () => undefined;
  class Controller {}

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks private routes while the live identity requires a password change', async () => {
    jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockReturnValue(true);
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    const guard = new JwtAuthGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { mustChangePassword: true },
        }),
      }),
    };

    await expect(guard.canActivate(context as never)).rejects.toEqual(
      new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password change required.',
      }),
    );
  });

  it('allows explicitly exempt routes needed to recover the session', async () => {
    jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockReturnValue(true);
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    };
    const guard = new JwtAuthGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { mustChangePassword: true },
        }),
      }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });
});
