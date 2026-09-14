import { requireThat, integer } from '../api/types.ts';
import { validateJudge, JUDGE_ROLES, type JudgeContext, type JudgeRole } from './validator.ts';
import { evaluateConsensus, type ConsensusPolicy } from './consensus.ts';

export type JudgeAdapter = { id: string; operatorId: string; role: JudgeRole; evaluate: (context: JudgeContext, signal: AbortSignal) => Promise<unknown> };
export async function runJudgeNetwork(context: JudgeContext, judges: JudgeAdapter[], policy: Omit<ConsensusPolicy, 'eligibleJudgeIds'>, timeoutMs = 30000) {
  integer(timeoutMs, 1, 120000, 'timeoutMs');
  requireThat(judges.length >= 2 && judges.length <= 32 && new Set(judges.map(j => j.id)).size === judges.length && new Set(judges.map(j => j.operatorId)).size === judges.length && judges.every(j => j.operatorId && JUDGE_ROLES.includes(j.role)), 'JUDGE_INDEPENDENCE', 'Require 2-32 unique judges and operator identities. Operator claims need external authentication.');
  const results = await Promise.all(judges.map(async judge => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const output = await Promise.race([
        Promise.resolve().then(() => judge.evaluate(structuredClone(context), controller.signal)),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, timeoutMs); }),
      ]);
      return { id: judge.id, vote: validateJudge(output, judge.id, context), error: null };
    } catch { return { id: judge.id, vote: null, error: 'JUDGE_FAILED' }; }
    finally { clearTimeout(timer); }
  }));
  return { results, consensus: evaluateConsensus(results.flatMap(r => r.vote ? [r.vote] : []), { ...policy, eligibleJudgeIds: judges.map(j => j.id) }) };
}
