import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PasswordHasherService } from '../src/common/security/password-hasher.service';
import { configureApp } from '../src/main';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { applyJwtTestEnv } from '../src/testing/jwt-test-env';

type AuthSessionCreateArgs = {
  data: Record<string, unknown>;
};

type AuthSessionUpdateArgs = {
  data: { activeMembershipId?: string | null };
};

type MembershipWhere = {
  id?: string;
  workshopId?: string;
  userId?: string;
};

type MembershipQueryArgs = {
  where: MembershipWhere;
};

type AuthResponseBody = {
  accessToken: string;
  activeWorkshop: unknown;
  requiresWorkshopSelection: boolean;
  requiresPasswordChange: boolean;
};

describe('Workshop tenancy (e2e)', () => {
  const signupUserId = '93125e08-aea8-4622-9a79-2bf44db6b6d7';
  const signupWorkshopId = 'a079399b-93b1-47d3-bf83-20572dd081c8';
  const signupMembershipId = '22c14d23-5bde-4659-92b5-b75690014997';
  const userId = '2f1b7652-92f6-4a32-863f-26b5af5e0c12';
  const sessionId = '66e37e48-b2df-4de4-b726-56c958403c8e';
  const workshopA = 'e79033dc-7d16-421f-ae1a-d216f9a306d7';
  const workshopB = 'd9c995bb-d747-430b-8698-09f693816ae0';
  const membershipA = '6650e2ef-c46a-4fe2-875e-4af7c576e12d';
  const membershipB = '3bc7263e-90fe-44be-8390-f01c49a3fd9f';
  let app: INestApplication<App>;
  let restoreJwtTestEnv: (() => void) | undefined;
  let activeMembershipId: string | null;
  let mustChangePassword: boolean;
  let currentPassword: string;
  let registeredUser:
    | {
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        isActive: boolean;
        mustChangePassword: boolean;
        memberships: never[];
      }
    | undefined;
  let signupMembership:
    | {
        id: string;
        workshopId: string;
        userId: string;
        role: { name: UserRole };
        workshop: {
          id: string;
          name: string;
          ownerUserId: string;
        };
        isActive: boolean;
      }
    | undefined;

  const memberships = [
    {
      id: membershipA,
      workshopId: workshopA,
      userId,
      role: { name: UserRole.OWNER },
      workshop: {
        id: workshopA,
        name: 'Workshop A',
        ownerUserId: userId,
      },
      isActive: true,
      displayName: 'Ada',
      phone: null,
      address: null,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      user: {
        id: userId,
        name: 'Ada',
        email: 'ada@example.com',
        isActive: true,
        mustChangePassword: false,
      },
    },
    {
      id: membershipB,
      workshopId: workshopB,
      userId,
      role: { name: UserRole.ADMIN },
      workshop: {
        id: workshopB,
        name: 'Workshop B',
        ownerUserId: '88bb7ff1-9154-4de8-ac5a-ed45cb8ff13f',
      },
      isActive: true,
      displayName: 'Ada',
      phone: null,
      address: null,
      createdAt: new Date('2026-07-02T00:00:00.000Z'),
      updatedAt: new Date('2026-07-02T00:00:00.000Z'),
      user: {
        id: userId,
        name: 'Ada',
        email: 'ada@example.com',
        isActive: true,
        mustChangePassword: false,
      },
    },
  ];

  beforeEach(async () => {
    restoreJwtTestEnv = applyJwtTestEnv({
      JWT_SECRET: 'integration-secret',
      JWT_ACCESS_TOKEN_TTL: '15m',
    });
    activeMembershipId = null;
    mustChangePassword = false;
    currentPassword = 'super-secret';
    registeredUser = undefined;
    signupMembership = undefined;

    const prisma = {
      user: {
        findFirst: jest
          .fn()
          .mockImplementation(
            ({
              where,
            }: {
              where: { email: { equals: string; mode: string } };
            }) =>
              registeredUser?.email.toLowerCase() ===
              where.email.equals.toLowerCase()
                ? { id: registeredUser.id }
                : null,
          ),
        findMany: jest.fn().mockImplementation(() => [
          {
            id: userId,
            name: 'Ada',
            email: 'ada@example.com',
            passwordHash: 'hash',
            isActive: true,
            mustChangePassword,
            memberships,
          },
        ]),
        create: jest.fn().mockImplementation(
          ({
            data,
          }: {
            data: {
              name: string;
              email: string;
              passwordHash: string;
              isActive: boolean;
              mustChangePassword: boolean;
            };
          }) => {
            registeredUser = {
              id: signupUserId,
              ...data,
              memberships: [],
            };
            return { id: signupUserId };
          },
        ),
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { id?: string } }) =>
            where.id === signupUserId
              ? registeredUser
              : {
                  id: userId,
                  name: 'Ada',
                  passwordHash: 'hash',
                  isActive: true,
                },
          ),
        update: jest.fn().mockImplementation(
          ({
            data,
          }: {
            data: {
              passwordHash?: string;
              mustChangePassword?: boolean;
            };
          }) => {
            if (data.passwordHash) {
              currentPassword = 'changed-secret';
            }
            if (data.mustChangePassword !== undefined) {
              mustChangePassword = data.mustChangePassword;
            }
            return { id: userId };
          },
        ),
      },
      authSession: {
        create: jest
          .fn()
          .mockImplementation(({ data }: AuthSessionCreateArgs) => ({
            id: sessionId,
            ...data,
          })),
        findFirst: jest
          .fn()
          .mockImplementation(
            ({ where }: { where: { id: string; userId: string } }) => {
              const isSignupUser = where.userId === signupUserId;

              return {
                id: where.id,
                userId: where.userId,
                user: isSignupUser
                  ? registeredUser
                  : {
                      id: userId,
                      email: 'ada@example.com',
                      isActive: true,
                      mustChangePassword,
                    },
                activeMembership:
                  [
                    ...memberships,
                    ...(signupMembership ? [signupMembership] : []),
                  ].find(
                    (membership) => membership.id === activeMembershipId,
                  ) ?? null,
              };
            },
          ),
        updateMany: jest
          .fn()
          .mockImplementation(({ data }: AuthSessionUpdateArgs) => {
            if ('activeMembershipId' in data) {
              activeMembershipId = data.activeMembershipId ?? null;
            }
            return { count: 1 };
          }),
      },
      membership: {
        create: jest.fn().mockImplementation(
          ({
            data,
          }: {
            data: {
              workshopId: string;
              userId: string;
              roleId: string;
              displayName: string;
              isActive: boolean;
            };
          }) => {
            signupMembership = {
              id: signupMembershipId,
              workshopId: data.workshopId,
              userId: data.userId,
              role: { name: UserRole.OWNER },
              workshop: {
                id: data.workshopId,
                name: 'Grace Garage',
                ownerUserId: data.userId,
              },
              isActive: data.isActive,
            };
            return signupMembership;
          },
        ),
        findFirst: jest
          .fn()
          .mockImplementation(({ where }: MembershipQueryArgs) => {
            return (
              memberships.find(
                (membership) =>
                  membership.id === (where.id ?? membership.id) &&
                  membership.workshopId ===
                    (where.workshopId ?? membership.workshopId) &&
                  membership.userId === (where.userId ?? membership.userId) &&
                  membership.isActive,
              ) ?? null
            );
          }),
        findMany: jest
          .fn()
          .mockImplementation(({ where }: MembershipQueryArgs) =>
            memberships.filter(
              (membership) =>
                membership.workshopId === where.workshopId ||
                membership.userId === where.userId,
            ),
          ),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'owner-role-id',
          name: UserRole.OWNER,
        }),
      },
      workshop: {
        create: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: { name: string; ownerUserId: string } }) => ({
              id: signupWorkshopId,
              ...data,
            }),
          ),
      },
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: typeof prisma) => unknown) =>
          callback(prisma),
        ),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PasswordHasherService)
      .useValue({
        verify: jest.fn().mockImplementation((value: string) => {
          return value === currentPassword;
        }),
        hash: jest
          .fn()
          .mockImplementation((value: string) =>
            value === 'signup-secret' ? 'signup-hash' : 'changed-hash',
          ),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    restoreJwtTestEnv?.();
  });

  async function login(
    expectedRequiresPasswordChange = false,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .expect(200);
    const body = response.body as unknown as AuthResponseBody;

    expect(body).toMatchObject({
      activeWorkshop: null,
      requiresWorkshopSelection: true,
      requiresPasswordChange: expectedRequiresPasswordChange,
    });
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('HttpOnly')]),
    );
    return body.accessToken;
  }

  async function selectWorkshop(
    accessToken: string,
    workshopId: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/select-workshop')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ workshopId })
      .expect(200);
    const body = response.body as unknown as AuthResponseBody;

    return body.accessToken;
  }

  it('issues a neutral session when several memberships are active', async () => {
    await login();
  });

  it('creates a global user, starts a neutral session and rejects duplicate email', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: '  Grace Hopper  ',
        email: ' GRACE@EXAMPLE.COM ',
        password: 'signup-secret',
      })
      .expect(201);
    const body = response.body as unknown as AuthResponseBody;

    expect(body).toMatchObject({
      activeWorkshop: null,
      requiresWorkshopSelection: true,
      requiresPasswordChange: false,
    });
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('HttpOnly')]),
    );
    expect(registeredUser).toMatchObject({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      passwordHash: 'signup-hash',
      isActive: true,
      mustChangePassword: false,
      memberships: [],
    });

    const workshopResponse = await request(app.getHttpServer())
      .post('/api/workshops')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ name: 'Grace Garage' })
      .expect(201);

    expect(workshopResponse.body).toMatchObject({
      activeWorkshop: {
        workshopId: signupWorkshopId,
        membershipId: signupMembershipId,
        name: 'Grace Garage',
        role: UserRole.OWNER,
      },
      requiresWorkshopSelection: false,
      requiresPasswordChange: false,
    });
    expect(signupMembership).toMatchObject({
      workshopId: signupWorkshopId,
      userId: signupUserId,
      role: { name: UserRole.OWNER },
      isActive: true,
    });

    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'Someone Else',
        email: 'grace@example.com',
        password: 'signup-secret',
      })
      .expect(409);
  });

  it('selects only a workshop belonging to the authenticated user', async () => {
    const neutralToken = await login();
    const activeToken = await selectWorkshop(neutralToken, workshopA);

    await request(app.getHttpServer())
      .get('/api/memberships')
      .set('Authorization', `Bearer ${activeToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: membershipA,
            workshopId: workshopA,
          }),
        ]);
      });
  });

  it('returns 404 instead of exposing a membership from another workshop', async () => {
    const neutralToken = await login();
    const activeToken = await selectWorkshop(neutralToken, workshopA);

    await request(app.getHttpServer())
      .get(`/api/memberships/${membershipB}`)
      .set('Authorization', `Bearer ${activeToken}`)
      .expect(404);
  });

  it('invalidates the neutral token immediately after selection', async () => {
    const neutralToken = await login();
    await selectWorkshop(neutralToken, workshopA);

    await request(app.getHttpServer())
      .get('/api/workshops')
      .set('Authorization', `Bearer ${neutralToken}`)
      .expect(401);
  });

  it('allows OWNER to access ADMIN membership operations', async () => {
    const neutralToken = await login();
    const activeToken = await selectWorkshop(neutralToken, workshopA);

    await request(app.getHttpServer())
      .get('/api/memberships')
      .set('Authorization', `Bearer ${activeToken}`)
      .expect(200);
  });

  it('blocks a temporary-password session until the password is changed', async () => {
    mustChangePassword = true;
    const temporaryToken = await login(true);

    await request(app.getHttpServer())
      .get('/api/workshops')
      .set('Authorization', `Bearer ${temporaryToken}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
      });

    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${temporaryToken}`)
      .send({
        currentPassword: 'super-secret',
        newPassword: 'changed-secret',
      })
      .expect(204);

    expect(mustChangePassword).toBe(false);
    await request(app.getHttpServer())
      .get('/api/workshops')
      .set('Authorization', `Bearer ${temporaryToken}`)
      .expect(200);
  });
});
