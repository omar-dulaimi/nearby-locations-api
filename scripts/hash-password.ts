import { hashPassword } from '../src/auth/password.js';
const plain = process.argv[2];
if (!plain) {
  console.error('Usage: npm run hash-password -- <plaintext-password>');
  process.exit(1);
}
console.log(hashPassword(plain));
