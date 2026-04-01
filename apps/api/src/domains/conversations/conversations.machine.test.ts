import { describe, it, expect } from 'vitest'
import { transition, ConversationStep } from './conversations.machine.js'
import type { NormalizedInput, MachineContext } from './conversations.machine.js'

const ctx: MachineContext = { retryCount: 0, guestLanguage: 'es' }
const ctxRetry3: MachineContext = { retryCount: 3, guestLanguage: 'es' }

const YES: NormalizedInput = { intent: 'YES' }
const NO: NormalizedInput = { intent: 'NO' }
const STOP: NormalizedInput = { intent: 'STOP' }
const FREE: NormalizedInput = { intent: 'FREE_TEXT', raw: 'algo random' }
const NUM3: NormalizedInput = { intent: 'NUMBER', value: 3 }

// Helpers to check actions by type
function hasAction(actions: ReturnType<typeof transition>['actions'], type: string) {
  return actions.some((a) => a.type === type)
}

function getAction<T extends ReturnType<typeof transition>['actions'][number]>(
  actions: ReturnType<typeof transition>['actions'],
  type: string,
): T | undefined {
  return actions.find((a) => a.type === type) as T | undefined
}

describe('PENDING state', () => {
  it('PENDING + YES → stays PENDING with no actions', () => {
    const result = transition(ConversationStep.PENDING, YES, ctx)
    expect(result.nextState).toBe(ConversationStep.PENDING)
    expect(result.actions).toHaveLength(0)
  })

  it('PENDING + NO → stays PENDING with no actions', () => {
    const result = transition(ConversationStep.PENDING, NO, ctx)
    expect(result.nextState).toBe(ConversationStep.PENDING)
    expect(result.actions).toHaveLength(0)
  })
})

describe('INITIAL_SENT state', () => {
  it('INITIAL_SENT + YES → AWAITING_ATTENDANCE, actions include SEND_MESSAGE(ask_attendance)', () => {
    const result = transition(ConversationStep.INITIAL_SENT, YES, ctx)
    expect(result.nextState).toBe(ConversationStep.AWAITING_ATTENDANCE)
    expect(hasAction(result.actions, 'SEND_MESSAGE')).toBe(true)
    const msg = getAction<{ type: 'SEND_MESSAGE'; templateKey: string }>(result.actions, 'SEND_MESSAGE')
    expect(msg?.templateKey).toBe('ask_attendance')
  })

  it('INITIAL_SENT + NO → OPT_OUT, actions include MARK_OPT_OUT and SEND_MESSAGE(opt_out_confirmed)', () => {
    const result = transition(ConversationStep.INITIAL_SENT, NO, ctx)
    expect(result.nextState).toBe(ConversationStep.OPT_OUT)
    expect(hasAction(result.actions, 'MARK_OPT_OUT')).toBe(true)
    const msg = getAction<{ type: 'SEND_MESSAGE'; templateKey: string }>(result.actions, 'SEND_MESSAGE')
    expect(msg?.templateKey).toBe('opt_out_confirmed')
  })

  it('INITIAL_SENT + STOP → OPT_OUT, actions include MARK_OPT_OUT', () => {
    const result = transition(ConversationStep.INITIAL_SENT, STOP, ctx)
    expect(result.nextState).toBe(ConversationStep.OPT_OUT)
    expect(hasAction(result.actions, 'MARK_OPT_OUT')).toBe(true)
  })

  it('INITIAL_SENT + FREE_TEXT (retryCount=0) → INITIAL_SENT, actions include INCREMENT_RETRY and SEND_CLARIFICATION', () => {
    const result = transition(ConversationStep.INITIAL_SENT, FREE, ctx)
    expect(result.nextState).toBe(ConversationStep.INITIAL_SENT)
    expect(hasAction(result.actions, 'INCREMENT_RETRY')).toBe(true)
    expect(hasAction(result.actions, 'SEND_CLARIFICATION')).toBe(true)
  })

  it('INITIAL_SENT + FREE_TEXT (retryCount=3) → UNREACHABLE, actions include MARK_UNREACHABLE', () => {
    const result = transition(ConversationStep.INITIAL_SENT, FREE, ctxRetry3)
    expect(result.nextState).toBe(ConversationStep.UNREACHABLE)
    expect(hasAction(result.actions, 'MARK_UNREACHABLE')).toBe(true)
  })

  it('INITIAL_SENT + NUMBER (retryCount=0) → INITIAL_SENT, actions include INCREMENT_RETRY', () => {
    const result = transition(ConversationStep.INITIAL_SENT, NUM3, ctx)
    expect(result.nextState).toBe(ConversationStep.INITIAL_SENT)
    expect(hasAction(result.actions, 'INCREMENT_RETRY')).toBe(true)
  })
})

