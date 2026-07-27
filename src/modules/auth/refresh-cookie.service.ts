import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { getAuthConfig } from '../../config/auth.config';

@Injectable()
export class RefreshCookieService {
  private readonly authConfig = getAuthConfig();

  set(response: Response, refreshToken: string, expiresAt: Date): void {
    response.cookie(this.authConfig.refreshCookie.name, refreshToken, {
      httpOnly: this.authConfig.refreshCookie.httpOnly,
      path: this.authConfig.refreshCookie.path,
      secure: this.authConfig.refreshCookie.secure,
      sameSite: this.authConfig.refreshCookie.sameSite,
      domain: this.authConfig.refreshCookie.domain,
      expires: expiresAt,
      maxAge: Math.max(expiresAt.getTime() - Date.now(), 0),
    });
  }

  clear(response: Response): void {
    response.cookie(this.authConfig.refreshCookie.name, '', {
      httpOnly: this.authConfig.refreshCookie.httpOnly,
      path: this.authConfig.refreshCookie.path,
      secure: this.authConfig.refreshCookie.secure,
      sameSite: this.authConfig.refreshCookie.sameSite,
      domain: this.authConfig.refreshCookie.domain,
      expires: new Date(0),
      maxAge: 0,
    });
  }
}
