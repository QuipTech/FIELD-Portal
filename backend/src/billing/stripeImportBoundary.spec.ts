import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

// The same boundary as the ESLint no-restricted-imports rule, as a test so
// it also holds in CI runs that skip lint: only src/billing may load the
// Stripe SDK (import, require or dynamic import).
const SRC_ROOT = join(__dirname, '..');
const BILLING_DIR = join(SRC_ROOT, 'billing');
const STRIPE_IMPORT =
  /(from\s+['"]stripe(\/[^'"]*)?['"]|require\(\s*['"]stripe(\/[^'"]*)?['"]\s*\)|import\(\s*['"]stripe(\/[^'"]*)?['"]\s*\))/;

const listTypeScriptFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listTypeScriptFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });

describe('Stripe SDK import boundary', () => {
  it('is imported only inside src/billing', () => {
    const offenders = listTypeScriptFiles(SRC_ROOT)
      .filter((file) => !file.startsWith(BILLING_DIR + sep))
      .filter((file) => STRIPE_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC_ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('recognises every import form it guards against', () => {
    for (const line of [
      "import * as Stripe from 'stripe';",
      'import Stripe from "stripe";',
      "const s = require('stripe');",
      "await import('stripe/lib/x');",
    ]) {
      expect(STRIPE_IMPORT.test(line)).toBe(true);
    }
    expect(
      STRIPE_IMPORT.test("import { x } from './stripeEventMapping';"),
    ).toBe(false);
  });
});
