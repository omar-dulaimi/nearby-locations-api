import { hashPassword } from './password.js';

export type Role = 'reader' | 'writer';

export interface UserRecord {
  username: string;
  role: Role;
  passwordHash: string; // "salt:hash" hex
}

// Demo credentials used when AUTH_USERS is not set. Documented in the README and .env.example.
// (Plaintext here is intentional: these are throwaway demo accounts, not production secrets.)
export const DEMO_READER_PASSWORD = 'reader-secret';
export const DEMO_WRITER_PASSWORD = 'writer-secret';

let cached: UserRecord[] | undefined;
export function defaultUsers(): UserRecord[] {
  if (!cached) {
    cached = [
      { username: 'reader', role: 'reader', passwordHash: hashPassword(DEMO_READER_PASSWORD) },
      { username: 'writer', role: 'writer', passwordHash: hashPassword(DEMO_WRITER_PASSWORD) },
    ];
  }
  return cached;
}

export function parseUsersFromEnv(json: string): UserRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('AUTH_USERS must be valid JSON');
  }
  if (!Array.isArray(parsed) || parsed.length === 0)
    throw new Error('AUTH_USERS must be a non-empty JSON array');
  return parsed.map((u, i) => {
    const r = u as Partial<UserRecord>;
    if (typeof r.username !== 'string' || !r.username)
      throw new Error(`AUTH_USERS[${i}].username is required`);
    if (typeof r.passwordHash !== 'string' || !r.passwordHash.includes(':'))
      throw new Error(`AUTH_USERS[${i}].passwordHash must be "salt:hash"`);
    if (r.role !== 'reader' && r.role !== 'writer')
      throw new Error(`AUTH_USERS[${i}].role must be "reader" or "writer"`);
    return { username: r.username, role: r.role, passwordHash: r.passwordHash };
  });
}

export function findUser(users: UserRecord[], username: string): UserRecord | undefined {
  return users.find((u) => u.username === username);
}
