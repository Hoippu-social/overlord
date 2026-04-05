import { test, chromium, devices } from 'playwright/test';

test('capture stats settings', async () => {
    const browser = await chromium.launch({ channel: 'msedge' });

    const desktopContext = await browser.newContext({
        viewport: { width: 1440, height: 1400 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
    await desktopPage.fill('#password', 'admin');
    await Promise.all([
        desktopPage.waitForURL('**/dashboard', { timeout: 15000 }),
        desktopPage.locator('form').getByRole('button', { name: /войти по паролю/i }).click(),
    ]);
    await desktopPage.goto('http://localhost:3001/dashboard/1374115841855197184/stats/settings', { waitUntil: 'networkidle' });
    await desktopPage.screenshot({ path: 'D:/discord_bot/Dev/tmp/stats-settings-desktop.png', fullPage: true });

    const mobileContext = await browser.newContext({
        ...devices['iPhone 12'],
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
    await mobilePage.fill('#password', 'admin');
    await Promise.all([
        mobilePage.waitForURL('**/dashboard', { timeout: 15000 }),
        mobilePage.locator('form').getByRole('button', { name: /войти по паролю/i }).click(),
    ]);
    await mobilePage.goto('http://localhost:3001/dashboard/1374115841855197184/stats/settings', { waitUntil: 'networkidle' });
    await mobilePage.screenshot({ path: 'D:/discord_bot/Dev/tmp/stats-settings-mobile.png', fullPage: true });

    await browser.close();
});
