import { PasswordHasherService } from './password-hasher.service';

describe('PasswordHasherService', () => {
  let service: PasswordHasherService;

  beforeEach(() => {
    service = new PasswordHasherService();
  });

  it('verifies a password against its Argon2 hash', async () => {
    const hash = await service.hash('super-secret');

    await expect(service.verify('super-secret', hash)).resolves.toBe(true);
  });

  it('rejects verification when the password does not match the Argon2 hash', async () => {
    const hash = await service.hash('super-secret');

    await expect(service.verify('wrong-secret', hash)).resolves.toBe(false);
  });
});
