import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentBuilder } from '../../config/swagger.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type OpenApiSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
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
            login: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
            logoutAll: jest.fn(),
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

  it('documents refresh-cookie response headers for login, refresh, and logout', () => {
    const loginOperation = document.paths['/auth/login']?.post;
    const refreshOperation = document.paths['/auth/refresh']?.post;
    const logoutOperation = document.paths['/auth/logout']?.post;

    expect(
      loginOperation?.responses?.['200']?.headers?.['Set-Cookie'],
    ).toBeDefined();
    expect(
      refreshOperation?.responses?.['200']?.headers?.['Set-Cookie'],
    ).toBeDefined();
    expect(
      logoutOperation?.responses?.['204']?.headers?.['Set-Cookie'],
    ).toBeDefined();
    expect(refreshOperation?.description).toContain('HttpOnly refresh cookie');
    expect(logoutOperation?.description).toContain('clears the refresh cookie');
  });

  it('documents POST /auth/logout-all as a bearer-protected revocation endpoint', () => {
    const operation = document.paths['/auth/logout-all']?.post;

    expect(operation).toBeDefined();
    expect(operation?.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(operation?.responses ?? {})).toEqual(['204', '401', '503']);
    expect(operation?.description).toContain('Revokes every active refresh session');
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
    ]);
    expect(loginResponseSchema?.required).toEqual(['accessToken', 'tokenType']);

    const refreshResponseSchema = document.components?.schemas
      ?.RefreshResponseDto as OpenApiSchema | undefined;

    expect(Object.keys(refreshResponseSchema?.properties ?? {})).toEqual([
      'accessToken',
      'tokenType',
    ]);
    expect(refreshResponseSchema?.required).toEqual([
      'accessToken',
      'tokenType',
    ]);
  });

  it('keeps login and refresh response DTOs aligned on the access-token-only contract', () => {
    const loginResponseSchema = document.components?.schemas
      ?.LoginResponseDto as OpenApiSchema | undefined;
    const refreshResponseSchema = document.components?.schemas
      ?.RefreshResponseDto as OpenApiSchema | undefined;

    expect(loginResponseSchema).toEqual(refreshResponseSchema);
  });
});
