import { describe, it, expect } from 'vitest';
// This is a placeholder outline; full e2e would require booting the server.
// Keep as a minimal sanity test for hashing & TOTP.
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
describe('auth basics', () => {
    it('hash + verify password', async () => {
        const h = await bcrypt.hash('secret', 12);
        const ok = await bcrypt.compare('secret', h);
        expect(ok).toBe(true);
    });
    it('totp verify', () => {
        const secret = speakeasy.generateSecret({ length: 20 });
        const token = speakeasy.totp({ secret: secret.ascii, encoding: 'ascii' });
        const ok = speakeasy.totp.verify({ secret: secret.ascii, encoding: 'ascii', token, window: 1 });
        expect(ok).toBe(true);
    });
});
