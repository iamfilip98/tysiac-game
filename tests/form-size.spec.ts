import { test, expect } from '@playwright/test';

test.describe('Form size consistency', () => {
  test('Create Room and Join Room forms have identical container dimensions', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to fully load
    await page.waitForSelector('text=Create Room');

    // Get the form container (w-full max-w-sm)
    const formContainer = page.locator('.max-w-sm').first();

    // Click "Create Room" tab and measure
    await page.click('button:has-text("Create Room")');
    await page.waitForTimeout(500); // Wait for animation

    const createRoomBox = await formContainer.boundingBox();
    console.log('Create Room dimensions:', createRoomBox);

    // Take screenshot of Create Room form
    await page.screenshot({ path: 'tests/screenshots/create-room.png', fullPage: false });

    // Click "Join Room" tab and measure
    await page.click('button:has-text("Join Room")');
    await page.waitForTimeout(500); // Wait for animation

    const joinRoomBox = await formContainer.boundingBox();
    console.log('Join Room dimensions:', joinRoomBox);

    // Take screenshot of Join Room form
    await page.screenshot({ path: 'tests/screenshots/join-room.png', fullPage: false });

    // Verify dimensions are the same
    expect(createRoomBox).not.toBeNull();
    expect(joinRoomBox).not.toBeNull();

    if (createRoomBox && joinRoomBox) {
      // Width should be identical
      expect(joinRoomBox.width).toBe(createRoomBox.width);

      // Height should be identical (or very close due to potential rounding)
      expect(Math.abs(joinRoomBox.height - createRoomBox.height)).toBeLessThanOrEqual(1);

      // Position (x, y) should be identical
      expect(joinRoomBox.x).toBe(createRoomBox.x);
      expect(Math.abs(joinRoomBox.y - createRoomBox.y)).toBeLessThanOrEqual(1);

      console.log(`Width - Create: ${createRoomBox.width}px, Join: ${joinRoomBox.width}px`);
      console.log(`Height - Create: ${createRoomBox.height}px, Join: ${joinRoomBox.height}px`);
      console.log(`Position - Create: (${createRoomBox.x}, ${createRoomBox.y}), Join: (${joinRoomBox.x}, ${joinRoomBox.y})`);
    }
  });
});
