import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getAuthConfig } from '../../../../config/auth.config';
import type { ActiveMembershipContext } from '../../model/active-membership-context.model';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthTokenService {
  private readonly authConfig = getAuthConfig();

  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(
    userId: string,
    sessionId: string,
    membership: ActiveMembershipContext | null,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: userId,
        sid: sessionId,
        ...(membership
          ? { wid: membership.workshopId, mid: membership.id }
          : {}),
      },
      { expiresIn: this.authConfig.accessTokenTtl as never },
    );
  }

  issueRefreshToken(tokenId = randomUUID()): {
    id: string;
    value: string;
  } {
    return { id: tokenId, value: this.serializeRefreshToken(tokenId) };
  }

  serializeRefreshToken(tokenId: string): string {
    return `${tokenId}.${this.signRefreshTokenId(tokenId)}`;
  }

  parseRefreshToken(refreshToken: string): string | null {
    const [tokenId, providedSignature, extra] = refreshToken.split('.');

    if (
      extra !== undefined ||
      !tokenId ||
      !providedSignature ||
      !UUID_PATTERN.test(tokenId)
    ) {
      return null;
    }

    const expected = Buffer.from(this.signRefreshTokenId(tokenId), 'base64url');
    const provided = Buffer.from(providedSignature, 'base64url');

    return expected.length === provided.length &&
      timingSafeEqual(expected, provided)
      ? tokenId
      : null;
  }

  private signRefreshTokenId(tokenId: string): string {
    return createHmac('sha256', this.authConfig.refreshTokenSecret)
      .update(tokenId)
      .digest('base64url');
  }
}
