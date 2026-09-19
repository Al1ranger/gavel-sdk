import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareStudioNext } from '../bin/studio-next.mjs';

test('Studio Next preparation pins runtime, refuses overwrite and rejects unknown runners', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gavel-next-'));
  try {
    const source = join(root, 'source.py');
    await writeFile(source, '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }\n\nfrom genlayer import *\n');
    const destination = join(root, 'deployment');
    const result = await prepareStudioNext(source, destination);
    assert.equal(result.chainId, 61997);
    assert.equal(result.deployed, false);
    assert.ok((await readFile(join(destination, 'contract.py'), 'utf8')).startsWith('# v0.2.0\n'));
    await assert.rejects(prepareStudioNext(source, destination));
    await writeFile(source, '# { "Depends": "py-genlayer:latest" }\n');
    await assert.rejects(prepareStudioNext(source, join(root, 'invalid')), /supported pinned runner/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
