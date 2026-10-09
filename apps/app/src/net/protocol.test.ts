import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION as packageVersion } from '@tysiac/protocol';
import { PROTOCOL_VERSION } from './protocol';

describe('protocol shim', () => {
  it('uses the same protocol version as @tysiac/protocol', () => {
    expect(PROTOCOL_VERSION).toBe(packageVersion);
  });
});
