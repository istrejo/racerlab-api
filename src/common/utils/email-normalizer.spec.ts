import { normalizeEmail } from './email-normalizer';

describe('normalizeEmail', () => {
  it('trims surrounding whitespace and lowercases the email address', () => {
    expect(normalizeEmail('  ADA@Example.COM  ')).toBe('ada@example.com');
  });

  it('preserves already normalized emails', () => {
    expect(normalizeEmail('grace.hopper@example.com')).toBe(
      'grace.hopper@example.com',
    );
  });
});
