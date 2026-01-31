import { test, expect } from '@playwright/test';

test.describe('Room Lobby layout stability', () => {
  test.skip('Ready Up button and layout remain stable when toggling ready state', async ({ page }) => {
    // This test requires a working WebSocket connection to the server
    await page.goto('/');

    // Wait for page to load and socket to connect
    await page.waitForSelector('text=Create Room');
    await page.waitForSelector('text=Connected', { timeout: 10000 });

    // Fill in the create room form
    await page.fill('input[placeholder="Enter your name"]', 'TestPlayer');
    await page.fill('input[placeholder="Enter room name"]', 'TestRoom');

    // Click Create Room and wait for navigation
    await page.click('button:has-text("Create Room")');

    // Wait for the lobby to appear (look for Ready Up button)
    await page.waitForSelector('button:has-text("Ready Up")', { timeout: 15000 });

    // Take screenshot before clicking Ready Up
    await page.screenshot({ path: 'tests/screenshots/lobby-not-ready.png' });

    // Get the lobby container dimensions
    const lobbyContainer = page.locator('.max-w-lg').first();
    const beforeBox = await lobbyContainer.boundingBox();
    console.log('Before Ready - Lobby dimensions:', beforeBox);

    // Get the Ready Up button dimensions
    const readyButton = page.locator('button:has-text("Ready Up")');
    const buttonBeforeBox = await readyButton.boundingBox();
    console.log('Before Ready - Button dimensions:', buttonBeforeBox);

    // Click Ready Up
    await readyButton.click();

    // Wait for the button text to change
    await page.waitForSelector('button:has-text("Cancel Ready")', { timeout: 5000 });
    await page.waitForTimeout(300); // Wait for any animations

    // Take screenshot after clicking Ready Up
    await page.screenshot({ path: 'tests/screenshots/lobby-ready.png' });

    // Get dimensions after
    const afterBox = await lobbyContainer.boundingBox();
    console.log('After Ready - Lobby dimensions:', afterBox);

    const cancelButton = page.locator('button:has-text("Cancel Ready")');
    const buttonAfterBox = await cancelButton.boundingBox();
    console.log('After Ready - Button dimensions:', buttonAfterBox);

    // Verify lobby container dimensions are stable
    expect(beforeBox).not.toBeNull();
    expect(afterBox).not.toBeNull();

    if (beforeBox && afterBox) {
      // Width should be identical
      expect(afterBox.width).toBe(beforeBox.width);

      // Height should be identical or very close (within 2px for any animation artifacts)
      expect(Math.abs(afterBox.height - beforeBox.height)).toBeLessThanOrEqual(2);

      // Position should be identical
      expect(afterBox.x).toBe(beforeBox.x);
      expect(Math.abs(afterBox.y - beforeBox.y)).toBeLessThanOrEqual(2);

      console.log(`Lobby Width - Before: ${beforeBox.width}px, After: ${afterBox.width}px`);
      console.log(`Lobby Height - Before: ${beforeBox.height}px, After: ${afterBox.height}px`);
    }

    // Verify button dimensions are stable
    expect(buttonBeforeBox).not.toBeNull();
    expect(buttonAfterBox).not.toBeNull();

    if (buttonBeforeBox && buttonAfterBox) {
      // Button width should be identical
      expect(buttonAfterBox.width).toBe(buttonBeforeBox.width);

      // Button height should be identical
      expect(Math.abs(buttonAfterBox.height - buttonBeforeBox.height)).toBeLessThanOrEqual(1);

      // Button position should be identical
      expect(buttonAfterBox.x).toBe(buttonBeforeBox.x);
      expect(Math.abs(buttonAfterBox.y - buttonBeforeBox.y)).toBeLessThanOrEqual(2);

      console.log(`Button Width - Before: ${buttonBeforeBox.width}px, After: ${buttonAfterBox.width}px`);
      console.log(`Button Height - Before: ${buttonBeforeBox.height}px, After: ${buttonAfterBox.height}px`);
      console.log(`Button Position - Before: (${buttonBeforeBox.x}, ${buttonBeforeBox.y}), After: (${buttonAfterBox.x}, ${buttonAfterBox.y})`);
    }
  });
});
