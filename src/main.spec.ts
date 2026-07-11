import { ValidationPipe } from '@nestjs/common';
import { configureValidation } from './main';

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
