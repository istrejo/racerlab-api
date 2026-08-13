import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentBuilder } from '../../config/swagger.config';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

type OpenApiSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

describe('Memberships OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembershipsController],
      providers: [
        {
          provide: MembershipsService,
          useValue: {
            create: jest.fn(),
            list: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            resetPassword: jest.fn(),
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

  it('documents manual creation and password reset as protected operations', () => {
    expect(document.paths['/memberships']?.post?.security).toEqual([
      { bearer: [] },
    ]);
    expect(
      document.paths['/memberships/{id}/reset-password']?.post?.security,
    ).toEqual([{ bearer: [] }]);
  });

  it('accepts a temporary password only on write DTOs', () => {
    const create = document.components?.schemas?.CreateMembershipDto as
      OpenApiSchema | undefined;
    const response = document.components?.schemas?.MembershipResponseDto as
      OpenApiSchema | undefined;

    expect(Object.keys(create?.properties ?? {})).toEqual([
      'name',
      'email',
      'phone',
      'address',
      'role',
      'password',
    ]);
    expect(create?.required).toEqual(['name', 'email', 'role', 'password']);
    expect(response?.properties).not.toHaveProperty('password');
    expect(response?.properties).not.toHaveProperty('passwordHash');
  });

  it('keeps email immutable in membership updates', () => {
    const update = document.components?.schemas?.UpdateMembershipDto as
      OpenApiSchema | undefined;

    expect(Object.keys(update?.properties ?? {})).toEqual([
      'name',
      'phone',
      'address',
      'role',
      'isActive',
    ]);
    expect(update?.properties).not.toHaveProperty('email');
  });
});
