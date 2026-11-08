export function rating(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5)
    throw new Error('Rating must be an integer from 1 to 5');
  return value;
}
export function price(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error('Price must be a nonnegative integer in cents');
  return value;
}
export function text(value: string, max: number): string {
  const result = value.trim();
  if (!result || result.length > max) throw new Error(`Text must contain 1–${max} characters`);
  return result;
}
