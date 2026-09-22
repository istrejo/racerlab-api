export {
  trimNullableString,
  trimString,
} from '../../customers/dto/customer-input.transforms';

/** Parses `true`/`false` query strings, leaving anything else for validation to reject. */
export function optionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}
