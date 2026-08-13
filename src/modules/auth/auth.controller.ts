import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { Request, Response } from 'express';
import { AllowPasswordChangeRequired } from '../../common/decorators/allow-password-change-required.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { getAuthConfig } from '../../config/auth.config';
import { AuthService } from './auth.service';
import { RefreshCookieService } from './refresh-cookie.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { SelectWorkshopDto } from './dto/select-workshop.dto';
import { SignupDto } from './dto/signup.dto';

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

  constructor(
    private readonly authService: AuthService,
    private readonly refreshCookieService: RefreshCookieService,
  ) {}

  @Post('signup')
  @ApiOperation({
    summary: 'Create a global user identity and start a neutral session',
    description:
      'Registers a user without workshop memberships, returns an access token, and issues an HttpOnly refresh cookie. The authenticated user can then create their first workshop.',
  })
  @ApiCreatedResponse({
    type: LoginResponseDto,
    headers: REFRESH_COOKIE_HEADER,
  })
  @ApiBadRequestResponse({ description: 'Invalid signup payload.' })
  @ApiConflictResponse({ description: 'Email is already registered.' })
  @ApiServiceUnavailableResponse({
    description: 'Authentication service temporarily unavailable.',
  })
  async signup(
    @Body() dto: SignupDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.authService.signup(
      dto,
      this.getRequestContext(request),
    );

    this.refreshCookieService.set(
      response,
      session.refreshToken,
      session.refreshTokenExpiresAt,
    );

    return {
      accessToken: session.accessToken,
      tokenType: session.tokenType,
      user: session.user,
      activeWorkshop: session.activeWorkshop,
      requiresWorkshopSelection: session.requiresWorkshopSelection,
      requiresPasswordChange: session.requiresPasswordChange,
    };
  }

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
    const session = await this.authService.login(
      dto,
      this.getRequestContext(request),
    );

    this.refreshCookieService.set(
      response,
      session.refreshToken,
      session.refreshTokenExpiresAt,
    );

    return {
      accessToken: session.accessToken,
      tokenType: session.tokenType,
      user: session.user,
      activeWorkshop: session.activeWorkshop,
      requiresWorkshopSelection: session.requiresWorkshopSelection,
      requiresPasswordChange: session.requiresPasswordChange,
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
    const refreshToken = request.cookies?.[
      this.authConfig.refreshCookie.name
    ] as string | undefined;
    const session = await this.authService.refresh(
      refreshToken,
      this.getRequestContext(request),
    );

    this.refreshCookieService.set(
      response,
      session.refreshToken,
      session.refreshTokenExpiresAt,
    );

    return {
      accessToken: session.accessToken,
      tokenType: session.tokenType,
      user: session.user,
      activeWorkshop: session.activeWorkshop,
      requiresWorkshopSelection: session.requiresWorkshopSelection,
      requiresPasswordChange: session.requiresPasswordChange,
    };
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get the revalidated current-session bootstrap state',
  })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiServiceUnavailableResponse({
    description: 'Authentication service temporarily unavailable.',
  })
  @UseGuards(JwtAuthGuard)
  @AllowPasswordChangeRequired()
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeResponseDto> {
    return this.authService.getMe(user);
  }

  @Post('select-workshop')
  @HttpCode(200)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Select an active workshop for the current session',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({
    description: 'The workshop membership is not available.',
  })
  @UseGuards(JwtAuthGuard)
  selectWorkshop(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SelectWorkshopDto,
  ): Promise<LoginResponseDto> {
    return this.authService.selectWorkshop(user, dto.workshopId);
  }

  @Post('change-password')
  @HttpCode(204)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Replace the current or administrator-issued password',
  })
  @ApiNoContentResponse({
    description:
      'The password was changed and every other active session was revoked.',
  })
  @ApiUnauthorizedResponse({
    description: 'The current password is invalid.',
  })
  @ApiBadRequestResponse({
    description: 'The new password is invalid or was already in use.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Authentication service temporarily unavailable.',
  })
  @UseGuards(JwtAuthGuard)
  @AllowPasswordChangeRequired()
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
    );
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
    const refreshToken = request.cookies?.[
      this.authConfig.refreshCookie.name
    ] as string | undefined;

    await this.authService.logout(
      refreshToken,
      this.getRequestContext(request),
    );
    this.refreshCookieService.clear(response);
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
  @AllowPasswordChangeRequired()
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.id);
    this.refreshCookieService.clear(response);
  }

  private getRequestContext(request: Request) {
    return {
      userAgent: request.get('user-agent') ?? undefined,
      ipAddress: request.ip,
    };
  }
}
