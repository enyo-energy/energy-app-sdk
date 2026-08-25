/**
 * Represents a charging card in the enyo system.
 * Contains all relevant information about an electric vehicle charging card.
 */
export interface EnyoChargingCard {
    /** Unique identifier for the charging card */
    id: string;
    name: string;
    rfid?: string;
    pendingRegistration?: boolean;
}

/**
 * Details of a pairing request handed to a
 * {@link EnergyAppChargingCard.listenForPairingStarted} listener when the
 * host asks a package to put its RFID reader into pairing mode.
 */
export interface EnyoChargingCardPairingRequest {
    /** ID of the charging card record the scanned RFID should be assigned to */
    chargingCardId: string;
    /**
     * Appliance (charger) whose RFID reader should enter pairing mode. Omitted
     * when the host does not target a specific charger — in that case the
     * package decides which of its readers to use.
     */
    applianceId?: string;
    /**
     * Time budget, in milliseconds, the package has to deliver a scanned card.
     * The host stops waiting once it elapses, so a listener that resolves later
     * has no effect. Omitted when the host does not impose a deadline.
     */
    timeoutMs?: number;
}
