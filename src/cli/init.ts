import { earthquakeDemoContract } from '../recipes.ts';
/** Data only: filesystem writing is confined to the CLI executable. */
export function projectTemplate() {
  const artifact = earthquakeDemoContract();
  const plan = artifact.compiledSpec;
  return { spec: plan, shape: plan.shape, features: plan.features, evidence: plan.evidence,
    minimumConfidenceBps: plan.minimumConfidenceBps, confidenceToleranceBps: plan.confidenceToleranceBps };
}
