import { route } from './router';

export { Room } from './room/Room';

export default {
  fetch: (request, env) => route(request, env),
} satisfies ExportedHandler<Env>;
