import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentBuilder } from '../../config/swagger.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshCookieService } from './refresh-cookie.service';

type OpenApiSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

type OpenApiResponseWithHeaders = {
  headers?: Record<string, unknown>;
};

describe('Auth OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signup: jest.fn(),
            login: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
            logoutAll: jest.fn(),
            selectWorkshop: jest.fn(),
            changePassword: jest.fn(),
          },
        },
        {
          provide: RefreshCookieService,
          useValue: {
            set: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    document = SwaggerModule.createDocument(
      app,
      createSwaggerDocumentBuilder().build(),
    );
  });

  it('documents POST /auth/signup as public neutral-session issuance', () => {
    const operation = document.paths['/auth/signup']?.post;
    const signupRequestSchema = document.components?.schemas?.SignupDto as
      OpenApiSchema | undefined;

    expect(operation).toBeDefined();
    expect(operation?.summary).toContain('global user identity');
    expect(operation?.security).toBeUndefined();
    expect(Object.keys(operation?.responses ?? {})).toEqual([
      '201',
      '400',
      '409',
      '503',
    ]);
    expect(Object.keys(signupRequestSchema?.properties ?? {})).toEqual([
      'name',
      'email',
      'password',
    ]);
    expect(signupRequestSchema?.required).toEqual([
      'name',
      'email',
      'password',
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents POST /auth/login as a public token issuance endpoint', () => {
    const operation = document.paths['/auth/login']?.post;

    expect(operation).toBeDefined();
    expect(document.components?.securitySchemes?.bearer).toBeDefined();
    expect(operation?.summary).toContain('Log in');
    expect(operation?.security).toBeUndefined();
    expect(Object.keys(operation?.responses ?? {})).toEqual([
      '200',
      '400',
      '401',
      '503',
    ]);
  });

  it('documents refresh-cookie response headers for signup, login, refresh, and logout', () => {
    const signupOperation = document.paths['/auth/signup']?.post;
    const loginOperation = document.paths['/auth/login']?.post;
    const refreshOperation = document.paths['/auth/refresh']?.post;
    const logoutOperation = document.paths['/auth/logout']?.post;
    const signupResponse = signupOperation?.responses?.[
      '201'
    ] as OpenApiResponseWithHeaders;
    const loginResponse = loginOperation?.responses?.[
      '200'
    ] as OpenApiResponseWithHeaders;
    const refreshResponse = refreshOperation?.responses?.[
      '200'
    ] as OpenApiResponseWithHeaders;
    const logoutResponse = logoutOperation?.responses?.[
      '204'
    ] as OpenApiResponseWithHeaders;

    expect(signupResponse.headers?.['Set-Cookie']).toBeDefined();
    expect(loginResponse.headers?.['Set-Cookie']).toBeDefined();
    expect(refreshResponse.headers?.['Set-Cookie']).toBeDefined();
    expect(logoutResponse.headers?.['Set-Cookie']).toBeDefined();
    expect(refreshOperation?.description).toContain('HttpOnly refresh cookie');
    expect(logoutOperation?.description).toContain('clears the refresh cookie');
  });

  it('documents POST /auth/logout-all as a bearer-protected revocation endpoint', () => {
    const operation = document.paths['/auth/logout-all']?.post;

    expect(operation).toBeDefined();
    expect(operation?.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(operation?.responses ?? {})).toEqual([
      '204',
      '401',
      '503',
    ]);
    expect(operation?.description).toContain(
      'Revokes every active refresh session',
    );
  });

  it('documents the login request and access-token-only response schemas', () => {
    const loginRequestSchema = document.components?.schemas?.LoginDto as
      OpenApiSchema | undefined;
    const loginResponseSchema = document.components?.schemas
      ?.LoginResponseDto as OpenApiSchema | undefined;

    expect(Object.keys(loginRequestSchema?.properties ?? {})).toEqual([
      'email',
      'password',
    ]);
    expect(loginRequestSchema?.required).toEqual(['email', 'password']);
    expect(Object.keys(loginResponseSchema?.properties ?? {})).toEqual([
      'accessToken',
      'tokenType',
      'activeWorkshop',
      'requiresWorkshopSelection',
      'requiresPasswordChange',
    ]);
    expect(loginResponseSchema?.required).toEqual([
      'accessToken',
      'tokenType',
      'activeWorkshop',
      'requiresWorkshopSelection',
      'requiresPasswordChange',
    ]);

    const refreshResponseSchema = document.components?.schemas
      ?.RefreshResponseDto as OpenApiSchema | undefined;

    expect(Object.keys(refreshResponseSchema?.properties ?? {})).toEqual([
      'accessToken',
      'tokenType',
      'activeWorkshop',
      'requiresWorkshopSelection',
      'requiresPasswordChange',
    ]);
    expect(refreshResponseSchema?.required).toEqual([
      'accessToken',
      'tokenType',
      'activeWorkshop',
      'requiresWorkshopSelection',
      'requiresPasswordChange',
    ]);
  });

  it('keeps login and refresh response DTOs aligned on the session-context contract', () => {
    const loginResponseSchema = document.components?.schemas
      ?.LoginResponseDto as OpenApiSchema | undefined;
    const refreshResponseSchema = document.components?.schemas
      ?.RefreshResponseDto as OpenApiSchema | undefined;

    expect(loginResponseSchema).toEqual(refreshResponseSchema);
  });

  it('documents workshop selection as bearer protected', () => {
    expect(document.paths['/auth/select-workshop']?.post?.security).toEqual([
      { bearer: [] },
    ]);
  });

  it('documents forced password change as bearer protected', () => {
    const operation = document.paths['/auth/change-password']?.post;

    expect(operation?.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(operation?.responses ?? {})).toEqual([
      '204',
      '400',
      '401',
      '503',
    ]);
  });
});
