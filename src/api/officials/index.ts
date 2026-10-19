/**
 * Transparência: o que quem foi eleito está votando e propondo. Cabeçalho
 * completo (fontes, regra editorial, cache) em shared.ts.
 */
export * from '@/api/officials/bills';
export * from '@/api/officials/consultations';
export * from '@/api/officials/local';
export * from '@/api/officials/people';
export { MANDATE, type House, type Vote, type VoteStep, type Ballot, type Official, type Bill, type BillOutcome, classifyStatus, outcomeOf } from '@/api/officials/shared';
export * from '@/api/officials/votes';
