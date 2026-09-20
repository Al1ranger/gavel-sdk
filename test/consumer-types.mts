import * as root from 'gavel-judgment-sdk';
import * as clients from 'gavel-judgment-sdk/clients';
import * as contracts from 'gavel-judgment-sdk/contracts';
import * as platform from 'gavel-judgment-sdk/platform';
import * as markets from 'gavel-judgment-sdk/markets';
import * as evidence from 'gavel-judgment-sdk/evidence';
import * as api from 'gavel-judgment-sdk/api';
const generated: string = contracts.earthquakeDemoContract().source;
console.log(generated.length, root, clients, platform, markets, evidence, api);
