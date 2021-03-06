import logUpdate from 'log-update';
import { inspect } from 'util';

export const PRINT_PREFIX = '[ omega ] ';

export function printInfo(message: string): void {
  console.info(PRINT_PREFIX + message);
}

export function printError(err: Error) {
  console.error(PRINT_PREFIX, inspect(err, { showHidden: false, depth: null }));
  return err;
}

export function updateLog(message: string) {
  logUpdate(PRINT_PREFIX + message);
}
