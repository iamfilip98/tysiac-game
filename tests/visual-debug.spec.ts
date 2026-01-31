import { test, expect } from '@playwright/test';

test('Visual debug - capture ready toggle behavior', async ({ page }) => {
  await page.goto('/');

  // Wait for connection
  await page.waitForSelector('text=Connected', { timeout: 15000 });
  console.log('Connected to server');

  // Fill form and create room
  await page.fill('input[placeholder="Enter your name"]', 'TestPlayer');
  await page.fill('input[placeholder="Enter room name"]', 'TestRoom');
  await page.click('button:has-text("Create Room")');

  // Wait for lobby
  await page.waitForSelector('button:has-text("Ready Up")', { timeout: 15000 });
  console.log('In lobby');

  // Add 2 AI players
  await page.click('button:has-text("Add AI")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Add AI")');
  await page.waitForTimeout(500);
  console.log('Added 2 AI players');

  // Wait for UI to settle
  await page.waitForTimeout(1000);

  // Screenshot 1: Before Ready Up
  await page.screenshot({ path: 'tests/screenshots/1-before-ready.png', fullPage: true });
  console.log('Screenshot 1: Before Ready Up');

  // Get dimensions of key elements
  const lobbyBefore = await page.locator('.max-w-lg').first().boundingBox();
  const readyBtnBefore = await page.locator('button:has-text("Ready Up")').boundingBox();
  const startBtnBefore = await page.locator('button:has-text("Start Game")').boundingBox();

  console.log('BEFORE Ready Up:');
  console.log('  Lobby:', lobbyBefore);
  console.log('  Ready Button:', readyBtnBefore);
  console.log('  Start Button:', startBtnBefore);

  // Click Ready Up
  await page.click('button:has-text("Ready Up")');
  await page.waitForSelector('button:has-text("Cancel Ready")', { timeout: 5000 });
  await page.waitForTimeout(500);

  // Screenshot 2: After Ready Up
  await page.screenshot({ path: 'tests/screenshots/2-after-ready.png', fullPage: true });
  console.log('Screenshot 2: After Ready Up');

  // Get dimensions after
  const lobbyAfter = await page.locator('.max-w-lg').first().boundingBox();
  const cancelBtnAfter = await page.locator('button:has-text("Cancel Ready")').boundingBox();
  const startBtnAfter = await page.locator('button:has-text("Start Game")').boundingBox();

  console.log('AFTER Ready Up:');
  console.log('  Lobby:', lobbyAfter);
  console.log('  Cancel Button:', cancelBtnAfter);
  console.log('  Start Button:', startBtnAfter);

  // Compare and log differences
  if (lobbyBefore && lobbyAfter) {
    console.log('\nDIFFERENCES:');
    console.log(`  Lobby height: ${lobbyBefore.height} -> ${lobbyAfter.height} (diff: ${lobbyAfter.height - lobbyBefore.height})`);
    console.log(`  Lobby y: ${lobbyBefore.y} -> ${lobbyAfter.y} (diff: ${lobbyAfter.y - lobbyBefore.y})`);
  }
  if (readyBtnBefore && cancelBtnAfter) {
    console.log(`  Button width: ${readyBtnBefore.width} -> ${cancelBtnAfter.width} (diff: ${cancelBtnAfter.width - readyBtnBefore.width})`);
    console.log(`  Button height: ${readyBtnBefore.height} -> ${cancelBtnAfter.height} (diff: ${cancelBtnAfter.height - readyBtnBefore.height})`);
    console.log(`  Button y: ${readyBtnBefore.y} -> ${cancelBtnAfter.y} (diff: ${cancelBtnAfter.y - readyBtnBefore.y})`);
  }
  if (startBtnBefore && startBtnAfter) {
    console.log(`  Start btn y: ${startBtnBefore.y} -> ${startBtnAfter.y} (diff: ${startBtnAfter.y - startBtnBefore.y})`);
  }

  // Click Cancel Ready
  await page.click('button:has-text("Cancel Ready")');
  await page.waitForSelector('button:has-text("Ready Up")', { timeout: 5000 });
  await page.waitForTimeout(500);

  // Screenshot 3: After Cancel
  await page.screenshot({ path: 'tests/screenshots/3-after-cancel.png', fullPage: true });
  console.log('Screenshot 3: After Cancel Ready');

  const lobbyFinal = await page.locator('.max-w-lg').first().boundingBox();
  console.log('\nFINAL (after cancel):');
  console.log('  Lobby:', lobbyFinal);

  if (lobbyBefore && lobbyFinal) {
    console.log(`  Lobby height diff from start: ${lobbyFinal.height - lobbyBefore.height}`);
  }
});
