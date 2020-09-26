import { MixedSchema, Schema, ValidationError } from 'yup';
import * as yup from 'yup';
import { Cond, CondForTypes, MixedCond, NestCond } from './types/cond';
import { AllowedFieldTypes } from './types/field';

function getValidatorForType(type: AllowedFieldTypes) {
  switch (type) {
    case 'text':
    case 'color':
    case 'tel':
    case 'select':
    case 'radio':
    case 'textarea':
      return yup.string();
    case 'email':
      return yup.string().email();
    case 'uuid':
      return yup.string().uuid();
    case 'url':
      return yup.string().url();
    case 'number':
    case 'range':
      return yup.number();
    case 'checkbox':
      return yup.boolean();
    // case 'week':
    case 'date':
    case 'datetime-local':
    case 'time':
    case 'month':
      return yup.date();
    default:
      throw new Error(`${type} is not a valid field.type.`);
  }
}

function isEmpty(obj: any) {
  return Object.entries(obj).length === 0;
}

function validate(valid: Schema<any>, val: any, messages: string[]): boolean {
  try {
    valid.validateSync(val);
  } catch (err) {
    if (err instanceof ValidationError)
      for (const e of err.errors) messages.push(e);
    return false;
  }
  return true;
}

function validateCondRecur(
  type: AllowedFieldTypes,
  val: any,
  conds: Cond,
  messages: string[],
): boolean {
  if (isEmpty(conds)) return true;

  // NextCond
  const { $and, $or, $not, ...mixedConds } = conds as Required<NestCond>;
  if ($and) {
    if (
      !Object.entries($and).every(([condK, condV]) => {
        return validateCondRecur(type, val, { [condK]: condV }, messages);
      })
    )
      return false;
  }
  if ($or) {
    if (
      !Object.entries($or).some(([condK, condV]) => {
        return validateCondRecur(type, val, { [condK]: condV }, messages);
      })
    )
      return false;
  }
  if ($not) {
    if (
      Object.entries($not).every(([condK, condV]) => {
        return validateCondRecur(type, val, { [condK]: condV }, []); // $not should not load error messages
      })
    )
      return false;
  }

  // MixedCond
  const {
    $in,
    $nin,
    $eq,
    $ne,
    $required,
    ...typeConds
  } = mixedConds as Required<MixedCond>;
  let mixedValid: MixedSchema | null = null;
  if ($in) mixedValid = (mixedValid || (mixedValid = yup.mixed())).oneOf($in);
  if ($nin)
    mixedValid = (mixedValid || (mixedValid = yup.mixed())).notOneOf($nin);
  if ($eq) mixedValid = (mixedValid || (mixedValid = yup.mixed())).oneOf([$eq]);
  if ($ne)
    mixedValid = (mixedValid || (mixedValid = yup.mixed())).notOneOf([$ne]);
  if (mixedValid && !validate(mixedValid, val, messages)) return false;

  // Other conditions
  const {
    $gt,
    $gte,
    $lt,
    $lte,
    $length,
    $integer,
    ...unknownConds
  } = typeConds as Required<CondForTypes>;
  if (!isEmpty(unknownConds))
    throw new Error(`There are unknown keys ${Object.keys(unknownConds)}`);
  let typeValid: Schema<any> | null = null;
  if ($required) typeValid = (typeValid = getValidatorForType(type)).required();
  if ($gt)
    typeValid = (typeValid = getValidatorForType(
      type,
    ) as yup.NumberSchema).moreThan($gt);
  if ($gte)
    typeValid = ((typeValid || (typeValid = getValidatorForType(type))) as
      | yup.StringSchema
      | yup.NumberSchema
      | yup.DateSchema).min($gte);
  if ($lt)
    typeValid = ((typeValid ||
      (typeValid = getValidatorForType(type))) as yup.NumberSchema).lessThan(
      $lt,
    );
  if ($lte)
    typeValid = ((typeValid || (typeValid = getValidatorForType(type))) as
      | yup.StringSchema
      | yup.NumberSchema
      | yup.DateSchema).max($lte);
  if ($length)
    typeValid = ((typeValid ||
      (typeValid = getValidatorForType(type))) as yup.StringSchema).length(
      $length,
    );
  if ($integer)
    typeValid = ((typeValid ||
      (typeValid = getValidatorForType(type))) as yup.NumberSchema).integer();
  if (typeValid && !validate(typeValid, val, messages)) return false;

  return true;
}

export function validateCond(
  type: AllowedFieldTypes,
  val: any,
  cond: Cond,
  messages: string[] = [],
): boolean {
  if (!validate(getValidatorForType(type), val, messages)) return false;
  return validateCondRecur(type, val, cond, messages);
}
