import { test, expect } from './helpers/test-fixtures';
import { GameClient, delay } from './helpers/game-client';

test.describe('Lobby - Room creation and joining', () => {
  test('host can create a room and receive room:created', async ({ host }) => {
    const room = await host.createRoom('My Room');
    expect(room.code).toHaveLength(6);
    expect(room.name).toBe('My Room');
    expect(host.playerId).toBeTruthy();
    expect(host.sessionToken).toBeTruthy();
    expect(room.players).toHaveLength(1);
    expect(room.players[0].isHost).toBe(true);
  });

  test('player can join a room with valid code', async ({ host, player2 }) => {
    await host.createRoom();
    const room = await player2.joinRoom(host.roomCode);
    expect(room.players).toHaveLength(2);
    expect(player2.playerId).toBeTruthy();
    expect(player2.sessionToken).toBeTruthy();
  });

  test('joining with invalid code returns error', async ({ player2 }) => {
    await expect(player2.joinRoom('ZZZZZZ')).rejects.toThrow();
    expect(player2.lastError).toBeTruthy();
  });

  test('room updates broadcast to all players', async ({ host, player2, player3 }) => {
    await host.createRoom();
    const updatePromise = host.waitForRoomUpdate();
    await player2.joinRoom(host.roomCode);
    const updatedRoom = await updatePromise;
    expect(updatedRoom.players).toHaveLength(2);

    const updatePromise2 = host.waitForRoomUpdate();
    await player3.joinRoom(host.roomCode);
    const updatedRoom2 = await updatePromise2;
    expect(updatedRoom2.players).toHaveLength(3);
  });

  test('players can ready up', async ({ host, player2, player3 }) => {
    await host.createRoom();
    await player2.joinRoom(host.roomCode);
    await player3.joinRoom(host.roomCode);
    await delay(200);

    host.ready();
    await delay(300);
    // Wait for room update that shows ready state
    let room = host.room;
    expect(room).toBeTruthy();

    player2.ready();
    player3.ready();
    await delay(500);
  });

  test('host can add AI player', async ({ host }) => {
    await host.createRoom();
    const updatePromise = host.waitForRoomUpdate();
    host.addAI();
    const room = await updatePromise;
    const aiPlayer = room.players.find(p => p.isAI);
    expect(aiPlayer).toBeTruthy();
    expect(aiPlayer!.isAI).toBe(true);
    expect(room.players).toHaveLength(2);
  });

  test('host can remove AI player', async ({ host }) => {
    await host.createRoom();
    const addPromise = host.waitForRoomUpdate();
    host.addAI();
    const roomWithAI = await addPromise;
    const aiPlayer = roomWithAI.players.find(p => p.isAI);
    expect(aiPlayer).toBeTruthy();

    const removePromise = host.waitForRoomUpdate();
    host.removeAI(aiPlayer!.id);
    const roomWithoutAI = await removePromise;
    expect(roomWithoutAI.players).toHaveLength(1);
  });

  test('host can start game when all players ready', async ({ host, player2, player3 }) => {
    await host.createRoom();
    await player2.joinRoom(host.roomCode);
    await player3.joinRoom(host.roomCode);
    await delay(300);

    host.ready();
    player2.ready();
    player3.ready();
    await delay(500);

    const gamePromise = Promise.all([
      host.waitForEvent('game:started'),
      player2.waitForEvent('game:started'),
      player3.waitForEvent('game:started'),
    ]);

    host.startGame();
    const [hostState, p2State, p3State] = await gamePromise;

    expect(hostState.phase).toBeTruthy();
    expect(p2State.phase).toBeTruthy();
    expect(p3State.phase).toBeTruthy();
  });

  test('game with 2 humans + 1 AI can start', async ({ host, player2 }) => {
    await host.createRoom();
    await player2.joinRoom(host.roomCode);
    await delay(200);

    host.addAI();
    await delay(300);

    host.ready();
    player2.ready();
    await delay(500);

    const gamePromise = Promise.all([
      host.waitForEvent('game:started'),
      player2.waitForEvent('game:started'),
    ]);

    host.startGame();
    const [hostState, p2State] = await gamePromise;
    expect(hostState.phase).toBeTruthy();
    expect(p2State.phase).toBeTruthy();
  });
});

test.describe('Lobby - Browser UI', () => {
  test('create room form works in browser', async ({ hostPage }) => {
    await hostPage.goto('/');
    await hostPage.waitForLoadState('networkidle');

    // Should see the landing page
    await expect(hostPage.locator('h1')).toContainText('Tysi');

    // Click "Create Room" tab
    const createTab = hostPage.getByRole('button', { name: /create room/i }).first();
    await createTab.click();

    // Fill in the form
    await hostPage.fill('#playerName', 'TestHost');
    await hostPage.fill('#roomName', 'Test Room');

    // The form submit button (inside the form, not the tab button)
    const createBtn = hostPage.locator('form').getByRole('button', { name: /create room/i });
    await expect(createBtn).toBeVisible();
  });

  test('join room form validates code length', async ({ hostPage }) => {
    await hostPage.goto('/');
    await hostPage.waitForLoadState('networkidle');

    // Click "Join Room" tab
    const joinTab = hostPage.getByRole('button', { name: /join room/i }).first();
    await joinTab.click();

    await hostPage.fill('#joinPlayerName', 'TestJoiner');
    await hostPage.fill('#roomCode', 'ABC'); // too short

    // The form submit button (inside the form, not the tab button)
    const joinBtn = hostPage.locator('form').getByRole('button', { name: /join room/i });
    await expect(joinBtn).toBeDisabled();

    // Fill valid code length
    await hostPage.fill('#roomCode', 'ABCDEF');
    await expect(joinBtn).toBeEnabled();
  });
});
