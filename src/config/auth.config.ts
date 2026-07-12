type JwtDurationUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y';
type JwtDurationString = `${number}${JwtDurationUnit}`;

export type AuthConfig = {
  jwtSecret: string;
  accessTokenTtl: number | JwtDurationString;
};

type AuthEnv = {
  JWT_SECRET?: string;
  JWT_ACCESS_TOKEN_TTL?: string;
};

const JWT_INTEGER_SECONDS_PATTERN = /^\d+$/;
const JWT_DURATION_PATTERN = /^\d+(ms|s|m|h|d|w|y)$/;
const JWT_TTL_ERROR_MESSAGE =
  'JWT_ACCESS_TOKEN_TTL must be an integer number of seconds or a duration string using ms, s, m, h, d, w, or y.';

function parseJwtTtl(value: string): number | JwtDurationString {
  if (JWT_INTEGER_SECONDS_PATTERN.test(value)) {
    return Number(value);
  }

  if (JWT_DURATION_PATTERN.test(value)) {
    return value as JwtDurationString;
  }

  throw new Error(JWT_TTL_ERROR_MESSAGE);
}

export function getAuthConfig(env: AuthEnv = process.env): AuthConfig {
  const jwtSecret = env.JWT_SECRET?.trim();
  const accessTokenTtl = env.JWT_ACCESS_TOKEN_TTL?.trim();

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required.');
  }

  if (!accessTokenTtl) {
    throw new Error('JWT_ACCESS_TOKEN_TTL is required.');
  }

  return {
    jwtSecret,
    accessTokenTtl: parseJwtTtl(accessTokenTtl),
  };
}
