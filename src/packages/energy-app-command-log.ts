import {
    EnyoCommandLogEntry,
    EnyoCommandLogEntryInput,
    EnyoCommandLogFilter,
} from "../types/enyo-command-log.js";

/**
 * Interface for recording and reading back the commands an energy app issued to
 * an appliance.
 *
 * This is the answer to "why did the device do that?". An appliance's own state
 * shows what it is doing now; it does not show that this app wrote holding
 * register 40023 four seconds ago because the energy manager cut the available
 * power, nor that the write was rejected. Without a record of the writes, that
 * has to be reconstructed from log files that may already have rotated away.
 *
 * The unit is a **write, not a read**. Polling a register every two seconds does
 * not belong here — an entry is a command that changed, or tried to change,
 * something on the device. Recording reads would bury the writes.
 *
 * Entries are append-only: there is no update and no delete. A log an app can
 * rewrite cannot be trusted to explain an incident, and retention is the host's
 * to enforce.
 *
 * Access to this API requires the `CommandLog` permission
 * ({@link EnergyAppPermissionType}); {@link EnergyApp.useCommandLog} throws when
 * it has not been granted.
 *
 * @example
 * ```typescript
 * const commandLog = energyApp.useCommandLog();
 *
 * const before = await modbus.readHoldingRegisters(40023, 1);
 * try {
 *     await modbus.writeSingleRegister(40023, limitW);
 *     await commandLog.logCommand({
 *         applianceId,
 *         protocol: EnyoCommandProtocolEnum.Modbus,
 *         operation: 'write-single-register',
 *         target: '40023',
 *         previousValue: String(before.readUInt16BE(0)),
 *         newValue: String(limitW),
 *         outcome: EnyoCommandOutcomeEnum.Success,
 *         reason: 'energy manager reduced available power',
 *     });
 * } catch (error) {
 *     await commandLog.logCommand({
 *         applianceId,
 *         protocol: EnyoCommandProtocolEnum.Modbus,
 *         operation: 'write-single-register',
 *         target: '40023',
 *         newValue: String(limitW),
 *         outcome: EnyoCommandOutcomeEnum.Failed,
 *         errorMessage: String(error),
 *         reason: 'energy manager reduced available power',
 *     });
 * }
 * ```
 */
export interface EnergyAppCommandLog {
    /**
     * Appends one command to the log.
     *
     * Log the attempt, not only the success: a command that timed out or was
     * rejected is the entry someone will actually go looking for, and an app
     * that only records its successes produces a log where nothing ever went
     * wrong. Set {@link EnyoCommandLogEntry.outcome} accordingly and put the
     * detail in `errorMessage`.
     *
     * Fill {@link EnyoCommandLogEntry.reason} whenever the app knows it. What was
     * written can be reconstructed from the device; why it was written cannot.
     *
     * This call is for auditing and must never gate the command itself — log
     * after the write has been attempted, and do not let a failure to log
     * surface as a failure to control the appliance.
     *
     * Requires the `CommandLog` permission.
     *
     * @param entry - The command to record. `id`, `packageName` and (unless
     *   supplied) `timestampIso` are assigned by the host.
     * @returns Promise resolving to the stored entry, including its assigned id
     * @throws {EnergyAppPermissionNotGrantedError} If the `CommandLog` permission
     *         is not granted.
     */
    logCommand(entry: EnyoCommandLogEntryInput): Promise<EnyoCommandLogEntry>;

    /**
     * Reads recorded commands back, newest first.
     *
     * Returns entries from **every** app, not just this one, unless
     * {@link EnyoCommandLogFilter.packageName} narrows it. That is deliberate:
     * the failure this log exists to explain is often two apps writing the same
     * register, which is invisible from either app's own entries.
     *
     * Requires the `CommandLog` permission.
     *
     * @param filter - Optional narrowing by appliance, protocol, outcome, time
     *   range or package. Fields combine with AND.
     * @returns Promise resolving to the matching entries, newest first
     * @throws {EnergyAppPermissionNotGrantedError} If the `CommandLog` permission
     *         is not granted.
     *
     * @example
     * ```typescript
     * // Everything we failed to write to this appliance today.
     * const failures = await commandLog.getCommands({
     *     applianceId,
     *     outcome: EnyoCommandOutcomeEnum.Failed,
     *     fromIso: startOfDay,
     * });
     * ```
     */
    getCommands(filter?: EnyoCommandLogFilter): Promise<EnyoCommandLogEntry[]>;
}
