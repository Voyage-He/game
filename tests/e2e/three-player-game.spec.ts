import { expect, test, type Page } from '@playwright/test';

test('card UI: players rendered as vertical cards with underwater cards section', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const player2Context = await browser.newContext();
  const player3Context = await browser.newContext();
  const owner = await ownerContext.newPage();
  const player2 = await player2Context.newPage();
  const player3 = await player3Context.newPage();

  await owner.goto('/');
  await owner.locator('#create-form input[name="nickname"]').fill('阿明');
  await owner.locator('#create-form button').click();
  const roomCode = (await owner.locator('.room-code').innerText()).trim();

  for (const [page, nickname] of [[player2, '小红'], [player3, '小李']] as const) {
    await page.goto('/');
    await page.locator('#join-form input[name="roomCode"]').fill(roomCode);
    await page.locator('#join-form input[name="nickname"]').fill(nickname);
    await page.locator('#join-form button').click();
  }

  await owner.locator('#start-game').click();
  // Wait for in-game phase (close_eyes or first action phase)
  await expect(owner.locator('.phase-card h2')).not.toHaveText('等待中', { timeout: 10000 });

  // Verify card-based UI: player cards rendered
  await expect(owner.locator('.players-grid')).toBeVisible({ timeout: 5000 });
  await expect(owner.locator('.player-card').first()).toBeVisible();
  const playerCards = await owner.locator('.player-card').count();
  expect(playerCards).toBe(3);

  // Verify nicknames on cards
  await expect(owner.getByText('阿明')).toBeVisible();
  await expect(owner.getByText('小红')).toBeVisible();
  await expect(owner.getByText('小李')).toBeVisible();

  // Verify underwater cards section
  await expect(owner.getByText('水下的牌')).toBeVisible();
  await expect(owner.locator('.underwater-card').first()).toBeVisible();
  const underwaterCards = await owner.locator('.underwater-card').count();
  expect(underwaterCards).toBe(3);

  // Verify card elements have expected structure
  await expect(owner.locator('.card').first()).toBeVisible();
  await expect(owner.locator('.card-back').first()).toBeVisible();

  // Verify underwater labels in Chinese
  await expect(owner.getByText('水下 1')).toBeVisible();
  await expect(owner.getByText('水下 2')).toBeVisible();
  await expect(owner.getByText('水下 3')).toBeVisible();

  // Verify disconnected player card styling (reload a player)
  await player2.reload();
  // After reload, the player shows as disconnected on other clients
  await expect(owner.locator('.player-card.disconnected')).toBeVisible({ timeout: 10000 });

  await ownerContext.close();
  await player2Context.close();
  await player3Context.close();
});

test('three players create, join, reconnect, play, vote, and settle', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const player2Context = await browser.newContext();
  const player3Context = await browser.newContext();
  const owner = await ownerContext.newPage();
  const player2 = await player2Context.newPage();
  const player3 = await player3Context.newPage();

  await owner.goto('/');
  await owner.locator('#create-form input[name="nickname"]').fill('阿明');
  await owner.locator('#create-form button').click();
  await expect(owner.locator('.room-code')).toBeVisible();
  const roomCode = (await owner.locator('.room-code').innerText()).trim();

  for (const [page, nickname] of [[player2, '小红'], [player3, '小李']] as const) {
    await page.goto('/');
    await page.locator('#join-form input[name="roomCode"]').fill(roomCode);
    await page.locator('#join-form input[name="nickname"]').fill(nickname);
    await page.locator('#join-form button').click();
    await expect(page.getByText(roomCode)).toBeVisible();
  }

  await player2.reload();
  await player2.locator('#reconnect-form input[name="roomCode"]').fill(roomCode);
  await player2.locator('#reconnect-form button').click();
  await expect(player2.getByText(roomCode)).toBeVisible();

  await expect(owner.locator('#start-game')).toBeEnabled();
  await owner.locator('#start-game').click();

  await expect(owner.getByText('闭眼准备')).toBeVisible({ timeout: 5000 });
  await expectCountdownDecreases(owner);

  await expect(owner.locator('.phase-card h2').filter({ hasText: /行动/ })).toBeVisible({ timeout: 15000 });
  await expectCountdownDecreases(owner);

  await player2.reload();
  await player2.locator('#reconnect-form input[name="roomCode"]').fill(roomCode);
  await player2.locator('#reconnect-form button').click();
  await expect(player2.getByText(roomCode)).toBeVisible();
  const ownerRemaining = await countdownNumber(owner);
  const reconnectedRemaining = await countdownNumber(player2);
  expect(Math.abs(ownerRemaining - reconnectedRemaining)).toBeLessThanOrEqual(2);

  await expect(owner.locator('.phase-card h2')).toHaveText('自由发言', { timeout: 30000 });
  await owner.locator('#chat-form input[name="text"]').fill('我觉得狼人不在场。');
  await owner.locator('#chat-form button').click();
  await expect(player3.getByText('我觉得狼人不在场。')).toBeVisible();

  await owner.locator('#advance-vote').click();
  await expect(owner.locator('.phase-card h2')).toHaveText('投票');
  await expectCountdownDecreases(owner);
  await owner.locator('[data-vote]').first().click();
  await player2.locator('[data-vote]').first().click();
  await player3.locator('[data-vote]').first().click();

  await expect(owner.getByText('胜利阵营')).toBeVisible({ timeout: 10000 });

  await ownerContext.close();
  await player2Context.close();
  await player3Context.close();
});

async function countdownNumber(page: Page): Promise<number> {
  const text = await page.locator('.timer strong').first().innerText();
  return Number(text.replace(/\D/gu, ''));
}

async function expectCountdownDecreases(page: Page): Promise<void> {
  await expect(page.locator('.timer strong').first()).toBeVisible({ timeout: 5000 });
  await expect.poll(() => countdownNumber(page), { timeout: 5000 }).toBeGreaterThan(1);
  const first = await countdownNumber(page);
  await page.waitForTimeout(1100);
  const second = await countdownNumber(page);
  expect(second).toBeLessThan(first);
}
