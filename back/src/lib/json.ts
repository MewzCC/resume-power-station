export function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}
