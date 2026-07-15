import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { getCorsConfig } from './config/cors.config';
import { setupSwagger } from './config/swagger.config';

export function configureValidation(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableCors(getCorsConfig());
  app.use(cookieParser());
  configureValidation(app);
  setupSwagger(app);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}

if (require.main === module) {
  void bootstrap();
}
