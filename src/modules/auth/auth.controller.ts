import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { getAuthConfig } from '../../config/auth.config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';

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
  @ApiOkResponse({ type: LoginResponseDto })
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
  @ApiOkResponse({ type: RefreshResponseDto })
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
}
