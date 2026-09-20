import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function prepareStudioNext(input, directory) {
  if (!input || !directory) throw new Error('Usage: gavel prepare-studio-next <contract.py> <new-directory>');
  let source;
  try { source = await readFile(input, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Contract file not found: ${input}`);
    if (error.code === 'EACCES') throw new Error(`Cannot read contract file: ${input}`);
    throw error;
  }
  const pin = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }';
  source = source.replace(/\r\n/g, '\n');
  if (source.startsWith('# v0.2.0\n')) source = source.slice(9);
  if (!source.startsWith(pin + '\n')) throw new Error('Requires a Gavel contract with the supported pinned runner; custom runners need their own deployment workflow.');
  const root = resolve(directory);
  try { await mkdir(root); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Deployment directory already exists: ${directory}. Choose a new directory to preserve transaction records.`);
    throw error;
  }
  await mkdir(resolve(root, 'deploy'));
  await writeFile(resolve(root, 'contract.py'), '# v0.2.0\n' + source);
  await writeFile(resolve(root, 'package.json'), '{"private":true,"type":"module"}\n');
  await writeFile(resolve(root, 'deploy/001_deploy.js'), await readFile(new URL('./studio-next-template.js', import.meta.url)));
  return { directory: root, chainId: 61997, deployed: false, commands: ['npx --yes genlayer@0.40.0-rc.3 network set studio-dev', 'npx --yes genlayer@0.40.0-rc.3 deploy'] };
}