describe('AWAITING_ATTENDANCE state', () => {
  it('AWAITING_ATTENDANCE + YES → AWAITING_COMPANIONS, actions include SAVE_ATTENDANCE(true) and SEND_MESSAGE(ask_companions)', () => {
    const result = transition(ConversationStep.AWAITING_ATTENDANCE, YES, ctx)
    expect(result.nextState).toBe(ConversationStep.AWAITING_COMPANIONS)
    const save = getAction<{ type: 'SAVE_ATTENDANCE'; attending: boolean }>(result.actions, 'SAVE_ATTENDANCE')
    expect(save?.attending).toBe(true)
    const msg = getAction<{ type: 'SEND_MESSAGE'; templateKey: string }>(result.actions, 'SEND_MESSAGE')
    expect(msg?.templateKey).toBe('ask_companions')
  })

  it('AWAITING_ATTENDANCE + NO → COMPLETE, actions include SAVE_ATTENDANCE(false), SEND_MESSAGE(confirmed_not_attending), MARK_COMPLETE', () => {
    const result = transition(ConversationStep.AWAITING_ATTENDANCE, NO, ctx)
    expect(result.nextState).toBe(ConversationStep.COMPLETE)
    const save = getAction<{ type: 'SAVE_ATTENDANCE'; attending: boolean }>(result.actions, 'SAVE_ATTENDANCE')
    expect(save?.attending).toBe(false)
    expect(hasAction(result.actions, 'MARK_COMPLETE')).toBe(true)
    const msg = getAction<{ type: 'SEND_MESSAGE'; templateKey: string }>(result.actions, 'SEND_MESSAGE')
    expect(msg?.templateKey).toBe('confirmed_not_attending')
  })

  it('AWAITING_ATTENDANCE + STOP → OPT_OUT, actions include MARK_OPT_OUT', () => {
    const result = transition(ConversationStep.AWAITING_ATTENDANCE, STOP, ctx)
    expect(result.nextState).toBe(ConversationStep.OPT_OUT)
    expect(hasAction(result.actions, 'MARK_OPT_OUT')).toBe(true)
  })

  it('AWAITING_ATTENDANCE + FREE_TEXT (retryCount=0) → AWAITING_ATTENDANCE, actions include INCREMENT_RETRY and SEND_CLARIFICATION', () => {
    const result = transition(ConversationStep.AWAITING_ATTENDANCE, FREE, ctx)
    expect(result.nextState).toBe(ConversationStep.AWAITING_ATTENDANCE)
    expect(hasAction(result.actions, 'INCREMENT_RETRY')).toBe(true)
    expect(hasAction(result.actions, 'SEND_CLARIFICATION')).toBe(true)
  })

  it('AWAITING_ATTENDANCE + FREE_TEXT (retryCount=3) → AWAITING_COMPANIONS (forgiving advance)', () => {
    const result = transition(ConversationStep.AWAITING_ATTENDANCE, FREE, ctxRetry3)
    expect(result.nextState).toBe(ConversationStep.AWAITING_COMPANIONS)
    const msg = getAction<{ type: 'SEND_MESSAGE'; templateKey: string }>(result.actions, 'SEND_MESSAGE')
    expect(msg?.templateKey).toBe('ask_companions')
  })
})

describe('AWAITING_COMPANIONS state', () => {
  it('AWAITING_COMPANIONS + NUMBER(3) → AWAITING_DIETARY, actions include SAVE_COMPANIONS(3) and SEND_MESSAGE(ask_dietary)', () => {
    const result = transition(ConversationStep.AWAITING_COMPANIONS, NUM3, ctx)
    expect(result.nextState).toBe(ConversationStep.AWAITING_DIETARY)
    const save = getAction<{ type: 'SAVE_COMPANIONS'; count: number }>(result.actions, 'SAVE_COMPANIONS')
    expect(save?.count).toBe(3)
    const msg = getAction<{ type: 'SEND_MESSAGE'; templateKey: string }>(result.actions, 'SEND_MESSAGE')
    expect(msg?.templateKey).toBe('ask_dietary')
  })

  it('AWAITING_COMPANIONS + STOP → OPT_OUT, actions include MARK_OPT_OUT', () => {
    const result = transition(ConversationStep.AWAITING_COMPANIONS, STOP, ctx)
    expect(result.nextState).toBe(ConversationStep.OPT_OUT)
    expect(hasAction(result.actions, 'MARK_OPT_OUT')).toBe(true)
  })

  it('AWAITING_COMPANIONS + FREE_TEXT (retryCount=0) → AWAITING_COMPANIONS, actions include INCREMENT_RETRY and SEND_CLARIFICATION', () => {
    const result = transition(ConversationStep.AWAITING_COMPANIONS, FREE, ctx)
    expect(result.nextState).toBe(ConversationStep.AWAITING_COMPANIONS)
    expect(hasAction(result.actions, 'INCREMENT_RETRY')).toBe(true)
    expect(hasAction(result.actions, 'SEND_CLARIFICATION')).toBe(true)
  })

  it('AWAITING_COMPANIONS + FREE_TEXT (retryCount=3) → AWAITING_DIETARY (forgiving advance)', () => {
    const result = transition(ConversationStep.AWAITING_COMPANIONS, FREE, ctxRetry3)
    expect(result.nextState).toBe(ConversationStep.AWAITING_DIETARY)
    const msg = getAction<{ type: 'SEND_MESSAGE'; templateKey: string }>(result.actions, 'SEND_MESSAGE')
    expect(msg?.templateKey).toBe('ask_dietary')
  })

  it('AWAITING_COMPANIONS + YES → AWAITING_COMPANIONS, actions include INCREMENT_RETRY (YES not valid here)', () => {
    const result = transition(ConversationStep.AWAITING_COMPANIONS, YES, ctx)
    expect(result.nextState).toBe(ConversationStep.AWAITING_COMPANIONS)
    expect(hasAction(result.actions, 'INCREMENT_RETRY')).toBe(true)
  })
})

