import { applyJwtTestEnv } from './jwt-test-env';

describe('applyJwtTestEnv', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalTtl = process.env.JWT_ACCESS_TOKEN_TTL;
  const originalRefreshSecret = process.env.AUTH_REFRESH_TOKEN_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }

    if (originalTtl === undefined) {
      delete process.env.JWT_ACCESS_TOKEN_TTL;
    } else {
      process.env.JWT_ACCESS_TOKEN_TTL = originalTtl;
    }

    if (originalRefreshSecret === undefined) {
      delete process.env.AUTH_REFRESH_TOKEN_SECRET;
    } else {
      process.env.AUTH_REFRESH_TOKEN_SECRET = originalRefreshSecret;
    }
  });

  it('sets default JWT test values and restores the previous environment', () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ACCESS_TOKEN_TTL;
    delete process.env.AUTH_REFRESH_TOKEN_SECRET;

    const restore = applyJwtTestEnv();

    expect(process.env.JWT_SECRET).toBe('test-jwt-secret');
    expect(process.env.JWT_ACCESS_TOKEN_TTL).toBe('15m');
    expect(process.env.AUTH_REFRESH_TOKEN_SECRET).toBe(
      'test-refresh-token-secret',
    );

    restore();

    expect(process.env.JWT_SECRET).toBeUndefined();
    expect(process.env.JWT_ACCESS_TOKEN_TTL).toBeUndefined();
    expect(process.env.AUTH_REFRESH_TOKEN_SECRET).toBeUndefined();
  });

  it('allows per-suite overrides without leaking them after restore', () => {
    process.env.JWT_SECRET = 'existing-secret';
    process.env.JWT_ACCESS_TOKEN_TTL = '30m';
    process.env.AUTH_REFRESH_TOKEN_SECRET = 'existing-refresh-secret';

    const restore = applyJwtTestEnv({
      JWT_SECRET: 'override-secret',
      JWT_ACCESS_TOKEN_TTL: '45m',
      AUTH_REFRESH_TOKEN_SECRET: 'override-refresh-secret',
    });

    expect(process.env.JWT_SECRET).toBe('override-secret');
    expect(process.env.JWT_ACCESS_TOKEN_TTL).toBe('45m');
    expect(process.env.AUTH_REFRESH_TOKEN_SECRET).toBe(
      'override-refresh-secret',
    );

    restore();

    expect(process.env.JWT_SECRET).toBe('existing-secret');
    expect(process.env.JWT_ACCESS_TOKEN_TTL).toBe('30m');
    expect(process.env.AUTH_REFRESH_TOKEN_SECRET).toBe(
      'existing-refresh-secret',
    );
  });
});
