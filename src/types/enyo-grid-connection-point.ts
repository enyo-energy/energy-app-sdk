/**
 * Number of electrical phases provided by a grid connection.
 * Most residential connections in Europe are single-phase (1) or three-phase (3);
 * two-phase (split-phase, 2) connections also exist in some markets.
 */
export type EnyoGridConnectionPointPhaseCount = 1 | 2 | 3;

/**
 * Details about the site's grid connection point (the physical interface
 * between the local electrical installation and the public grid).
 *
 * These values are typically defined by the grid operator (DSO) at
 * installation time and are used by energy managers and integrations
 * to plan grid-import/export budgets, derive per-phase current limits,
 * and enforce regulatory or contractual power caps.
 */
export interface EnyoGridConnectionPoint {
    /**
     * Rated current of the main fuse protecting the grid connection point,
     * in amperes (A). This is the per-phase fuse rating as installed by the
     * grid operator (e.g. 25, 35, 63).
     */
    fuseAmpere: number;
    /**
     * Number of electrical phases provided by the grid connection
     * (1 = single-phase, 2 = split-phase, 3 = three-phase).
     */
    numberOfPhases: EnyoGridConnectionPointPhaseCount;
    /**
     * Maximum active power, in watts (W), that may be drawn from or fed into
     * the grid at the connection point. Derived from the fuse rating, phase
     * count, and any contractual or regulatory limits imposed by the grid
     * operator.
     */
    powerLimitW: number;
}
