import type { NormalizedInput } from './message-normalizer.js'

export { type NormalizedInput } from './message-normalizer.js'

export enum ConversationStep {
  PENDING = 'PENDING',
  INITIAL_SENT = 'INITIAL_SENT',
  AWAITING_ATTENDANCE = 'AWAITING_ATTENDANCE',
  AWAITING_COMPANIONS = 'AWAITING_COMPANIONS',
  AWAITING_DIETARY = 'AWAITING_DIETARY',
  COMPLETE = 'COMPLETE',
  OPT_OUT = 'OPT_OUT',
  UNREACHABLE = 'UNREACHABLE',
}

export type TransitionAction =
  | { type: 'SEND_MESSAGE'; templateKey: string }
  | { type: 'SAVE_ATTENDANCE'; attending: boolean }
  | { type: 'SAVE_COMPANIONS'; count: number }
  | { type: 'SAVE_DIETARY'; notes: string }
  | { type: 'MARK_OPT_OUT' }
  | { type: 'MARK_COMPLETE' }
  | { type: 'MARK_UNREACHABLE' }
  | { type: 'SEND_CLARIFICATION'; reason: string }
  | { type: 'INCREMENT_RETRY' }

export type TransitionResult = {
  nextState: ConversationStep
  actions: TransitionAction[]
}

export type MachineContext = {
  retryCount: number
  guestLanguage: 'es' | 'en'
}

// ---------------------------------------------------------------------------
// Helper constructors to keep handlers readable
// ---------------------------------------------------------------------------

function sendMessage(templateKey: string): TransitionAction {
  return { type: 'SEND_MESSAGE', templateKey }
}

function sendClarification(reason: string): TransitionAction {
  return { type: 'SEND_CLARIFICATION', reason }
}

function stay(state: ConversationStep, actions: TransitionAction[]): TransitionResult {
  return { nextState: state, actions }
}

function go(state: ConversationStep, actions: TransitionAction[]): TransitionResult {
  return { nextState: state, actions }
}

// ---------------------------------------------------------------------------
// Shared opt-out handler used by multiple states
// ---------------------------------------------------------------------------

function handleStop(): TransitionResult {
  return go(ConversationStep.OPT_OUT, [{ type: 'MARK_OPT_OUT' }])
}

// ---------------------------------------------------------------------------
// State handlers
// ---------------------------------------------------------------------------

function handlePending(): TransitionResult {
  return stay(ConversationStep.PENDING, [])
}

function handleInitialSent(
  input: NormalizedInput,
  context: MachineContext,
): TransitionResult {
  if (input.intent === 'STOP') {
    return handleStop()
  }
  if (input.intent === 'NO') {
    return go(ConversationStep.OPT_OUT, [
      { type: 'MARK_OPT_OUT' },
      sendMessage('opt_out_confirmed'),
    ])
  }
  if (input.intent === 'YES') {
    return go(ConversationStep.AWAITING_ATTENDANCE, [sendMessage('ask_attendance')])
  }
  // Unrecognised input
  if (context.retryCount >= 3) {
    return go(ConversationStep.UNREACHABLE, [{ type: 'MARK_UNREACHABLE' }])
  }
  return stay(ConversationStep.INITIAL_SENT, [
    { type: 'INCREMENT_RETRY' },
    sendClarification('Please reply YES or NO'),
  ])
}

function handleAwaitingAttendance(
  input: NormalizedInput,
  context: MachineContext,
): TransitionResult {
  if (input.intent === 'STOP') {
    return handleStop()
  }
  if (input.intent === 'YES') {
    return go(ConversationStep.AWAITING_COMPANIONS, [
      { type: 'SAVE_ATTENDANCE', attending: true },
      sendMessage('ask_companions'),
    ])
  }
  if (input.intent === 'NO') {
    return go(ConversationStep.COMPLETE, [
      { type: 'SAVE_ATTENDANCE', attending: false },
      sendMessage('confirmed_not_attending'),
      { type: 'MARK_COMPLETE' },
    ])
  }
  // Unrecognised input
  if (context.retryCount >= 3) {
    return go(ConversationStep.AWAITING_COMPANIONS, [sendMessage('ask_companions')])
  }
  return stay(ConversationStep.AWAITING_ATTENDANCE, [
    { type: 'INCREMENT_RETRY' },
    sendClarification('Please reply YES or NO'),
  ])
}

function handleAwaitingCompanions(
  input: NormalizedInput,
  context: MachineContext,
): TransitionResult {
  if (input.intent === 'STOP') {
    return handleStop()
  }
  if (input.intent === 'NUMBER') {
    return go(ConversationStep.AWAITING_DIETARY, [
      { type: 'SAVE_COMPANIONS', count: input.value },
      sendMessage('ask_dietary'),
    ])
  }
  // Any non-number input is unrecognised here
  if (context.retryCount >= 3) {
    return go(ConversationStep.AWAITING_DIETARY, [sendMessage('ask_dietary')])
  }
  return stay(ConversationStep.AWAITING_COMPANIONS, [
    { type: 'INCREMENT_RETRY' },
    sendClarification('Please reply with a number'),
  ])
}

function handleAwaitingDietary(input: NormalizedInput): TransitionResult {
  if (input.intent === 'STOP') {
    return handleStop()
  }

  let notes: string
  if (input.intent === 'YES' || input.intent === 'NO') {
    notes = ''
  } else if (input.intent === 'NUMBER') {
    notes = String(input.value)
  } else {
    notes = input.raw
  }

  return go(ConversationStep.COMPLETE, [
    { type: 'SAVE_DIETARY', notes },
    { type: 'MARK_COMPLETE' },
    sendMessage('confirmed'),
  ])
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function transition(
  state: ConversationStep,
  input: NormalizedInput,
  context: MachineContext,
): TransitionResult {
  switch (state) {
    case ConversationStep.PENDING:
      return handlePending()

    case ConversationStep.INITIAL_SENT:
      return handleInitialSent(input, context)

    case ConversationStep.AWAITING_ATTENDANCE:
      return handleAwaitingAttendance(input, context)

    case ConversationStep.AWAITING_COMPANIONS:
      return handleAwaitingCompanions(input, context)

    case ConversationStep.AWAITING_DIETARY:
      return handleAwaitingDietary(input)

    // Terminal states
    case ConversationStep.COMPLETE:
    case ConversationStep.OPT_OUT:
    case ConversationStep.UNREACHABLE:
      return stay(state, [])
  }
}
