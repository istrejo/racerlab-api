import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows an authenticated user when the current database role matches route metadata', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    jest.spyOn(context, 'switchToHttp').mockReturnValue({
      getRequest: () => ({ user: { role: UserRole.ADMIN } }),
    } as never);

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('allows OWNER to satisfy an ADMIN requirement', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    jest.spyOn(context, 'switchToHttp').mockReturnValue({
      getRequest: () => ({ user: { role: UserRole.OWNER } }),
    } as never);

    expect(guard.canActivate(context)).toBe(true);
  });

  it.each([
    {
      caseName: 'a route has no role metadata',
      roles: undefined,
      user: undefined,
    },
    {
      caseName: 'the current user role does not match',
      roles: [UserRole.ADMIN],
      user: { role: UserRole.MANAGER },
    },
    {
      caseName: 'ADMIN attempts an OWNER-only operation',
      roles: [UserRole.OWNER],
      user: { role: UserRole.ADMIN },
    },
    {
      caseName: 'the request user is absent',
      roles: [UserRole.ADMIN],
      user: undefined,
    },
  ])('handles $caseName correctly', ({ roles, user }) => {
    reflector.getAllAndOverride.mockReturnValue(roles);
    jest.spyOn(context, 'switchToHttp').mockReturnValue({
      getRequest: () => ({ user }),
    } as never);

    expect(guard.canActivate(context)).toBe(roles === undefined);
  });
});
