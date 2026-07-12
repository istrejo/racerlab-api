import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createSwaggerDocumentBuilder(): DocumentBuilder {
  return new DocumentBuilder()
    .setTitle('RacerLab API')
    .setDescription(
      'NestJS REST API for workshop operations. The backend is the source of truth for business rules and the official API contract.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide a valid access token.',
      },
      'bearer',
    );
}

export function setupSwagger(app: INestApplication): void {
  const config = createSwaggerDocumentBuilder().build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, documentFactory);
}
