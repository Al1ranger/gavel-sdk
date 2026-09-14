import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('CLI provides discoverable commands and rejects unknown commands', () => {
  const help = spawnSync(process.execPath, ['bin/gavel.mjs', 'help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /generate/);
  assert.match(help.stdout, /transaction/);
  const invalid = spawnSync(process.execPath, ['bin/gavel.mjs', 'invalid'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stderr).command, 'invalid');
});
