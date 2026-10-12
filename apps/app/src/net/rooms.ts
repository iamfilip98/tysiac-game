import { getService } from './service';
import { getIdentity } from './identity';
import { usePrefs } from '../store/prefs';

/** Creates a room as this device's player and remembers it as the last room. Returns the room code. */
export async function createRoomAs(maxPlayers: 3 | 4, practice: boolean, coach = false): Promise<string> {
  const p = usePrefs.getState();
  const svc = await getService();
  const me = getIdentity();
  const res = await svc.createRoom({ maxPlayers, playerId: me.playerId, name: p.name, avatar: p.avatar });
  p.setLastRoom({ code: res.code, practice, at: Date.now(), ...(coach ? { coach: true } : {}) });
  return res.code;
}
