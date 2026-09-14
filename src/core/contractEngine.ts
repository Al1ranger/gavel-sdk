import { generateIntelligentContract, type GenerateInput } from '../generate.ts';
import { hashJSON } from '../evidence/normalizer.ts';
import { requireThat } from '../api/types.ts';

export type ContractPlanner = (prompt: string, signal: AbortSignal) => Promise<unknown>;
export type ContractDraft = { status: 'REVIEW_REQUIRED'; plan: GenerateInput; planHash: string; warnings: string[] };
/** Model-assisted draft compiler. A short prompt cannot specify financial settlement safely. */
export class ContractEngine {
  constructor(private readonly planner?: ContractPlanner) {}
  async generateContract(input: { prompt: string }): Promise<ContractDraft> {
    requireThat(this.planner, 'PLANNER_REQUIRED', 'Configure a model adapter to compile natural language.');
    requireThat(typeof input.prompt === 'string' && input.prompt.length >= 10 && input.prompt.length <= 10000, 'PROMPT_LENGTH', 'Prompt must contain 10-10000 characters.');
    const plan = await this.planner(input.prompt, AbortSignal.timeout(30000)) as GenerateInput;
    // Reuse the real generator to reject missing or malformed rules and sources.
    generateIntelligentContract(plan);
    const copy = structuredClone(plan);
    return { status: 'REVIEW_REQUIRED', plan: copy, planHash: hashJSON(copy), warnings: ['Review exact evidence URLs, event deadline, units, outcomes and settlement rules. Model output is not deployment approval.'] };
  }
  compile(draft: ContractDraft, approvedPlanHash: string) {
    requireThat(draft.status === 'REVIEW_REQUIRED' && draft.planHash === approvedPlanHash && hashJSON(draft.plan) === approvedPlanHash, 'PLAN_APPROVAL', 'Approve the exact unchanged plan hash before compilation.');
    return generateIntelligentContract(draft.plan);
  }
}
