import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };

  const userResponse = {
    id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date('2026-07-10T12:00:00.000Z'),
    updatedAt: new Date('2026-07-10T12:30:00.000Z'),
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    usersController = module.get<UsersController>(UsersController);
  });

  it('protects current users routes with JWT auth and the ADMIN role', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, UsersController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('delegates user creation to the service', async () => {
    usersService.create.mockResolvedValue(userResponse);
    const dto: CreateUserDto = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'super-secret',
      role: UserRole.ADMIN,
    };

    await expect(usersController.create(dto)).resolves.toBe(userResponse);
    expect(usersService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates user listing to the service', async () => {
    usersService.findAll.mockResolvedValue([userResponse]);

    await expect(usersController.findAll()).resolves.toEqual([userResponse]);
    expect(usersService.findAll).toHaveBeenCalledTimes(1);
  });

  it('delegates user detail lookup to the service', async () => {
    usersService.findOne.mockResolvedValue(userResponse);

    await expect(usersController.findOne(userResponse.id)).resolves.toBe(
      userResponse,
    );
    expect(usersService.findOne).toHaveBeenCalledWith(userResponse.id);
  });

  it('delegates user updates to the service', async () => {
    usersService.update.mockResolvedValue({
      ...userResponse,
      name: 'Grace Hopper',
    });

    await expect(
      usersController.update(userResponse.id, {
        name: 'Grace Hopper',
        isActive: false,
      }),
    ).resolves.toEqual({
      ...userResponse,
      name: 'Grace Hopper',
    });
    expect(usersService.update).toHaveBeenCalledWith(userResponse.id, {
      name: 'Grace Hopper',
      isActive: false,
    });
  });
});
