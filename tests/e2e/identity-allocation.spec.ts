import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

test('fresh games vary identities while reload keeps the active-game identity', async ({ browser }) => {
  const ownerRoles: string[] = [];

  for (let i = 0; i < 6; i += 1) {
    const game = await startThreePlayerGame(browser, i);
    const ownerRole = (await game.owner.locator('.own-role strong').innerText()).trim();
    ownerRoles.push(ownerRole);

    if (i === 0) {
      await game.owner.reload();
      await game.owner.locator('#reconnect-form input[name="roomCode"]').fill(game.roomCode);
      await game.owner.locator('#reconnect-form button').click();
      await expect(game.owner.locator('.own-role strong')).toHaveText(ownerRole, { timeout: 5000 });
    }

    await Promise.all(game.contexts.map((context) => context.close()));
  }

  expect(new Set(ownerRoles).size).toBeGreaterThan(1);
});

async function startThreePlayerGame(browser: Browser, index: number): Promise<{ contexts: BrowserContext[]; owner: Page; roomCode: string }> {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [ownerContext, player2Context, player3Context] = contexts;
  const owner = await ownerContext!.newPage();
  const player2 = await player2Context!.newPage();
  const player3 = await player3Context!.newPage();

  await owner.goto('/');
  await owner.locator('#create-form input[name="nickname"]').fill('阿明');
  await owner.locator('#create-form button').click();
  await expect(owner.locator('.room-code')).toBeVisible();
  const roomCode = (await owner.locator('.room-code').innerText()).trim();

  for (const [page, nickname] of [
    [player2, `小红${index}`],
    [player3, `小李${index}`]
  ] as const) {
    await page.goto('/');
    await page.locator('#join-form input[name="roomCode"]').fill(roomCode);
    await page.locator('#join-form input[name="nickname"]').fill(nickname);
    await page.locator('#join-form button').click();
    await expect(page.getByText(roomCode)).toBeVisible();
  }

  await expect(owner.locator('#start-game')).toBeEnabled();
  await owner.locator('#start-game').click();
  await expect(owner.locator('.own-role strong')).toBeVisible({ timeout: 5000 });

  return { contexts, owner, roomCode };
}
