import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
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
          useValue: { login: jest.fn() },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('RacerLab API').build(),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents POST /auth/login as a public token issuance endpoint', () => {
    const operation = document.paths['/auth/login']?.post;

    expect(operation).toBeDefined();
    expect(operation?.summary).toContain('Log in');
    expect(operation?.security).toBeUndefined();
    expect(Object.keys(operation?.responses ?? {})).toEqual([
      '200',
      '400',
      '401',
      '503',
    ]);
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
  });
});
