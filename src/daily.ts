/**
 * The one morning run. In order:
 *  1. find new organisations in the four nations' registers (clear new ones are added),
 *  2. refresh the register snapshot for every listed charity (reuses step 1's download),
 *  3. visit the websites that are due and work out every status.
 * Each register file is downloaded once. A failed step is reported and the rest still run.
 */
import { discover } from './discover.ts';
import { refreshRegister } from './register.ts';
import { runChecks } from './run.ts';

const step = async (name: string, fn: () => Promise<unknown>) => {
  const started = Date.now();
  try {
    await fn();
    console.log(`✓ ${name} (${Math.round((Date.now() - started) / 1000)} s)\n`);
  } catch (e) {
    process.exitCode = 1;
    console.error(`✗ ${name} failed; carrying on.`, e);
  }
};

await step('Find new organisations', discover);
await step('Refresh the charity register', refreshRegister);
await step('Check websites and work out statuses', () => runChecks());
