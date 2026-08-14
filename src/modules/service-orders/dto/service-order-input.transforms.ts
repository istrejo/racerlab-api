import type { TransformFnParams } from 'class-transformer';

export const trimString = ({ value }: TransformFnParams): string =>
  typeof value === 'string' ? value.trim() : value;

export const trimNullableString = ({ value }: TransformFnParams): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed || null;
};
