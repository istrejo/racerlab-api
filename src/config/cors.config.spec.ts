import { getCorsConfig } from './cors.config';

describe('getCorsConfig', () => {
  it('allows credentialed Angular development requests by default', () => {
    expect(getCorsConfig()).toEqual({
      origin: ['http://localhost:4200'],
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  });

  it('accepts a comma-separated deployed origin allowlist', () => {
    expect(
      getCorsConfig({
        CORS_ORIGIN:
          'https://app.racerlab.example, https://admin.racerlab.example/',
      }),
    ).toMatchObject({
      origin: [
        'https://app.racerlab.example',
        'https://admin.racerlab.example',
      ],
      credentials: true,
    });
  });

  it.each([
    [
      'wildcard origin',
      '*',
      'CORS_ORIGIN must not contain * when credentials are enabled.',
    ],
    [
      'blank allowlist entry',
      'http://localhost:4200,',
      'CORS_ORIGIN must contain one or more comma-separated origins.',
    ],
    [
      'origin path',
      'https://app.racerlab.example/login',
      'CORS_ORIGIN contains an invalid origin: https://app.racerlab.example/login. Origins must use http or https without a path.',
    ],
  ])('fails closed for %s', (_caseName, CORS_ORIGIN, message) => {
    expect(() => getCorsConfig({ CORS_ORIGIN })).toThrow(message);
  });
});
