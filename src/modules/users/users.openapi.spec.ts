import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
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
      new DocumentBuilder().setTitle('RacerLab API').build(),
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

  it('discloses temporary bootstrap-only access without claiming current auth protection', () => {
    const operations = [
      document.paths['/users']?.post,
      document.paths['/users']?.get,
      document.paths['/users/{id}']?.get,
      document.paths['/users/{id}']?.patch,
    ];

    for (const operation of operations) {
      expect(operation?.summary).toContain('bootstrap');
      expect(operation?.summary).toContain(
        'temporary unauthenticated endpoint',
      );
      expect(operation?.description).toContain(
        'Temporary bootstrap-only endpoint',
      );
      expect(operation?.description).toContain(
        'JWT/Auth/RBAC protection is out of scope',
      );
      expect(operation?.description).toContain(
        'must be added before production exposure',
      );
      expect(operation?.security).toBeUndefined();
    }
  });

  it('documents success and expected error responses for users endpoints', () => {
    expect(
      Object.keys(document.paths['/users']?.post?.responses ?? {}),
    ).toEqual(['201', '400', '409', '503']);
    expect(Object.keys(document.paths['/users']?.get?.responses ?? {})).toEqual(
      ['200'],
    );
    expect(
      Object.keys(document.paths['/users/{id}']?.get?.responses ?? {}),
    ).toEqual(['200', '400', '404']);
    expect(
      Object.keys(document.paths['/users/{id}']?.patch?.responses ?? {}),
    ).toEqual(['200', '400', '404', '409', '503']);
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
