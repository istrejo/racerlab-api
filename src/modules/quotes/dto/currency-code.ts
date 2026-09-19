import type { TransformFnParams } from 'class-transformer';
import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';

export const DEFAULT_CURRENCY_CODE = 'EUR';

const SUPPORTED_CURRENCY_CODES: ReadonlySet<string> = new Set(
  Intl.supportedValuesOf('currency'),
);

export const normalizeCurrencyCode = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export const isSupportedCurrencyCode = (value: unknown): boolean =>
  typeof value === 'string' && SUPPORTED_CURRENCY_CODES.has(value);

export function IsIsoCurrencyCode(options?: ValidationOptions) {
  return function (target: object, propertyName: string): void {
    registerDecorator({
      name: 'isIsoCurrencyCode',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => isSupportedCurrencyCode(value),
        defaultMessage: (args?: ValidationArguments) =>
          `${args?.property ?? 'currencyCode'} must be a valid ISO 4217 currency code.`,
      },
    });
  };
}
