// the ids FieldRow gives a field's hint and error, so a control outside a FieldRow can point at them too

export function fieldHintId(htmlFor: string): string {
  return `${htmlFor}-hint`;
}

export function fieldErrorId(htmlFor: string): string {
  return `${htmlFor}-error`;
}
