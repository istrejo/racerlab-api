import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let healthController: HealthController;
  let prismaService: Pick<PrismaService, '$queryRaw'>;

  beforeEach(async () => {
    prismaService = {
      $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
    } as Pick<PrismaService, '$queryRaw'>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    healthController = module.get<HealthController>(HealthController);
  });

  it('returns ok when the database responds', async () => {
    await expect(healthController.check()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('throws a service unavailable exception when the database check fails', async () => {
    jest
      .spyOn(prismaService, '$queryRaw')
      .mockRejectedValueOnce(new Error('failed'));

    await expect(healthController.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
