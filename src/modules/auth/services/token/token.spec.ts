import { AuthTokenService } from './token';

describe('AuthTokenService', () => {
  const jwtService = { signAsync: jest.fn().mockResolvedValue('access-token') };
  let service: AuthTokenService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_ACCESS_TOKEN_TTL = '15m';
    process.env.AUTH_REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthTokenService(jwtService as never);
  });

  it('signs access tokens with the stable session id', async () => {
    await expect(
      service.signAccessToken('user-id', 'session-id', null),
    ).resolves.toBe('access-token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'user-id', sid: 'session-id' },
      { expiresIn: '15m' },
    );
  });

  it('creates a signed refresh token that can be verified and reconstructed', () => {
    const tokenId = '66e37e48-b2df-4de4-b726-56c958403c8e';
    const issued = service.issueRefreshToken(tokenId);

    expect(issued.value).toBe(service.serializeRefreshToken(tokenId));
    expect(service.parseRefreshToken(issued.value)).toBe(tokenId);
  });

  it('rejects a refresh token with a modified signature', () => {
    const tokenId = '66e37e48-b2df-4de4-b726-56c958403c8e';
    const token = service.serializeRefreshToken(tokenId);

    expect(service.parseRefreshToken(`${token}x`)).toBeNull();
  });
});
