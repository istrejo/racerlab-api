import type { TransformFnParams } from 'class-transformer';

export const trimString = ({ value }: TransformFnParams): string =>
  typeof value === 'string' ? value.trim() : value;

export const trimNullableString = ({
  value,
}: TransformFnParams): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed || null;
};

export const normalizePlate = ({ value }: TransformFnParams): string | null => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().replace(/\s+/g, '').toUpperCase();
  return normalized || null;
};
