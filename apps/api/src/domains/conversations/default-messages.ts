export const DEFAULT_MESSAGES: Record<'es' | 'en', Record<string, string>> = {
  es: {
    ask_attendance: '¿Confirmas tu asistencia? Responde SÍ o NO.',
    ask_companions:
      '¿Cuántas personas asistirán contigo? (incluye acompañantes, responde con un número)',
    ask_dietary:
      '¿Tienes alguna restricción alimentaria? (sin gluten, vegano, alergias...) Si no, responde NO.',
    confirmed: '¡Perfecto! Hemos registrado tu confirmación. ¡Nos vemos pronto!',
    confirmed_not_attending:
      'Entendido. Lo sentimos que no puedas venir. ¡Gracias por responder!',
    opt_out_confirmed:
      'Has sido dado de baja. No recibirás más mensajes de nuestra parte.',
  },
  en: {
    ask_attendance: 'Will you attend? Reply YES or NO.',
    ask_companions: 'How many people will attend with you? (reply with a number)',
    ask_dietary:
      'Do you have any dietary restrictions? (gluten-free, vegan, allergies...) If none, reply NO.',
    confirmed: "Perfect! We've recorded your RSVP. See you soon!",
    confirmed_not_attending:
      "Understood. Sorry you can't make it. Thanks for letting us know!",
    opt_out_confirmed: "You've been unsubscribed. You won't receive further messages.",
  },
}

export function getMessage(templateKey: string, language: 'es' | 'en'): string {
  return (
    DEFAULT_MESSAGES[language][templateKey] ??
    DEFAULT_MESSAGES['es'][templateKey] ??
    templateKey
  )
}
