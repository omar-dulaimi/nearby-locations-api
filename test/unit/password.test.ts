// test/unit/password.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

describe('password hashing (scrypt)', () => {
  it('hashes to "salt:hash" hex and verifies correctly', () => {
    const stored = hashPassword('hunter2');
    expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(verifyPassword('hunter2', stored)).toBe(true);
    expect(verifyPassword('wrong', stored)).toBe(false);
  });
  it('uses a random salt (two hashes of the same password differ)', () => {
    expect(hashPassword('x')).not.toBe(hashPassword('x'));
  });
  it('returns false for a malformed stored value', () => {
    expect(verifyPassword('x', 'garbage')).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
  });
});
