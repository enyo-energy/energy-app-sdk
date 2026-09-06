/**
 * The protocol a logged command was issued over.
 *
 * Names the transport, not the appliance: the same wallbox may be written to
 * over Modbus TCP for power limits and over OCPP for configuration keys, and an
 * entry is only interpretable once you know which.
 */
export enum EnyoCommandProtocolEnum {
    /** Modbus TCP */
    Modbus = 'modbus',
    /** Modbus RTU (serial) */
    ModbusRtu = 'modbus-rtu',
    /** OCPP — a configuration change or a call sent to a charge point */
    Ocpp = 'ocpp',
    /** EEBUS SHIP/SPINE */
    Eebus = 'eebus',
    /** MQTT publish */
    Mqtt = 'mqtt',
    /** HTTP request against a vendor API or local endpoint */
    Http = 'http',
    /** Bluetooth Low Energy GATT write */
    Bluetooth = 'bluetooth',
    /** UDP datagram */
    Udp = 'udp',
    /** Anything else — describe it in {@link EnyoCommandLogEntry.operation} */
    Other = 'other',
}

/**
 * How a logged command ended.
 *
 * {@link Rejected} is deliberately separate from {@link Failed}: a device that
 * answered and refused is a very different diagnosis from one that could not be
 * reached, and collapsing the two is what makes a log unable to answer "did it
 * hear us?".
 */
export enum EnyoCommandOutcomeEnum {
    /** The device accepted the command. */
    Success = 'success',
    /** The command could not be delivered or the device errored. */
    Failed = 'failed',
    /** No answer arrived within the app's deadline. */
    TimedOut = 'timed-out',
    /** The device answered and refused the command. */
    Rejected = 'rejected',
}

/**
 * One recorded command an energy app issued to an appliance.
 *
 * The unit of the log is a **write**, not a read: which register was set, which
 * OCPP configuration key was changed, which message was executed — with what it
 * was before, what it became, and whether the device took it.
 */
export interface EnyoCommandLogEntry {
    /** Unique identifier of this entry. Assigned by the host. */
    id: string;
    /** The appliance the command was issued to. */
    applianceId: string;
    /** When the command was issued, in ISO format. */
    timestampIso: string;
    /** The package that issued it. Set by the host, not by the caller. */
    packageName: string;
    /** Which protocol carried the command. */
    protocol: EnyoCommandProtocolEnum;
    /**
     * What was done, in the protocol's own vocabulary — `'write-holding-registers'`,
     * `'ChangeConfiguration'`, `'SetChargingProfile'`, `'gatt-write'`.
     *
     * Use the name the protocol uses rather than a prose description, so entries
     * from one protocol group and compare.
     */
    operation: string;
    /**
     * What was addressed: a register address (`'40023'`), an OCPP configuration
     * key (`'MeterValueSampleInterval'`), an MQTT topic, a GATT characteristic
     * UUID. Omit for commands that address nothing in particular.
     */
    target?: string;
    /**
     * The value before the write, rendered as a string. Omit when it was not
     * read back first — do not substitute a value the app merely believed was
     * there, or the log will explain changes that never happened.
     */
    previousValue?: string;
    /** The value written, rendered as a string. */
    newValue?: string;
    /** How the command ended. */
    outcome: EnyoCommandOutcomeEnum;
    /**
     * Why the app issued the command — `'energy manager reduced available power'`,
     * `'user changed charge mode'`.
     *
     * The single most useful field when reading the log back: the *what* can be
     * reconstructed from the device, the *why* cannot.
     */
    reason?: string;
    /**
     * The error or rejection detail, for any outcome other than
     * {@link EnyoCommandOutcomeEnum.Success}.
     */
    errorMessage?: string;
    /** How long the command took, in milliseconds. */
    durationMs?: number;
    /**
     * Anything the flat fields cannot carry — a decoded payload, the full
     * register block written, the OCPP response object.
     *
     * Values above carry strings so entries from different protocols share one
     * shape and can be rendered in one table; structured data belongs here.
     */
    details?: Record<string, unknown>;
}

/**
 * What an app passes to {@link EnergyAppCommandLog.logCommand}.
 *
 * `id` and `packageName` are assigned by the host. `timestampIso` may be
 * supplied when the command was issued earlier than it is being logged —
 * a batch flushed after a reconnect — and otherwise defaults to the moment the
 * host handles the call.
 */
export type EnyoCommandLogEntryInput =
    Omit<EnyoCommandLogEntry, 'id' | 'packageName' | 'timestampIso'>
    & {timestampIso?: string};

/**
 * Narrows which entries {@link EnergyAppCommandLog.getCommands} returns.
 *
 * Every field is optional and they combine with AND. With no filter at all, the
 * most recent entries across every appliance are returned.
 */
export interface EnyoCommandLogFilter {
    /** Only commands issued to this appliance. */
    applianceId?: string;
    /** Only commands carried over this protocol. */
    protocol?: EnyoCommandProtocolEnum;
    /** Only commands that ended this way — e.g. every failure in the last day. */
    outcome?: EnyoCommandOutcomeEnum;
    /** Only commands issued at or after this ISO timestamp (inclusive). */
    fromIso?: string;
    /** Only commands issued before this ISO timestamp (exclusive). */
    untilIso?: string;
    /**
     * Only commands issued by this package. Omit to see every app's commands —
     * a device misbehaving because two apps are writing the same register is
     * invisible from one app's own entries.
     */
    packageName?: string;
    /**
     * Maximum number of entries to return, newest first. The host applies its
     * own upper bound when this is omitted or larger than that bound.
     */
    limit?: number;
}
