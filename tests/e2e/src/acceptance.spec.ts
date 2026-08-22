import { expect, test } from '@playwright/test'

/**
 * PRD §32 admin acceptance flow, run against the Firebase emulator suite.
 *
 * Prerequisites:
 *   cd tests/e2e && npm install && npx playwright install chromium
 *   firebase emulators:exec --only auth,firestore,functions "npm run test:e2e"
 *   (app must run with VITE_USE_EMULATORS=true and ADMIN_PHONES including the login phone)
 */

const ADMIN_PHONE = '+919876543210'

async function loginWithOtp(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByPlaceholder('+91 98765 43210').fill(ADMIN_PHONE)
  await page.getByRole('button', { name: 'Continue' }).click()

  // In the emulator the OTP code is deterministic via the functions emulator log;
  // read it from the otps/{phone} doc through the emulator REST API.
  const res = await page.request.get(
    'http://127.0.0.1:8080/v1/projects/demo-chitapp/databases/(default)/documents/otps/%2B919876543210',
  )
  const doc = (await res.json()) as { fields?: { codeHash?: { stringValue?: string } } }
  // Emulator mode: requestOtp returns/echoes nothing, so fall back to password login
  // seeded for the admin account in test setup when OTP retrieval is unavailable.
  if (!doc.fields?.codeHash) {
    await page.getByRole('button', { name: /password instead/i }).click()
    await page.getByPlaceholder('+91 98765 43210').fill(ADMIN_PHONE)
    await page.locator('input[type="password"]').fill('e2e-admin-pass')
    await page.getByRole('button', { name: 'Sign in' }).click()
  }
  await expect(page).toHaveURL(/\/groups/)
}

test('admin acceptance flow (PRD §32)', async ({ page }) => {
  await loginWithOtp(page)

  // 2. Create a group — ₹10,000/month, 20 months
  await page.getByRole('link', { name: /new group/i }).click()
  await page.getByPlaceholder('Ahmed Friends Group').fill('E2E Chit Group')
  await page.getByPlaceholder('10000').fill('10000')
  await page.getByPlaceholder('20').first().fill('3')
  await page.locator('input[type="date"]').fill('2026-09-01')
  await page.getByRole('button', { name: 'Create group' }).click()
  await expect(page.getByRole('heading', { name: 'E2E Chit Group' })).toBeVisible()

  // 3–4. Add members
  await page.getByRole('button', { name: 'Add member' }).click()
  await page.locator('form input:not([type="tel"])').first().fill('Ravi')
  await page.getByPlaceholder('+91 98765 43210').fill('+919876543211')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Ravi added')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'Add member' }).click()
  await page.locator('form input:not([type="tel"])').first().fill('Meena')
  await page.getByPlaceholder('+91 98765 43210').fill('+919876543212')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  // 5. Start the first monthly cycle
  await page.getByRole('button', { name: 'Start month 1' }).click()
  await expect(page.getByText(/Month 1/)).toBeVisible()

  // 6–7. Mark Ravi paid; Meena stays pending on the board
  await page.getByRole('button', { name: /Ravi/ }).click()
  await page.getByRole('button', { name: 'Record payment' }).click()
  await expect(page.getByText('Paid · Cash')).toBeVisible()
  await expect(page.getByText('1/2 paid')).toBeVisible()

  // 9–10. Random pick + confirm (only Ravi is eligible if requirePaidToWin)
  await page.getByRole('button', { name: 'Pick randomly' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText(/receives/)).toBeVisible()

  // 11. Record payout
  await page.getByRole('button', { name: 'Record payout' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm payout' }).click()
  await expect(page.getByText(/Month 1 complete/)).toBeVisible()

  // 12. Start the next cycle
  await page.getByRole('button', { name: 'Start month 2' }).click()
  await expect(page.getByText(/Month 2/)).toBeVisible()

  // 13. History shows the completed month
  await expect(page.getByText('Past months')).toBeVisible()
})
