import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './config/swagger.config';
import { configureApp, configureValidation } from './main';

jest.mock('./config/swagger.config', () => ({
  setupSwagger: jest.fn(),
}));

describe('configureValidation', () => {
  it('registers the global validation pipe with bootstrap-safe defaults', () => {
    const app = {
      useGlobalPipes: jest.fn(),
    };

    configureValidation(app as never);

    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    const [pipe] = app.useGlobalPipes.mock.calls[0] as [ValidationPipe];
    expect(pipe).toBeInstanceOf(ValidationPipe);
    expect(pipe['validatorOptions']).toMatchObject({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(pipe['isTransformEnabled']).toBe(true);
  });
});

describe('configureApp', () => {
  it('registers cookie parsing before Swagger so auth cookies are available to routes', () => {
    const app = {
      use: jest.fn(),
      useGlobalPipes: jest.fn(),
    };

    configureApp(app as never);

    expect(app.use).toHaveBeenCalledTimes(1);

    const [middleware] = app.use.mock.calls[0] as [(...args: unknown[]) => unknown];

    expect(typeof middleware).toBe('function');
    expect(middleware.name).toBe('cookieParser');
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(setupSwagger).toHaveBeenCalledWith(app);
  });
});
