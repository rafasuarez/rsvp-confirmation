import { describe, it, expect } from 'vitest'
import { normalizeMessage } from './message-normalizer.js'

describe('normalizeMessage', () => {
  // YES intent
  it("maps 'sí' to YES", () => {
    expect(normalizeMessage('sí')).toEqual({ intent: 'YES' })
  })

  it("maps 'si' to YES", () => {
    expect(normalizeMessage('si')).toEqual({ intent: 'YES' })
  })

  it("maps 'yes' to YES", () => {
    expect(normalizeMessage('yes')).toEqual({ intent: 'YES' })
  })

  it("maps 'Y' (uppercase) to YES", () => {
    expect(normalizeMessage('Y')).toEqual({ intent: 'YES' })
  })

  it("maps '1' to YES", () => {
    expect(normalizeMessage('1')).toEqual({ intent: 'YES' })
  })

  it("maps 'ok' to YES", () => {
    expect(normalizeMessage('ok')).toEqual({ intent: 'YES' })
  })

  it("maps 'claro' to YES", () => {
    expect(normalizeMessage('claro')).toEqual({ intent: 'YES' })
  })

  it("maps 'vale' to YES", () => {
    expect(normalizeMessage('vale')).toEqual({ intent: 'YES' })
  })

  it("maps 'confirmo' to YES", () => {
    expect(normalizeMessage('confirmo')).toEqual({ intent: 'YES' })
  })

  it("maps 'si quiero' to YES", () => {
    expect(normalizeMessage('si quiero')).toEqual({ intent: 'YES' })
  })

  it("maps 'sí quiero' to YES", () => {
    expect(normalizeMessage('sí quiero')).toEqual({ intent: 'YES' })
  })

  it("maps '  sí  ' (with whitespace) to YES", () => {
    expect(normalizeMessage('  sí  ')).toEqual({ intent: 'YES' })
  })

  // NO intent
  it("maps 'no' to NO", () => {
    expect(normalizeMessage('no')).toEqual({ intent: 'NO' })
  })

  it("maps '0' to NO", () => {
    expect(normalizeMessage('0')).toEqual({ intent: 'NO' })
  })

  it("maps 'no puedo' to NO", () => {
    expect(normalizeMessage('no puedo')).toEqual({ intent: 'NO' })
  })

  it("maps 'no iré' to NO", () => {
    expect(normalizeMessage('no iré')).toEqual({ intent: 'NO' })
  })

  it("maps 'no ire' to NO", () => {
    expect(normalizeMessage('no ire')).toEqual({ intent: 'NO' })
  })

  it("maps 'no asistire' to NO", () => {
    expect(normalizeMessage('no asistire')).toEqual({ intent: 'NO' })
  })

  it("maps 'no asistiré' to NO", () => {
    expect(normalizeMessage('no asistiré')).toEqual({ intent: 'NO' })
  })

  it("maps 'N' (uppercase) to NO", () => {
    expect(normalizeMessage('N')).toEqual({ intent: 'NO' })
  })

  // STOP intent
  it("maps 'stop' to STOP", () => {
    expect(normalizeMessage('stop')).toEqual({ intent: 'STOP' })
  })

  it("maps 'STOP' (uppercase) to STOP", () => {
    expect(normalizeMessage('STOP')).toEqual({ intent: 'STOP' })
  })

  it("maps 'para' to STOP", () => {
    expect(normalizeMessage('para')).toEqual({ intent: 'STOP' })
  })

  it("maps 'baja' to STOP", () => {
    expect(normalizeMessage('baja')).toEqual({ intent: 'STOP' })
  })

  it("maps 'cancelar' to STOP", () => {
    expect(normalizeMessage('cancelar')).toEqual({ intent: 'STOP' })
  })

  it("maps 'no más' to STOP", () => {
    expect(normalizeMessage('no más')).toEqual({ intent: 'STOP' })
  })

  it("maps 'no mas' to STOP", () => {
    expect(normalizeMessage('no mas')).toEqual({ intent: 'STOP' })
  })

  it("maps 'darme de baja' to STOP", () => {
    expect(normalizeMessage('darme de baja')).toEqual({ intent: 'STOP' })
  })

  // NUMBER intent
  it("maps '2' to NUMBER(2)", () => {
    expect(normalizeMessage('2')).toEqual({ intent: 'NUMBER', value: 2 })
  })

  it("maps '10' to NUMBER(10)", () => {
    expect(normalizeMessage('10')).toEqual({ intent: 'NUMBER', value: 10 })
  })

  it("maps '20' to NUMBER(20) (upper boundary)", () => {
    expect(normalizeMessage('20')).toEqual({ intent: 'NUMBER', value: 20 })
  })

  it("maps '5' to NUMBER(5)", () => {
    expect(normalizeMessage('5')).toEqual({ intent: 'NUMBER', value: 5 })
  })

  // FREE_TEXT (out of range / not matching any intent)
  it("maps '21' to FREE_TEXT (out of 1-20 range)", () => {
    expect(normalizeMessage('21')).toEqual({ intent: 'FREE_TEXT', raw: '21' })
  })

  it("maps '0' to NO (not NUMBER — 0 is a NO keyword)", () => {
    expect(normalizeMessage('0')).toEqual({ intent: 'NO' })
  })

  it("maps 'sin gluten' to FREE_TEXT", () => {
    expect(normalizeMessage('sin gluten')).toEqual({ intent: 'FREE_TEXT', raw: 'sin gluten' })
  })

  it("maps 'vegano' to FREE_TEXT", () => {
    expect(normalizeMessage('vegano')).toEqual({ intent: 'FREE_TEXT', raw: 'vegano' })
  })

  it("maps 'Hola!' to FREE_TEXT preserving original trimmed text", () => {
    expect(normalizeMessage('  Hola!  ')).toEqual({ intent: 'FREE_TEXT', raw: 'Hola!' })
  })

  it("maps '99' (two digits but > 20) to FREE_TEXT", () => {
    expect(normalizeMessage('99')).toEqual({ intent: 'FREE_TEXT', raw: '99' })
  })
})
