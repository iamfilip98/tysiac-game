import { DurableObject } from 'cloudflare:workers';

export class Room extends DurableObject<Env> {}
