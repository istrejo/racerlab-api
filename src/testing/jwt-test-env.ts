type JwtTestEnv = {
  JWT_SECRET?: string;
  AUTH_REFRESH_TOKEN_SECRET?: string;
  JWT_ACCESS_TOKEN_TTL?: string;
};

const DEFAULT_JWT_TEST_ENV = {
  JWT_SECRET: 'test-jwt-secret',
  AUTH_REFRESH_TOKEN_SECRET: 'test-refresh-token-secret',
  JWT_ACCESS_TOKEN_TTL: '15m',
} as const;

export function applyJwtTestEnv(overrides: JwtTestEnv = {}): () => void {
  const previousEnv: JwtTestEnv = {
    JWT_SECRET: process.env.JWT_SECRET,
    AUTH_REFRESH_TOKEN_SECRET: process.env.AUTH_REFRESH_TOKEN_SECRET,
    JWT_ACCESS_TOKEN_TTL: process.env.JWT_ACCESS_TOKEN_TTL,
  };

  process.env.JWT_SECRET =
    overrides.JWT_SECRET ?? DEFAULT_JWT_TEST_ENV.JWT_SECRET;
  process.env.AUTH_REFRESH_TOKEN_SECRET =
    overrides.AUTH_REFRESH_TOKEN_SECRET ??
    DEFAULT_JWT_TEST_ENV.AUTH_REFRESH_TOKEN_SECRET;
  process.env.JWT_ACCESS_TOKEN_TTL =
    overrides.JWT_ACCESS_TOKEN_TTL ?? DEFAULT_JWT_TEST_ENV.JWT_ACCESS_TOKEN_TTL;

  return () => {
    if (previousEnv.JWT_SECRET === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousEnv.JWT_SECRET;
    }

    if (previousEnv.JWT_ACCESS_TOKEN_TTL === undefined) {
      delete process.env.JWT_ACCESS_TOKEN_TTL;
    } else {
      process.env.JWT_ACCESS_TOKEN_TTL = previousEnv.JWT_ACCESS_TOKEN_TTL;
    }

    if (previousEnv.AUTH_REFRESH_TOKEN_SECRET === undefined) {
      delete process.env.AUTH_REFRESH_TOKEN_SECRET;
    } else {
      process.env.AUTH_REFRESH_TOKEN_SECRET =
        previousEnv.AUTH_REFRESH_TOKEN_SECRET;
    }
  };
}
