import { validateEnv } from './env.validation';

const VALID_CONFIG = {
  NODE_ENV: 'development',
  PORT: '3001',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

describe('validateEnv', () => {
  it('accepts a complete, well-formed configuration', () => {
    const result = validateEnv(VALID_CONFIG);
    expect(result.PORT).toBe(3001);
    expect(result.NODE_ENV).toBe('development');
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL, ...rest } = VALID_CONFIG;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ ...VALID_CONFIG, PORT: '99999' })).toThrow(
      /PORT/,
    );
  });

  it('rejects an invalid SUPABASE_URL', () => {
    expect(() =>
      validateEnv({ ...VALID_CONFIG, SUPABASE_URL: 'not-a-url' }),
    ).toThrow(/SUPABASE_URL/);
  });
});
