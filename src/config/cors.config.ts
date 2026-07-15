type CorsEnv = {
  CORS_ORIGIN?: string;
};

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:4200'];
const API_CORS_METHODS = ['GET', 'HEAD', 'POST', 'PATCH'];
const AUTH_CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization'];

function parseAllowedOrigins(value: string): string[] {
  const origins = value.split(',').map((origin) => origin.trim());

  if (!origins.length || origins.some((origin) => !origin)) {
    throw new Error(
      'CORS_ORIGIN must contain one or more comma-separated origins.',
    );
  }

  return origins.map((origin) => {
    if (origin === '*') {
      throw new Error(
        'CORS_ORIGIN must not contain * when credentials are enabled.',
      );
    }

    const normalizedOrigin = origin.endsWith('/')
      ? origin.slice(0, -1)
      : origin;

    try {
      const parsedOrigin = new URL(normalizedOrigin);

      if (
        !['http:', 'https:'].includes(parsedOrigin.protocol) ||
        parsedOrigin.origin !== normalizedOrigin
      ) {
        throw new Error();
      }
    } catch {
      throw new Error(
        `CORS_ORIGIN contains an invalid origin: ${origin}. Origins must use http or https without a path.`,
      );
    }

    return normalizedOrigin;
  });
}

export function getCorsConfig(env: CorsEnv = process.env) {
  const configuredOrigins = env.CORS_ORIGIN?.trim();

  return {
    origin: configuredOrigins
      ? parseAllowedOrigins(configuredOrigins)
      : DEFAULT_ALLOWED_ORIGINS,
    credentials: true,
    methods: API_CORS_METHODS,
    allowedHeaders: AUTH_CORS_ALLOWED_HEADERS,
  };
}
