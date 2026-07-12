import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { applyJwtTestEnv } from '../src/testing/jwt-test-env';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;
  let restoreJwtTestEnv: (() => void) | undefined;

  beforeEach(async () => {
    restoreJwtTestEnv = applyJwtTestEnv();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'ok',
      database: 'ok',
    });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    restoreJwtTestEnv?.();
    restoreJwtTestEnv = undefined;
  });
});
