import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { getAuthConfig } from '../../config/auth.config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';

const REFRESH_COOKIE_HEADER = {
  'Set-Cookie': {
    description:
      'HttpOnly refresh cookie transport for the opaque session token. Logout responses clear the cookie by expiring it immediately.',
    schema: {
      type: 'string',
    },
  },
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly authConfig = getAuthConfig();

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Log in and receive a JWT access token with a refresh cookie',
    description:
      'Authenticates an active internal user, returns an access token body, and issues an HttpOnly refresh cookie.',
  })
  @ApiOkResponse({
    type: LoginResponseDto,
    headers: REFRESH_COOKIE_HEADER,
  })
  @ApiBadRequestResponse({ description: 'Invalid login payload.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  @ApiServiceUnavailableResponse({
    description: 'Authentication service temporarily unavailable.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.authService.login(dto, this.getRequestContext(request));

    this.setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresAt);

    return {
      accessToken: session.accessToken,
      tokenType: session.tokenType,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rotate the refresh cookie and receive a fresh JWT access token',
    description:
      'Accepts the current HttpOnly refresh cookie, rotates it, and returns a fresh access token body without exposing the refresh token in the payload.',
  })
  @ApiOkResponse({
    type: RefreshResponseDto,
    headers: REFRESH_COOKIE_HEADER,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh session.' })
  @ApiServiceUnavailableResponse({
    description: 'Authentication service temporarily unavailable.',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    const refreshToken = request.cookies?.[this.authConfig.refreshCookie.name] as
      | string
      | undefined;
    const session = await this.authService.refresh(
      refreshToken,
      this.getRequestContext(request),
    );

    this.setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresAt);

    return {
      accessToken: session.accessToken,
      tokenType: session.tokenType,
    };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Revoke only the current refresh session',
    description:
      'Revokes the current refresh session when present, always clears the refresh cookie, and does not reveal whether the session was still active.',
  })
  @ApiNoContentResponse({
    description:
      'The current refresh session is no longer usable and the response clears the refresh cookie.',
    headers: REFRESH_COOKIE_HEADER,
  })
  @ApiServiceUnavailableResponse({
    description: 'Authentication service temporarily unavailable.',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = request.cookies?.[this.authConfig.refreshCookie.name] as
      | string
      | undefined;

    await this.authService.logout(refreshToken, this.getRequestContext(request));
    this.clearRefreshCookie(response);
  }

  @Post('logout-all')
  @HttpCode(204)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Revoke every active refresh session for the authenticated user',
    description:
      'Revokes every active refresh session for the authenticated user and clears the refresh cookie on the current client.',
  })
  @ApiNoContentResponse({
    description:
      'Every active refresh session for the authenticated user is no longer usable and the current refresh cookie is cleared.',
    headers: REFRESH_COOKIE_HEADER,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiServiceUnavailableResponse({
    description: 'Authentication service temporarily unavailable.',
  })
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.id);
    this.clearRefreshCookie(response);
  }

  private getRequestContext(request: Request) {
    return {
      userAgent: request.get('user-agent') ?? undefined,
      ipAddress: request.ip,
    };
  }

  private setRefreshCookie(
    response: Response,
    refreshToken: string,
    expiresAt: Date,
  ) {
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

  private clearRefreshCookie(response: Response) {
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
