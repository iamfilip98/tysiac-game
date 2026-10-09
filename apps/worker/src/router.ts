import { json } from './http';

export async function route(_request: Request, _env: Env): Promise<Response> {
  return json({ error: 'Not found' }, 404);
}
