// test/unit/users.test.ts
import { describe, it, expect } from 'vitest';
import {
  defaultUsers,
  parseUsersFromEnv,
  findUser,
  DEMO_READER_PASSWORD,
  DEMO_WRITER_PASSWORD,
} from '../../src/auth/users.js';
import { verifyPassword } from '../../src/auth/password.js';

describe('defaultUsers', () => {
  it('provides a reader and a writer whose documented passwords verify', () => {
    const users = defaultUsers();
    const reader = findUser(users, 'reader')!;
    const writer = findUser(users, 'writer')!;
    expect(reader.role).toBe('reader');
    expect(writer.role).toBe('writer');
    expect(verifyPassword(DEMO_READER_PASSWORD, reader.passwordHash)).toBe(true);
    expect(verifyPassword(DEMO_WRITER_PASSWORD, writer.passwordHash)).toBe(true);
  });
});

describe('parseUsersFromEnv', () => {
  it('parses a valid JSON array', () => {
    const json = JSON.stringify([{ username: 'a', role: 'writer', passwordHash: 'aa:bb' }]);
    expect(parseUsersFromEnv(json)).toEqual([{ username: 'a', role: 'writer', passwordHash: 'aa:bb' }]);
  });
  it('throws on bad JSON or bad shape', () => {
    expect(() => parseUsersFromEnv('not json')).toThrow();
    expect(() => parseUsersFromEnv(JSON.stringify([{ username: 'a' }]))).toThrow(/AUTH_USERS/);
    expect(() =>
      parseUsersFromEnv(JSON.stringify([{ username: 'a', role: 'admin', passwordHash: 'x:y' }])),
    ).toThrow(/role/);
  });
});

describe('findUser', () => {
  it('finds by username, returns undefined otherwise', () => {
    const users = [{ username: 'a', role: 'reader' as const, passwordHash: 'x:y' }];
    expect(findUser(users, 'a')?.username).toBe('a');
    expect(findUser(users, 'b')).toBeUndefined();
  });
});
