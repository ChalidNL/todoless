import { expect, test, type Locator, type Page } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login } from './helpers';

/**
 * Realistic end-to-end user journey on a phone-sized viewport:
 * Inbox capture -> edit -> push to Tasks -> labels -> filter -> complete/reopen
 * -> Calendar -> Groceries (quantity, check, delete) -> Shops -> Settings ->
 * API docs link -> logout -> login -> persistence.
 */
test.describe.configure({ mode: 'serial' });

const INBOX_TITLE = `E2E inbox item ${Date.now()}`;
const EDITED_TITLE = `${INBOX_TITLE} (edited)`;
const LABEL = 'E2E label';
const GROCERY = 'E2E oat milk';
const SHOP = 'E2E corner shop';

function card(page: Page, title: string): Locator {
  return page.locator('[data-component="CompactTaskCard"]').filter({ hasText: title }).first();
}

/** Stable handle on a card (its title turns into an <input> when expanded). */
async function pinnedCard(page: Page, title: string): Promise<Locator> {
  const testId = await card(page, title).getAttribute('data-testid');
  return page.getByTestId(testId!);
}

async function quickAdd(page: Page, text: string) {
  await page.locator('.safe-top input[type="text"]').first().fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

test('inbox: capture, search, edit a task', async ({ page }) => {
  await login(page);
  await quickAdd(page, INBOX_TITLE);
  await expect(card(page, INBOX_TITLE)).toBeVisible();
  await quickAdd(page, 'E2E second inbox item');

  // Search narrows the list.
  await page.locator('.safe-top input[type="text"]').first().fill(INBOX_TITLE);
  await expect(card(page, INBOX_TITLE)).toBeVisible();
  await expect(card(page, 'E2E second inbox item')).toHaveCount(0);
  await page.locator('.safe-top input[type="text"]').first().fill('');

  // Edit the title inline; it persists across a reload.
  await (await pinnedCard(page, INBOX_TITLE)).getByRole('button', { name: 'Open Editor' }).click();
  const titleInput = page.getByRole('textbox', { name: 'Edit task title' });
  await titleInput.fill(EDITED_TITLE);
  await titleInput.press('Enter');
  await page.reload();
  await expect(card(page, EDITED_TITLE)).toBeVisible();
});

test('inbox: delete asks for confirmation and removes the task', async ({ page }) => {
  await login(page);
  const target = await pinnedCard(page, 'E2E second inbox item');
  await target.getByRole('button', { name: 'Open Editor' }).click();
  await target.getByRole('button', { name: 'Delete task' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  // Escape cancels without deleting.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await target.getByRole('button', { name: 'Delete task' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(card(page, 'E2E second inbox item')).toHaveCount(0);
  await page.reload();
  await expect(card(page, 'E2E second inbox item')).toHaveCount(0);
});

test('inbox -> tasks: push selected, label, filter, complete and reopen', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: EDITED_TITLE }).click();
  await expect(page.getByText('1 selected')).toBeVisible();
  await page.getByRole('button', { name: /Push Selected/ }).click();
  await expect(card(page, EDITED_TITLE)).toHaveCount(0);

  await page.getByRole('link', { name: 'Tasks' }).click();
  await expect(card(page, EDITED_TITLE)).toBeVisible();
  const task = await pinnedCard(page, EDITED_TITLE);

  // Create a label from the card's label editor and attach it.
  await task.getByRole('button', { name: 'Open Editor' }).click();
  await task.getByRole('button', { name: 'Edit labels' }).click();
  await task.getByPlaceholder('Add a label...').fill(LABEL);
  await task.getByPlaceholder('Add a label...').press('Enter');
  await expect(task.getByText(LABEL).first()).toBeVisible();
  await task.getByRole('button', { name: 'Close Editor' }).click();
  await expectNoHorizontalOverflow(page, 'tasks with label');

  // Filter by that label.
  await quickAdd(page, 'E2E unlabelled task');
  await expect(card(page, 'E2E unlabelled task')).toBeVisible();
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.locator('[data-popover]').getByRole('button', { name: LABEL }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Close' }).first().click();
  await expect(card(page, EDITED_TITLE)).toBeVisible();
  await expect(card(page, 'E2E unlabelled task')).toHaveCount(0);
  await page.getByTestId('active-filter-chips').getByRole('button', { name: 'Remove' }).click();
  await expect(card(page, 'E2E unlabelled task')).toBeVisible();

  // Complete, then reopen.
  await card(page, EDITED_TITLE).getByRole('button', { name: 'Mark as Done' }).click();
  await expect(page.getByRole('button', { name: /Completed \(1\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Completed \(1\)/ }).click();
  await card(page, EDITED_TITLE).getByRole('button', { name: 'Mark as Not Done' }).click();
  await expect(card(page, EDITED_TITLE).getByRole('button', { name: 'Mark as Done' })).toBeVisible();
});

test('calendar: create an all-day entry and browse periods', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Calendar' }).click();
  await quickAdd(page, 'E2E calendar entry');
  await expect(page.getByText('E2E calendar entry').first()).toBeVisible();
  const period = page.getByTestId('calendar-period-title');
  const before = await period.textContent();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(period).not.toHaveText(before ?? '');
  await page.getByRole('button', { name: 'Today' }).click();
  await expect(period).toHaveText(before ?? '');
  await expectNoHorizontalOverflow(page, 'calendar after create');
});

test('groceries and shops: add, change quantity, check off, delete', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: /Shops/ }).click();
  // Typed text pre-fills the add-shop dialog; Enter saves.
  await quickAdd(page, SHOP);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox')).toHaveValue(SHOP);
  await dialog.getByRole('textbox').press('Enter');
  await page.locator('.safe-top input[type="text"]').first().fill('');
  await expect(page.getByText(SHOP)).toBeVisible();

  await page.getByRole('link', { name: 'Groceries' }).click();
  await quickAdd(page, GROCERY);
  const row = page.locator('[data-component="UnifiedCard"], article, li, div').filter({ hasText: GROCERY }).last();
  await expect(page.getByText(GROCERY)).toBeVisible();
  await row.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(row.getByText('2', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Mark as Done' }).click();
  // Checked items move to the collapsed Completed section (persisted).
  await page.reload();
  const completed = page.getByRole('button', { name: /Completed \(1\)/ });
  await expect(completed).toBeVisible();
  await completed.click();
  await expect(page.getByText(GROCERY)).toBeVisible();
  await expectNoHorizontalOverflow(page, 'groceries completed');

  // Delete through the confirmation dialog.
  const done = page.locator('[data-component="UnifiedCard"], article, li, div').filter({ hasText: GROCERY }).last();
  await done.getByRole('button', { name: 'Open Editor' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(GROCERY)).toHaveCount(0);
});

test('settings: API documentation opens the docs, not the app', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  const docs = page.getByRole('link', { name: /Documentation/ });
  await expect(docs).toHaveAttribute('href', '/api/docs');
  await expect(docs).toHaveAttribute('target', '_blank');
  const [popup] = await Promise.all([page.waitForEvent('popup'), docs.click()]);
  await popup.waitForLoadState();
  await expect(popup).toHaveURL(/\/api\/docs$/);
  await expect(popup).toHaveTitle(/Swagger UI/);
  await expect(popup.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
  await popup.close();
});

test('logout -> login again: everything persisted', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Log out/i }).click();
  await expect(page.locator('#login-email')).toBeVisible();
  await login(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'Tasks' }).click();
  await expect(card(page, EDITED_TITLE)).toBeVisible();
  await expect(card(page, EDITED_TITLE).getByText(LABEL)).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: /Shops/ }).click();
  await expect(page.getByText(SHOP)).toBeVisible();
});
