import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { earthquakeDemoContract, weatherDemoContract, polymarketJournalContract, gavelDeliveryProofContract } from '../dist/index.js';

const destination = resolve(process.argv[2] ?? 'artifacts/oracles');
// 123 is a fixture identity, not a claim about a live market's existence/outcomes.
// Live users must discover and pin an exact market ID and ordered outcome labels.
const contracts = [earthquakeDemoContract(), weatherDemoContract(), polymarketJournalContract('123', ['Yes', 'No']), gavelDeliveryProofContract()];
await mkdir(destination, { recursive: true });
for (const contract of contracts) {
  await writeFile(resolve(destination, contract.filename), contract.source, { flag: 'wx' });
  await writeFile(resolve(destination, `${contract.filename}.json`), JSON.stringify(contract.compiledSpec, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ filename: contract.filename, className: contract.className, deployed: false }));
}
