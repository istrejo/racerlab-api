type JwtDurationUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y';
type JwtDurationString = `${number}${JwtDurationUnit}`;
type SameSite = 'strict' | 'lax' | 'none';

export type RefreshCookieConfig = {
  name: string;
  httpOnly: true;
  path: string;
  secure: boolean;
  sameSite: SameSite;
  domain?: string;
};

export type AuthConfig = {
  jwtSecret: string;
  accessTokenTtl: number | JwtDurationString;
  refreshTokenTtl: number | JwtDurationString;
  refreshCookie: RefreshCookieConfig;
};

type AuthEnv = {
  JWT_SECRET?: string;
  JWT_ACCESS_TOKEN_TTL?: string;
  JWT_REFRESH_TOKEN_TTL?: string;
  AUTH_REFRESH_COOKIE_NAME?: string;
  AUTH_REFRESH_COOKIE_SECURE?: string;
  AUTH_REFRESH_COOKIE_SAME_SITE?: string;
  AUTH_REFRESH_COOKIE_DOMAIN?: string;
  NODE_ENV?: string;
};

const JWT_INTEGER_SECONDS_PATTERN = /^\d+$/;
const JWT_DURATION_PATTERN = /^\d+(ms|s|m|h|d|w|y)$/;
const SAME_SITE_VALUES = new Set<SameSite>(['strict', 'lax', 'none']);
const DEFAULT_REFRESH_TOKEN_TTL: JwtDurationString = '30d';
const DEFAULT_REFRESH_COOKIE_NAME = 'rl_refresh';
const DEFAULT_REFRESH_COOKIE_PATH = '/auth';
const DEFAULT_REFRESH_COOKIE_SAME_SITE: SameSite = 'lax';

function getJwtTtlErrorMessage(
  name: 'JWT_ACCESS_TOKEN_TTL' | 'JWT_REFRESH_TOKEN_TTL',
) {
  return `${name} must be an integer number of seconds or a duration string using ms, s, m, h, d, w, or y.`;
}

function parseJwtTtl(
  value: string,
  envName: 'JWT_ACCESS_TOKEN_TTL' | 'JWT_REFRESH_TOKEN_TTL',
): number | JwtDurationString {
  if (JWT_INTEGER_SECONDS_PATTERN.test(value)) {
    return Number(value);
  }

  if (JWT_DURATION_PATTERN.test(value)) {
    return value as JwtDurationString;
  }

  throw new Error(getJwtTtlErrorMessage(envName));
}

function parseBooleanFlag(
  value: string,
  envName: 'AUTH_REFRESH_COOKIE_SECURE',
): boolean {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${envName} must be either true or false.`);
}

function parseSameSite(value: string): SameSite {
  if (SAME_SITE_VALUES.has(value as SameSite)) {
    return value as SameSite;
  }

  throw new Error(
    'AUTH_REFRESH_COOKIE_SAME_SITE must be one of strict, lax, or none.',
  );
}

export function getAuthConfig(env: AuthEnv = process.env): AuthConfig {
  const jwtSecret = env.JWT_SECRET?.trim();
  const accessTokenTtl = env.JWT_ACCESS_TOKEN_TTL?.trim();
  const refreshTokenTtl = env.JWT_REFRESH_TOKEN_TTL?.trim();
  const refreshCookieName = env.AUTH_REFRESH_COOKIE_NAME?.trim();
  const refreshCookieSecure = env.AUTH_REFRESH_COOKIE_SECURE?.trim();
  const refreshCookieSameSite = env.AUTH_REFRESH_COOKIE_SAME_SITE?.trim();
  const refreshCookieDomain = env.AUTH_REFRESH_COOKIE_DOMAIN?.trim();

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required.');
  }

  if (!accessTokenTtl) {
    throw new Error('JWT_ACCESS_TOKEN_TTL is required.');
  }

  return {
    jwtSecret,
    accessTokenTtl: parseJwtTtl(accessTokenTtl, 'JWT_ACCESS_TOKEN_TTL'),
    refreshTokenTtl: parseJwtTtl(
      refreshTokenTtl || DEFAULT_REFRESH_TOKEN_TTL,
      'JWT_REFRESH_TOKEN_TTL',
    ),
    refreshCookie: {
      name: refreshCookieName || DEFAULT_REFRESH_COOKIE_NAME,
      httpOnly: true,
      path: DEFAULT_REFRESH_COOKIE_PATH,
      secure: refreshCookieSecure
        ? parseBooleanFlag(refreshCookieSecure, 'AUTH_REFRESH_COOKIE_SECURE')
        : env.NODE_ENV === 'production',
      sameSite: refreshCookieSameSite
        ? parseSameSite(refreshCookieSameSite)
        : DEFAULT_REFRESH_COOKIE_SAME_SITE,
      ...(refreshCookieDomain ? { domain: refreshCookieDomain } : {}),
    },
  };
}
