import { getAuthConfig } from './auth.config';

describe('getAuthConfig', () => {
  it('returns the JWT secret, token TTLs, and refresh cookie settings from the environment', () => {
    expect(
      getAuthConfig({
        JWT_SECRET: 'super-secret',
        JWT_ACCESS_TOKEN_TTL: '15m',
        JWT_REFRESH_TOKEN_TTL: '30d',
        AUTH_REFRESH_COOKIE_NAME: 'rl_refresh',
        AUTH_REFRESH_COOKIE_SECURE: 'true',
        AUTH_REFRESH_COOKIE_SAME_SITE: 'strict',
        AUTH_REFRESH_COOKIE_DOMAIN: 'api.racerlab.test',
      }),
    ).toEqual({
      jwtSecret: 'super-secret',
      accessTokenTtl: '15m',
      refreshTokenTtl: '30d',
      refreshCookie: {
        name: 'rl_refresh',
        httpOnly: true,
        path: '/api/auth',
        secure: true,
        sameSite: 'strict',
        domain: 'api.racerlab.test',
      },
    });
  });

  it('converts digit-only access and refresh TTL values to numeric seconds', () => {
    expect(
      getAuthConfig({
        JWT_SECRET: 'super-secret',
        JWT_ACCESS_TOKEN_TTL: '900',
        JWT_REFRESH_TOKEN_TTL: '2592000',
        AUTH_REFRESH_COOKIE_NAME: 'rl_refresh',
        AUTH_REFRESH_COOKIE_SECURE: 'false',
        AUTH_REFRESH_COOKIE_SAME_SITE: 'lax',
      }),
    ).toEqual({
      jwtSecret: 'super-secret',
      accessTokenTtl: 900,
      refreshTokenTtl: 2592000,
      refreshCookie: {
        name: 'rl_refresh',
        httpOnly: true,
        path: '/api/auth',
        secure: false,
        sameSite: 'lax',
      },
    });
  });

  it('treats a blank refresh cookie domain as undefined', () => {
    expect(
      getAuthConfig({
        JWT_SECRET: 'super-secret',
        JWT_ACCESS_TOKEN_TTL: '15m',
        JWT_REFRESH_TOKEN_TTL: '30d',
        AUTH_REFRESH_COOKIE_NAME: 'rl_refresh',
        AUTH_REFRESH_COOKIE_SECURE: 'false',
        AUTH_REFRESH_COOKIE_SAME_SITE: 'none',
        AUTH_REFRESH_COOKIE_DOMAIN: '   ',
      }),
    ).toEqual({
      jwtSecret: 'super-secret',
      accessTokenTtl: '15m',
      refreshTokenTtl: '30d',
      refreshCookie: {
        name: 'rl_refresh',
        httpOnly: true,
        path: '/api/auth',
        secure: false,
        sameSite: 'none',
      },
    });
  });

  it('uses safe refresh defaults when refresh environment variables are absent', () => {
    expect(
      getAuthConfig({
        JWT_SECRET: 'super-secret',
        JWT_ACCESS_TOKEN_TTL: '15m',
      }),
    ).toEqual({
      jwtSecret: 'super-secret',
      accessTokenTtl: '15m',
      refreshTokenTtl: '30d',
      refreshCookie: {
        name: 'rl_refresh',
        httpOnly: true,
        path: '/api/auth',
        secure: false,
        sameSite: 'lax',
      },
    });
  });

  it('defaults the refresh cookie to secure in production', () => {
    expect(
      getAuthConfig({
        JWT_SECRET: 'super-secret',
        JWT_ACCESS_TOKEN_TTL: '15m',
        NODE_ENV: 'production',
      }).refreshCookie.secure,
    ).toBe(true);
  });

  it.each([
    {
      caseName: 'JWT_SECRET is missing',
      env: {
        JWT_ACCESS_TOKEN_TTL: '15m',
        JWT_REFRESH_TOKEN_TTL: '30d',
        AUTH_REFRESH_COOKIE_NAME: 'rl_refresh',
        AUTH_REFRESH_COOKIE_SECURE: 'true',
        AUTH_REFRESH_COOKIE_SAME_SITE: 'strict',
      },
      message: 'JWT_SECRET is required.',
    },
    {
      caseName: 'JWT_ACCESS_TOKEN_TTL is missing',
      env: {
        JWT_SECRET: 'super-secret',
        JWT_REFRESH_TOKEN_TTL: '30d',
        AUTH_REFRESH_COOKIE_NAME: 'rl_refresh',
        AUTH_REFRESH_COOKIE_SECURE: 'true',
        AUTH_REFRESH_COOKIE_SAME_SITE: 'strict',
      },
      message: 'JWT_ACCESS_TOKEN_TTL is required.',
    },
  ])('fails fast when %s', ({ env, message }) => {
    expect(() => getAuthConfig(env)).toThrow(message);
  });

  it.each([
    {
      field: 'JWT_ACCESS_TOKEN_TTL',
      ttl: 'soon',
      message:
        'JWT_ACCESS_TOKEN_TTL must be an integer number of seconds or a duration string using ms, s, m, h, d, w, or y.',
    },
    {
      field: 'JWT_REFRESH_TOKEN_TTL',
      ttl: '30 days',
      message:
        'JWT_REFRESH_TOKEN_TTL must be an integer number of seconds or a duration string using ms, s, m, h, d, w, or y.',
    },
  ])('fails fast when $field is malformed: $ttl', ({ field, ttl, message }) => {
    const env = {
      JWT_SECRET: 'super-secret',
      JWT_ACCESS_TOKEN_TTL: '15m',
      JWT_REFRESH_TOKEN_TTL: '30d',
      AUTH_REFRESH_COOKIE_NAME: 'rl_refresh',
      AUTH_REFRESH_COOKIE_SECURE: 'true',
      AUTH_REFRESH_COOKIE_SAME_SITE: 'strict',
    };

    env[field] = ttl;

    expect(() =>
      getAuthConfig(env as Parameters<typeof getAuthConfig>[0]),
    ).toThrow(message);
  });

  it.each(['truthy', 'yes'])(
    'fails fast when AUTH_REFRESH_COOKIE_SECURE is malformed: %s',
    (value) => {
      expect(() =>
        getAuthConfig({
          JWT_SECRET: 'super-secret',
          JWT_ACCESS_TOKEN_TTL: '15m',
          JWT_REFRESH_TOKEN_TTL: '30d',
          AUTH_REFRESH_COOKIE_NAME: 'rl_refresh',
          AUTH_REFRESH_COOKIE_SECURE: value,
          AUTH_REFRESH_COOKIE_SAME_SITE: 'strict',
        }),
      ).toThrow('AUTH_REFRESH_COOKIE_SECURE must be either true or false.');
    },
  );

  it.each(['Strict', 'invalid'])(
    'fails fast when AUTH_REFRESH_COOKIE_SAME_SITE is malformed: %s',
    (value) => {
      expect(() =>
        getAuthConfig({
          JWT_SECRET: 'super-secret',
          JWT_ACCESS_TOKEN_TTL: '15m',
          JWT_REFRESH_TOKEN_TTL: '30d',
          AUTH_REFRESH_COOKIE_NAME: 'rl_refresh',
          AUTH_REFRESH_COOKIE_SECURE: 'true',
          AUTH_REFRESH_COOKIE_SAME_SITE: value,
        }),
      ).toThrow(
        'AUTH_REFRESH_COOKIE_SAME_SITE must be one of strict, lax, or none.',
      );
    },
  );
});
