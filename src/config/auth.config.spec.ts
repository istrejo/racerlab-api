import { getAuthConfig } from './auth.config';

describe('getAuthConfig', () => {
  it('returns the JWT secret and access-token TTL from the environment', () => {
    expect(
      getAuthConfig({
        JWT_SECRET: 'super-secret',
        JWT_ACCESS_TOKEN_TTL: '15m',
      }),
    ).toEqual({
      jwtSecret: 'super-secret',
      accessTokenTtl: '15m',
    });
  });

  it('converts a digit-only JWT_ACCESS_TOKEN_TTL value to numeric seconds', () => {
    expect(
      getAuthConfig({
        JWT_SECRET: 'super-secret',
        JWT_ACCESS_TOKEN_TTL: '900',
      }),
    ).toEqual({
      jwtSecret: 'super-secret',
      accessTokenTtl: 900,
    });
  });

  it.each([
    {
      caseName: 'JWT_SECRET is missing',
      env: { JWT_ACCESS_TOKEN_TTL: '15m' },
      message: 'JWT_SECRET is required.',
    },
    {
      caseName: 'JWT_ACCESS_TOKEN_TTL is missing',
      env: { JWT_SECRET: 'super-secret' },
      message: 'JWT_ACCESS_TOKEN_TTL is required.',
    },
  ])('fails fast when %s', ({ env, message }) => {
    expect(() => getAuthConfig(env)).toThrow(message);
  });

  it.each(['soon', '15 minutes', '1q'])(
    'fails fast when JWT_ACCESS_TOKEN_TTL is malformed: %s',
    (ttl) => {
      expect(() =>
        getAuthConfig({
          JWT_SECRET: 'super-secret',
          JWT_ACCESS_TOKEN_TTL: ttl,
        }),
      ).toThrow(
        'JWT_ACCESS_TOKEN_TTL must be an integer number of seconds or a duration string using ms, s, m, h, d, w, or y.',
      );
    },
  );
});
