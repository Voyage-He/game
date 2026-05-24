import { expect, test } from '@playwright/test';

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

  await expect(owner.getByText('自由发言')).toBeVisible({ timeout: 10000 });
  await owner.locator('#chat-form input[name="text"]').fill('我觉得狼人不在场。');
  await owner.locator('#chat-form button').click();
  await expect(player3.getByText('我觉得狼人不在场。')).toBeVisible();

  await owner.locator('#advance-vote').click();
  await expect(owner.getByText('投票')).toBeVisible();
  await owner.locator('[data-vote]').first().click();
  await player2.locator('[data-vote]').first().click();
  await player3.locator('[data-vote]').first().click();

  await expect(owner.getByText('胜利阵营')).toBeVisible({ timeout: 10000 });

  await ownerContext.close();
  await player2Context.close();
  await player3Context.close();
});
