import {randomUUID} from "node:crypto";
import {HemsOneAppliance, HemsOneApplianceConnectionType} from "../../types/hems-one-appliance.js";
import {
    HemsOneApplianceStateEnum,
    HemsOneApplianceTypeEnum
} from "../../types/hems-one-appliance.js";
import {
    HemsOneBatteryStateEnum,
    type HemsOneDataBusBatteryValuesUpdateV1,
    type HemsOneDataBusMessage,
    HemsOneDataBusMessageEnum
} from "../../types/hems-one-data-bus-value.js";
import {HemsOneSourceEnum} from "../../types/hems-one-source.enum.js";
import {
    type HemsOneBatteryApplianceMetadata,
} from "../../types/hems-one-battery-appliance.js";

import {
    type EnergyAppModbusDevice,
    type IRegisterMapper,
    type EnergyAppModbusBatteryConfig,
    EnergyAppModbusConfigurationError,
    type IEnergyAppModbusInverter
} from './interfaces.js';
import {EnergyAppModbusRegisterMapper} from './EnergyAppModbusRegisterMapper.js';
import {EnergyAppModbusFaultTolerantReader} from './EnergyAppModbusFaultTolerantReader.js';
import {EnergyApp} from "../../index.js";

export class EnergyAppModbusBattery implements EnergyAppModbusDevice {
    public readonly inverter?: IEnergyAppModbusInverter;
    private readonly _registerMapper: IRegisterMapper;

    private _appliance?: HemsOneAppliance;
    private _batteryMetadata?: HemsOneBatteryApplianceMetadata;

    constructor(readonly client: EnergyApp, readonly config: EnergyAppModbusBatteryConfig) {
        this.config = config;
        this.client = client;
        this.inverter = config.inverter;
        this._registerMapper = new EnergyAppModbusRegisterMapper();

        // Validate configuration
        const validation = this._registerMapper.validateRegisterMap(config.registers);
        if (!validation.valid) {
            throw new EnergyAppModbusConfigurationError(`Invalid battery configuration: ${validation.errors.join(', ')}`);
        }

        if (!config.inverter) {
            throw new EnergyAppModbusConfigurationError('Battery requires an inverter reference');
        }
    }

    get appliance(): HemsOneAppliance {
        if (!this._appliance) {
            throw new Error('Battery appliance not initialized. Call connect() first.');
        }
        return this._appliance;
    }

    get networkDevice() {
        if (!this.inverter) {
            throw new Error('Battery requires an inverter reference');
        }
        return this.inverter.networkDevice;
    }

    async connect(): Promise<void> {
        if (!this.inverter) {
            throw new Error('Battery requires an inverter reference');
        }

        if (!this.inverter.isConnected()) {
            throw new Error('Inverter must be connected before connecting battery');
        }

        console.log(`Connecting battery to inverter ${this.config.name[0]?.name}...`);

        // Discover battery metadata during connection
        this._batteryMetadata = await this._discoverBatteryMetadata();

        // Initialize appliance
        await this._initializeAppliance();

        console.log(`Successfully connected battery ${this.config.name[0]?.name}`);
    }

    async disconnect(): Promise<void> {
        try {
            await this.inverter?.disconnect()
            console.log(`Disconnected from battery at ${this.networkDevice.hostname}`);
        } catch (error) {
            console.warn(`Error disconnecting from battery: ${(error as Error).message}`);
        }
    }

    isConnected(): boolean {
        return this.inverter?.isConnected() || false;
    }

    async updateData(): Promise<HemsOneDataBusMessage[]> {
        if (!this.inverter || !this.inverter.isConnected() || !this._appliance) {
            throw new Error('Battery not connected. Call connect() first.');
        }

        // Use the inverter's modbus instance
        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            throw new Error('Inverter modbus instance not available');
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const registerData = await this._registerMapper.readMultipleRegisters(reader, this.config.registers);

        // Extract battery data
        const batteryCurrent = registerData.current || undefined;
        const batteryVoltage = registerData.voltage || undefined;
        const batterySoC = registerData.soc || undefined;
        const batteryPowerW = await this.getPower();

        // Read current battery state if available
        let batteryState: HemsOneBatteryStateEnum | undefined;
        try {
            batteryState = await this.getBatteryState() || undefined;
        } catch (error) {
            console.warn(`Failed to read battery state: ${(error as Error).message}`);
        }

        const message: HemsOneDataBusBatteryValuesUpdateV1 = {
            type: 'message',
            source: HemsOneSourceEnum.Device,
            id: randomUUID(),
            timestampIso: new Date().toISOString(),
            message: HemsOneDataBusMessageEnum.BatteryValuesUpdateV1,
            applianceId: this._appliance.id,
            data: {
                state: batteryState,
                batteryPowerW: batteryPowerW ?? undefined,
                batterySoC
            },
            resolution: '10s'
        };

        console.log(`Battery Data (${this.config.name[0]?.name}): State=${batteryState || 'N/A'}, Power=${batteryPowerW}W, SoC=${batterySoC}%, Current=${batteryCurrent}A, Voltage=${batteryVoltage}V`);

        return [message];
    }