describe('AWAITING_DIETARY state', () => {
  it('AWAITING_DIETARY + FREE_TEXT("sin gluten") → COMPLETE, actions include SAVE_DIETARY("sin gluten") and MARK_COMPLETE', () => {
    const dietary: NormalizedInput = { intent: 'FREE_TEXT', raw: 'sin gluten' }
    const result = transition(ConversationStep.AWAITING_DIETARY, dietary, ctx)
    expect(result.nextState).toBe(ConversationStep.COMPLETE)
    const save = getAction<{ type: 'SAVE_DIETARY'; notes: string }>(result.actions, 'SAVE_DIETARY')
    expect(save?.notes).toBe('sin gluten')
    expect(hasAction(result.actions, 'MARK_COMPLETE')).toBe(true)
    const msg = getAction<{ type: 'SEND_MESSAGE'; templateKey: string }>(result.actions, 'SEND_MESSAGE')
    expect(msg?.templateKey).toBe('confirmed')
  })

  it('AWAITING_DIETARY + YES → COMPLETE, SAVE_DIETARY("")', () => {
    const result = transition(ConversationStep.AWAITING_DIETARY, YES, ctx)
    expect(result.nextState).toBe(ConversationStep.COMPLETE)
    const save = getAction<{ type: 'SAVE_DIETARY'; notes: string }>(result.actions, 'SAVE_DIETARY')
    expect(save?.notes).toBe('')
  })

  it('AWAITING_DIETARY + NO → COMPLETE, SAVE_DIETARY("")', () => {
    const result = transition(ConversationStep.AWAITING_DIETARY, NO, ctx)
    expect(result.nextState).toBe(ConversationStep.COMPLETE)
    const save = getAction<{ type: 'SAVE_DIETARY'; notes: string }>(result.actions, 'SAVE_DIETARY')
    expect(save?.notes).toBe('')
  })

  it('AWAITING_DIETARY + NUMBER(5) → COMPLETE, SAVE_DIETARY("5")', () => {
    const num: NormalizedInput = { intent: 'NUMBER', value: 5 }
    const result = transition(ConversationStep.AWAITING_DIETARY, num, ctx)
    expect(result.nextState).toBe(ConversationStep.COMPLETE)
    const save = getAction<{ type: 'SAVE_DIETARY'; notes: string }>(result.actions, 'SAVE_DIETARY')
    expect(save?.notes).toBe('5')
  })

  it('AWAITING_DIETARY + STOP → OPT_OUT', () => {
    const result = transition(ConversationStep.AWAITING_DIETARY, STOP, ctx)
    expect(result.nextState).toBe(ConversationStep.OPT_OUT)
    expect(hasAction(result.actions, 'MARK_OPT_OUT')).toBe(true)
  })
})

describe('Terminal states', () => {
  it('COMPLETE + YES → COMPLETE (terminal, no actions)', () => {
    const result = transition(ConversationStep.COMPLETE, YES, ctx)
    expect(result.nextState).toBe(ConversationStep.COMPLETE)
    expect(result.actions).toHaveLength(0)
  })

  it('COMPLETE + NO → COMPLETE (terminal, no actions)', () => {
    const result = transition(ConversationStep.COMPLETE, NO, ctx)
    expect(result.nextState).toBe(ConversationStep.COMPLETE)
    expect(result.actions).toHaveLength(0)
  })

  it('OPT_OUT + YES → OPT_OUT (terminal, no actions)', () => {
    const result = transition(ConversationStep.OPT_OUT, YES, ctx)
    expect(result.nextState).toBe(ConversationStep.OPT_OUT)
    expect(result.actions).toHaveLength(0)
  })

  it('OPT_OUT + STOP → OPT_OUT (terminal, no actions)', () => {
    const result = transition(ConversationStep.OPT_OUT, STOP, ctx)
    expect(result.nextState).toBe(ConversationStep.OPT_OUT)
    expect(result.actions).toHaveLength(0)
  })

  it('UNREACHABLE + YES → UNREACHABLE (terminal, no actions)', () => {
    const result = transition(ConversationStep.UNREACHABLE, YES, ctx)
    expect(result.nextState).toBe(ConversationStep.UNREACHABLE)
    expect(result.actions).toHaveLength(0)
  })
})
