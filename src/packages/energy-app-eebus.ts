/**
 * Backwards-compatible import path. The implementation moved to
 * `./eebus/energy-app-eebus.ts` when the SDK was restructured into a
 * composed facade. New code should import from there directly; this barrel
 * re-export keeps existing `import {EnergyAppEebus} from '.../energy-app-eebus.js'`
 * paths working at the module level (the *shape* of `EnergyAppEebus` did
 * change — see `MIGRATION.md`).
 */
export * from './eebus/energy-app-eebus.js';
