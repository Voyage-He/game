import { expect, test, type Page } from '@playwright/test';

test('Chinese prompts explain waiting/action/voting and settlement review without early leaks', async ({ browser }) => {
  test.setTimeout(180000);
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [ownerContext, player2Context, player3Context] = contexts;
  const owner = await ownerContext!.newPage();
  const player2 = await player2Context!.newPage();
  const player3 = await player3Context!.newPage();
  const pages = [owner, player2, player3];

  const roomCode = await createAndJoin(owner, player2, player3);
  await expect(owner.locator('#start-game')).toBeEnabled();
  await owner.locator('#start-game').click();

  await expect(owner.locator('.own-role')).toBeVisible({ timeout: 5000 });
  await expect(owner.locator('.phase-card')).not.toContainText('水下 1：');

  await expect(owner.locator('.phase-card h2').filter({ hasText: /行动/ })).toBeVisible({ timeout: 15000 });
  await expectAnyPageContains(pages, '其他玩家行动中');
  await expectAnyPageContains(pages, /轮到你行动|其他玩家行动中/);

  await expect(owner.locator('.phase-card h2')).toContainText('自由发言', { timeout: 130000 });
  await expect(owner.getByText('自由发言不限时')).toBeVisible();
  await owner.locator('#advance-vote').click();
  await expect(owner.locator('.phase-card h2')).toContainText('投票');
  await expect(owner.getByText('投票进度')).toBeVisible();
  await expect(owner.getByText('请选择一名其他玩家投票')).toBeVisible();
  await owner.locator('[data-vote]').first().click();
  await player2.locator('[data-vote]').first().click();
  await player3.locator('[data-vote]').first().click();

  await expect(owner.getByRole('heading', { name: '结算', exact: true })).toBeVisible({ timeout: 10000 });
  // All cards are flipped in the main playing area (not separate settlement sections)
  await expect(owner.locator('.card[data-flipped="true"]').first()).toBeVisible();
  await expect(owner.getByText(/无人出局|出局：席位/)).toBeVisible();

  await Promise.all(contexts.map((context) => context.close()));
});

async function createAndJoin(owner: Page, player2: Page, player3: Page): Promise<string> {
  await owner.goto('/');
  await owner.locator('#create-form input[name="nickname"]').fill('阿明');
  await owner.locator('#create-form button').click();
  await expect(owner.locator('.room-code')).toBeVisible();
  const roomCode = (await owner.locator('.room-code').innerText()).trim();

  for (const [page, nickname] of [
    [player2, '小红'],
    [player3, '小李']
  ] as const) {
    await page.goto('/');
    await page.locator('#join-form input[name="roomCode"]').fill(roomCode);
    await page.locator('#join-form input[name="nickname"]').fill(nickname);
    await page.locator('#join-form button').click();
    await expect(page.getByText(roomCode)).toBeVisible();
  }

  return roomCode;
}

async function expectAnyPageContains(pages: Page[], text: string | RegExp): Promise<void> {
  await expect
    .poll(async () => {
      for (const page of pages) {
        if ((await page.getByText(text).count()) > 0) return true;
      }
      return false;
    }, { timeout: 5000 })
    .toBe(true);
}
