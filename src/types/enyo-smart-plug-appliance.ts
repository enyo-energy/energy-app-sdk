/**
 * Capabilities a smart plug / switchable relay appliance may support. A plug
 * that only reports power without being switchable lists {@link Power} alone;
 * one that can only be switched lists {@link Switching} alone.
 */
export enum EnyoSmartPlugApplianceAvailableFeaturesEnum {
    /** If the plug can be switched on and off by the energy manager or an automation */
    Switching = 'Switching',
    /** If the plug measures the active power (W) drawn by the connected load */
    Power = 'Power',
    /** If the plug reports a cumulative energy meter reading (Wh) for the connected load */
    EnergyMetering = 'EnergyMetering',
}

/**
 * Relay state of a smart plug channel.
 */
export enum EnyoSmartPlugApplianceStateEnum {
    /** The relay is closed — the connected load is powered */
    On = 'On',
    /** The relay is open — the connected load is not powered */
    Off = 'Off',
}

/**
 * Icon suggested for a smart plug appliance in end-user surfaces. Describes the
 * load connected to the plug rather than the plug itself, so a user recognises
 * "Dishwasher" instead of "Shelly channel 1".
 *
 * Purely presentational — consumers must not derive control behaviour from it.
 * When omitted, or when a consumer does not know the member, it should fall
 * back to a generic plug icon.
 */
export enum EnyoSmartPlugApplianceIconEnum {
    /** Generic socket / unspecified load */
    SmartPlug = 'SmartPlug',
    Dishwasher = 'Dishwasher',
    WashingMachine = 'WashingMachine',
    Dryer = 'Dryer',
    Refrigerator = 'Refrigerator',
    Freezer = 'Freezer',
    Oven = 'Oven',
    CoffeeMachine = 'CoffeeMachine',
    /** Kettle, toaster and other small kitchen appliances */
    KitchenAppliance = 'KitchenAppliance',
    /** TV, hi-fi, console and other entertainment loads */
    Entertainment = 'Entertainment',
    /** Desktop, server, network equipment */
    Computer = 'Computer',
    Lighting = 'Lighting',
    /** Pool pump or pool filter system */
    PoolPump = 'PoolPump',
    /** Circulation, well or sump pump */
    Pump = 'Pump',
    /** Electric water heater / boiler */
    WaterHeater = 'WaterHeater',
    /** Portable electric heater */
    Heater = 'Heater',
    /** Fan or ventilation unit */
    Fan = 'Fan',
    Aquarium = 'Aquarium',
    /** Garden, irrigation or greenhouse equipment */
    Garden = 'Garden',
    /** Workshop machinery and power tools */
    Workshop = 'Workshop',
    /** Car / e-bike charging via a plain socket */
    Charging = 'Charging',
    /** Known load that none of the other members describe */
    Other = 'Other',
}

/**
 * Initial presentation defaults for a smart plug appliance, supplied by the
 * owning energy app **once, when the appliance is first created**.
 *
 * These are seed values for user-owned settings: after creation the end user
 * owns them, and the energy app must not send them again or overwrite what the
 * user changed. Consumers that persist user edits should therefore ignore this
 * object on subsequent appliance updates.
 *
 * The user-facing display name follows the same pattern and is already covered
 * generally by {@link EnyoAppliance.customName} — it is not repeated here.
 */
export interface EnyoSmartPlugApplianceDefaults {
    /**
     * Whether the appliance should be shown in the end-user cockpit by default.
     * Set `false` for plugs that are operationally relevant but not interesting
     * to look at (e.g. an auxiliary relay).
     */
    showInCockpit: boolean;
    /**
     * Whether the cockpit should offer a manual on/off switch for this plug by
     * default. Only meaningful for plugs that list
     * {@link EnyoSmartPlugApplianceAvailableFeaturesEnum.Switching}; a
     * measure-only plug should set this to `false`.
     */
    onOffSwitchShown: boolean;
    /**
     * Icon to display for the plug by default, describing the connected load.
     * Omit when the energy app cannot tell what is plugged in — consumers then
     * fall back to a generic plug icon.
     */
    icon?: EnyoSmartPlugApplianceIconEnum;
}

/**
 * Type-specific metadata for a smart plug appliance — a switchable socket or
 * relay channel (e.g. one channel of a Shelly device) that powers an arbitrary
 * load.
 *
 * A device exposing several independently switchable channels should be
 * modelled as one {@link EnyoAppliance} of type
 * {@link EnyoApplianceTypeEnum.SmartPlug} per channel, each carrying its own
 * {@link channel} index.
 *
 * Appliances that can be switched should list
 * {@link EnyoAutomationActionTypeEnum.SmartPlugSwitch} in
 * {@link EnyoAppliance.supportedAutomationActions} so the automation UI offers
 * them as targets.
 */
export interface EnyoSmartPlugApplianceMetadata {
    /** List of features supported by this smart plug */
    availableFeatures: EnyoSmartPlugApplianceAvailableFeaturesEnum[];
    /**
     * Current relay state of the plug, when known. Omit when the integration
     * cannot determine it — `undefined` means "not known", which is not the
     * same as {@link EnyoSmartPlugApplianceStateEnum.Off}.
     */
    state?: EnyoSmartPlugApplianceStateEnum;
    /**
     * Zero-based channel index within the physical device, for devices that
     * expose more than one switchable channel. Omit for single-channel plugs.
     */
    channel?: number;
    /**
     * Maximum electrical power the plug is rated to switch, in watts. Used to
     * bound how much load an energy manager assumes it can move onto this plug.
     */
    ratedPowerW?: number;
    /**
     * Typical power draw of the load connected to this plug, in watts, when it
     * is known (either configured by the user or learned from measurements).
     *
     * Lets a consumer estimate the effect of switching the plug on before it
     * has ever been switched — a plug reporting `0 W` while off says nothing
     * about what it will draw once on.
     */
    expectedLoadPowerW?: number;
    /**
     * Minimum time in minutes the plug should stay on after being switched on,
     * to protect the connected load from short-cycling (e.g. a pool pump or a
     * compressor). Consumers issuing
     * {@link EnyoDataBusSetSmartPlugSwitchV1} commands should respect this.
     */
    minOnDurationMinutes?: number;
    /**
     * Minimum time in minutes the plug should stay off after being switched
     * off, for the same short-cycling protection as
     * {@link minOnDurationMinutes}.
     */
    minOffDurationMinutes?: number;
    /**
     * Initial presentation defaults for this plug (cockpit visibility, manual
     * switch, icon), supplied once when the appliance is created. The end user
     * owns these settings afterwards — see
     * {@link EnyoSmartPlugApplianceDefaults}. The energy app must not use this
     * field to change them later.
     */
    defaults?: EnyoSmartPlugApplianceDefaults;
    /**
     * Whether the energy manager is allowed to actively switch this plug. When
     * `false`, the plug is treated as read-only/monitor-only and the EMS must
     * not issue switch commands to it. When omitted, consumers should fall back
     * to their configured default behaviour.
     */
    controlAllowed?: boolean;
}
