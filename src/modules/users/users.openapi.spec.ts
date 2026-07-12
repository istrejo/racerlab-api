import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentBuilder } from '../../config/swagger.config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

type OpenApiSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

describe('Users OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
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

  it('documents create, list, detail, and update users operations', () => {
    expect(document.paths['/users']?.post).toBeDefined();
    expect(document.paths['/users']?.get).toBeDefined();
    expect(document.paths['/users/{id}']?.get).toBeDefined();
    expect(document.paths['/users/{id}']?.patch).toBeDefined();
  });

  it('declares Bearer auth for every protected users operation', () => {
    const operations = [
      document.paths['/users']?.post,
      document.paths['/users']?.get,
      document.paths['/users/{id}']?.get,
      document.paths['/users/{id}']?.patch,
    ];

    for (const operation of operations) {
      expect(operation?.security).toEqual([{ bearer: [] }]);
    }

    expect(document.components?.securitySchemes?.bearer).toBeDefined();
  });

  it('documents success and expected error responses for users endpoints', () => {
    expect(
      Object.keys(document.paths['/users']?.post?.responses ?? {}),
    ).toEqual(['201', '400', '401', '403', '409', '503']);
    expect(Object.keys(document.paths['/users']?.get?.responses ?? {})).toEqual(
      ['200', '401', '403'],
    );
    expect(
      Object.keys(document.paths['/users/{id}']?.get?.responses ?? {}),
    ).toEqual(['200', '400', '401', '403', '404']);
    expect(
      Object.keys(document.paths['/users/{id}']?.patch?.responses ?? {}),
    ).toEqual(['200', '400', '401', '403', '404', '409', '503']);
  });

  it('documents an update schema without password fields', () => {
    const updateUserSchema = document.components?.schemas?.UpdateUserDto as
      OpenApiSchema | undefined;
    const updateUserProperties = updateUserSchema?.properties ?? {};
    const updateUserRequired = updateUserSchema?.required ?? [];

    expect(Object.keys(updateUserProperties)).toEqual([
      'name',
      'email',
      'role',
      'isActive',
    ]);
    expect(updateUserProperties).not.toHaveProperty('password');
    expect(updateUserRequired).toEqual([]);
  });

  it('keeps credential fields and role database ids out of public response schemas', () => {
    const userResponseSchema = document.components?.schemas?.UserResponseDto as
      OpenApiSchema | undefined;
    const userResponseProperties = userResponseSchema?.properties ?? {};
    const userResponseRequired = userResponseSchema?.required ?? [];

    expect(Object.keys(userResponseProperties)).toEqual([
      'id',
      'name',
      'email',
      'role',
      'isActive',
      'createdAt',
      'updatedAt',
    ]);
    expect(userResponseProperties).not.toHaveProperty('passwordHash');
    expect(userResponseProperties).not.toHaveProperty('roleId');
    expect(userResponseRequired).not.toContain('passwordHash');
    expect(userResponseRequired).not.toContain('roleId');
  });
});