    // Convenience methods for accessing specific register values
    async getSoc(): Promise<number | null> {
        if (!this.inverter || !this.config.registers.soc) {
            return null;
        }

        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.soc);

        return result.success ? result.value! : null;
    }

    async getCurrent(): Promise<number | null> {
        if (!this.inverter || !this.config.registers.current) {
            return null;
        }

        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.current);

        return result.success ? result.value! : null;
    }

    async getPower(): Promise<number | null> {
        if (!this.inverter) {
            return null;
        }

        // Priority 1: Direct power register
        if (this.config.registers.power) {
            const modbusInstance = (this.inverter as any)._modbusInstance;
            const connectionHealth = (this.inverter as any)._connectionHealth;

            if (!modbusInstance) {
                return null;
            }

            const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
            const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.power);

            if (result.success && result.value !== undefined) {
                return result.value;
            }
        }

        // Priority 2: Calculate from percentage registers
        if (this.config.registers.drainPercentage || this.config.registers.loadPercentage) {
            const drainPercentage = await this.getDrainPercentage();
            const loadPercentage = await this.getLoadPercentage();
            const maxCapacityWh = this._batteryMetadata?.maxCapacityWh || null;

            const percentagePower = this._calculatePowerFromPercentages(drainPercentage, loadPercentage, maxCapacityWh);
            if (percentagePower !== null) {
                return percentagePower;
            }
        }

        // Priority 3: Calculate from current and voltage
        const current = await this.getCurrent();
        const voltage = await this.getVoltage();

        if (current !== null && voltage !== null) {
            return current * voltage;
        }

        return null;
    }

    async getVoltage(): Promise<number | null> {
        if (!this.inverter || !this.config.registers.voltage) {
            return null;
        }

        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.voltage);

        return result.success ? result.value! : null;
    }

    /**
     * Reads the drain percentage from modbus register.
     * Drain percentage represents the percentage of maximum capacity being discharged.
     *
     * @returns Drain percentage (0-100), or null if not available
     */
    async getDrainPercentage(): Promise<number | null> {
        if (!this.inverter || !this.config.registers.drainPercentage) {
            return null;
        }

        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.drainPercentage);

        return result.success ? result.value! : null;
    }

    /**
     * Reads the load percentage from modbus register.
     * Load percentage represents the percentage of maximum capacity being charged.
     *
     * @returns Load percentage (0-100), or null if not available
     */
    async getLoadPercentage(): Promise<number | null> {
        if (!this.inverter || !this.config.registers.loadPercentage) {
            return null;
        }

        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.loadPercentage);

        return result.success ? result.value! : null;
    }

    /**
     * Reads the current battery state from modbus registers.
     * Maps the register value to HemsOneBatteryApplianceStateEnum using the configured value mapping.
     */
    async getBatteryState(): Promise<HemsOneBatteryStateEnum | null> {
        if (!this.inverter || !this.config.registers.state) {
            return null;
        }

        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            return null;
        }

        try {
            const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
            const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.state);

            if (!result.success || result.value === undefined) {
                return null;
            }

            // Use configured value mapping if available
            if (this.config.registers.state.valueMapping) {
                const mapping = this.config.registers.state.valueMapping.find(m => m.value === result.value);
                if (mapping) {
                    return mapping.mappedState as HemsOneBatteryStateEnum;
                } else {
                    console.warn(`No mapping found for battery state value: ${result.value}. Available mappings: ${this.config.registers.state.valueMapping.map(m => m.value).join(', ')}`);
                    return null;
                }
            } else {
                console.warn('Battery state register configured without value mapping. Please configure valueMapping in register config.');
                return null;
            }
        } catch (error) {
            console.warn(`Failed to read battery state: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Calculates battery power from drain and load percentages.
     *
     * @param drainPercentage - Percentage of max capacity being drained (discharging, positive power)
     * @param loadPercentage - Percentage of max capacity being loaded (charging, negative power)
     * @param maxCapacityWh - Maximum battery capacity in Wh
     * @returns Power in watts (positive for discharging, negative for charging), or null if calculation not possible
     */
    private _calculatePowerFromPercentages(
        drainPercentage: number | null,
        loadPercentage: number | null,
        maxCapacityWh: number | null
    ): number | null {
        if (!maxCapacityWh) {
            return null;
        }

        // Priority: drain percentage takes precedence over load percentage
        if (drainPercentage !== null && drainPercentage !== undefined) {
            // Discharging: positive power value
            return (drainPercentage / 100) * maxCapacityWh;
        }

        if (loadPercentage !== null && loadPercentage !== undefined) {
            // Charging: negative power value
            return -(loadPercentage / 100) * maxCapacityWh;
        }

        return null;
    }

    /**
     * Discovers and caches battery metadata from modbus registers during connection.
     * This method reads static metadata like max capacity and power limits once
     * and stores them for later use in appliance creation.
     */
    private async _discoverBatteryMetadata(): Promise<HemsOneBatteryApplianceMetadata> {
        if (!this.inverter || !this.inverter.isConnected()) {
            throw new Error('Inverter must be connected before discovering battery metadata');
        }

        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            throw new Error('Inverter modbus instance not available');
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const metadata: HemsOneBatteryApplianceMetadata = {};

        try {
            // Read max capacity if configured
            if (this.config.registers.maxCapacityWh) {
                const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.maxCapacityWh);
                if (result.success && result.value !== undefined) {
                    metadata.maxCapacityWh = result.value;
                    console.log(`Discovered battery max capacity: ${result.value} Wh`);
                }
            }

            // Read max discharge power if configured
            if (this.config.registers.maxDischargePowerW) {
                const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.maxDischargePowerW);
                if (result.success && result.value !== undefined) {
                    metadata.maxDischargePowerW = result.value;
                    console.log(`Discovered battery max discharge power: ${result.value} W`);
                }
            }

            // Read max charging power if configured
            if (this.config.registers.maxChargingPowerW) {
                const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.maxChargingPowerW);
                if (result.success && result.value !== undefined) {
                    metadata.maxChargingPowerW = result.value;
                    console.log(`Discovered battery max charging power: ${result.value} W`);
                }
            }

            // Set connected appliance ID to the inverter's appliance ID if available
            if (this.inverter.appliance?.id) {
                metadata.connectedToApplianceId = this.inverter.appliance.id;
            }

        } catch (error) {
            console.warn(`Warning: Failed to discover some battery metadata: ${(error as Error).message}`);
        }

        return metadata;
    }

    private async _initializeAppliance(): Promise<void> {
        if (!this.inverter) {
            throw new Error('Battery requires an inverter reference');
        }

        const appliances = await this.client.useAppliances().list();
        let existingAppliance = appliances.find(a =>
            a.networkDeviceIds.includes(this.inverter!.networkDevice.id) &&
            a.type === HemsOneApplianceTypeEnum.Storage
        );

        if (!existingAppliance) {
            // Create new appliance
            existingAppliance = {
                id: randomUUID(),
                type: HemsOneApplianceTypeEnum.Storage,
                networkDeviceIds: [this.inverter.networkDevice.id],
                name: this.config.name,
                metadata: {
                    state: HemsOneApplianceStateEnum.Connected,
                    connectionType: HemsOneApplianceConnectionType.Connector,
                    ...this.config.options?.topology && {topology: this.config.options.topology}
                },
                battery: this._batteryMetadata
            };
            await this.client.useAppliances().save(existingAppliance, undefined);
            console.log(`Created new battery appliance: ${this.config.name[0]?.name}`);
        } else {
            // Update existing appliance
            existingAppliance = {
                ...existingAppliance,
                name: this.config.name,
                metadata: {
                    ...existingAppliance.metadata,
                    state: HemsOneApplianceStateEnum.Connected,
                    connectionType: HemsOneApplianceConnectionType.Connector,
                    ...this.config.options?.topology && {topology: this.config.options.topology}
                },
                battery: this._batteryMetadata
            };
            await this.client.useAppliances().save(existingAppliance, existingAppliance.id);
            console.log(`Updated existing battery appliance: ${this.config.name[0]?.name}`);
        }

        this._appliance = existingAppliance;
    }

    modbusClient() {
        return this.inverter?.modbusClient()
    }
}