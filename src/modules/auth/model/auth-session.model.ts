import type { Prisma } from '@prisma/client';
import type { LoginResponseDto } from '../dto/login-response.dto';
import type { AuthRequestContext } from './auth-request-context.model';

export type AuthSessionResponse = LoginResponseDto & {
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type IssueAuthSessionInput = {
  prisma?: Prisma.TransactionClient;
  sessionId?: string;
  userId: string;
  activeMembershipId?: string;
  context?: AuthRequestContext;
  now?: Date;
};
