import net from 'node:net';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { ADMIN, login } from './helpers';

/**
 * #68 forgot-password, end to end: request a reset on the login screen, catch
 * the real email PocketBase sends, follow its link into the app's
 * /reset-password page, set a new password and log in with it.
 */
test.describe.configure({ mode: 'serial' });

/** Minimal SMTP sink: accepts any message and keeps the raw DATA. */
function startSmtpSink(): Promise<{ port: number; messages: string[]; close: () => void }> {
  const messages: string[] = [];
  const server = net.createServer((socket) => {
    let inData = false;
    let buffer = '';
    let data = '';
    socket.write('220 e2e-sink ESMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            messages.push(data);
            data = '';
            socket.write('250 OK\r\n');
          } else {
            data += `${line.startsWith('..') ? line.slice(1) : line}\n`;
          }
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO') socket.write('250-e2e-sink\r\n250 OK\r\n');
        else if (cmd === 'HELO') socket.write('250 OK\r\n');
        else if (cmd === 'DATA') { inData = true; socket.write('354 End with .\r\n'); }
        else if (cmd === 'QUIT') { socket.write('221 Bye\r\n'); socket.end(); }
        else socket.write('250 OK\r\n');
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      resolve({ port, messages, close: () => server.close() });
    });
  });
}

async function superuser(request: APIRequestContext) {
  test.skip(!process.env.E2E_SU_EMAIL, 'requires scripts/e2e.sh (disposable superuser)');
  const res = await request.post('/api/collections/_superusers/auth-with-password', {
    data: { identity: process.env.E2E_SU_EMAIL, password: process.env.E2E_SU_PASSWORD },
  });
  return { Authorization: `Bearer ${(await res.json()).token}` };
}

function decodeQuotedPrintable(text: string) {
  return text.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

test('forgot password: email link opens the app reset page and the new password works', async ({ page, request, baseURL }) => {
  const su = await superuser(request);
  const sink = await startSmtpSink();
  try {
    const settings = await request.patch('/api/settings', {
      headers: su,
      data: {
        meta: { appURL: baseURL, senderName: 'todoless', senderAddress: 'noreply@example.com' },
        smtp: { enabled: true, host: '127.0.0.1', port: sink.port, tls: false, authMethod: 'PLAIN', username: '', password: '' },
      },
    });
    expect(settings.ok(), await settings.text()).toBeTruthy();

    await page.goto('/');
    const goToLogin = page.getByRole('button', { name: 'Go to login' });
    await expect(goToLogin.or(page.locator('#login-email')).first()).toBeVisible();
    if (await goToLogin.isVisible()) await goToLogin.click();
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.locator('#forgot-email').fill(ADMIN.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toContainText(/reset link sent/i);

    await expect.poll(() => sink.messages.length, { timeout: 15_000 }).toBeGreaterThan(0);
    const mail = decodeQuotedPrintable(sink.messages[0]);
    const link = mail.match(/https?:\/\/[^\s"<>]+\/reset-password\?token=[^\s"<>)]+/)?.[0];
    expect(link, 'reset email links to the app, not to /_/').toBeTruthy();
    expect(mail).not.toContain('/_/#/auth/confirm-password-reset');

    const newPassword = 'Reset-Passw0rd!';
    await page.goto(link!.replace(/&amp;/g, '&'));
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm new password').fill(`${newPassword}x`);
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('alert')).toContainText(/do not match/i);
    await page.getByLabel('Confirm new password').fill(newPassword);
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('status')).toContainText(/password has been changed/i);

    // The same link cannot be used twice.
    await page.goto(link!.replace(/&amp;/g, '&'));
    await page.getByLabel('New password', { exact: true }).fill('Another-Passw0rd!');
    await page.getByLabel('Confirm new password').fill('Another-Passw0rd!');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('alert')).toContainText(/invalid or has expired/i);

    // New password works; restore the shared admin password for other specs.
    await login(page, ADMIN.email, newPassword);
    const auth = await request.post('/api/collections/users/auth-with-password', { data: { identity: ADMIN.email, password: newPassword } });
    const { token, record } = await auth.json();
    const restore = await request.patch(`/api/collections/users/records/${record.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { oldPassword: newPassword, password: ADMIN.password, passwordConfirm: ADMIN.password },
    });
    expect(restore.ok()).toBeTruthy();
  } finally {
    sink.close();
  }
});

test('reset page without a token explains the link is invalid', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByRole('alert')).toContainText(/invalid or has expired/i);
  await expect(page.getByRole('button', { name: 'Save new password' })).toBeDisabled();
});
