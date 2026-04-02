'use client'

import * as React from 'react'

type ToastVariant = 'default' | 'destructive'

export type Toast = {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
}

type ToastAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string }

type ToastState = { toasts: Toast[] }

const listeners: Array<(state: ToastState) => void> = []
let memoryState: ToastState = { toasts: [] }

function dispatch(action: ToastAction) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((l) => l(memoryState))
}

function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      return { toasts: [action.toast, ...state.toasts].slice(0, 3) }
    case 'REMOVE':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) }
  }
}

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return String(count)
}

export function toast(props: Omit<Toast, 'id'>) {
  const id = genId()
  dispatch({ type: 'ADD', toast: { id, ...props } })
  setTimeout(() => dispatch({ type: 'REMOVE', id }), 4000)
  return id
}

export function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const idx = listeners.indexOf(setState)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return { toasts: state.toasts, toast, dismiss: (id: string) => dispatch({ type: 'REMOVE', id }) }
}
