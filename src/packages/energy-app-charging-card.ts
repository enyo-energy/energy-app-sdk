import {EnyoChargingCard, EnyoChargingCardPairingRequest} from "../types/enyo-charging-card.js";

/**
 * Interface for managing charging cards in enyo packages.
 * Provides read-only operations for charging card information as well as
 * RFID pairing support.
 */
export interface EnergyAppChargingCard {
    /** Get a list of all registered charging cards */
    list: () => Promise<EnyoChargingCard[]>;
    /** Get a specific charging card by its ID */
    getById: (id: string) => Promise<EnyoChargingCard | null>;
    /**
     * Listen for pairing requests, i.e. the host asking this package to put its
     * RFID reader into pairing mode — typically because a user started adding a
     * new charging card in the app.
     *
     * The listener owns the whole pairing attempt: it enables pairing mode on
     * the charger, waits for a card to be held against the reader and resolves
     * with the RFID identifier that was read (the value stored in
     * {@link EnyoChargingCard.rfid}). The host assigns it to the charging card
     * named by {@link EnyoChargingCardPairingRequest.chargingCardId} and clears
     * that card's {@link EnyoChargingCard.pendingRegistration} flag.
     *
     * Reject the returned promise when no card was presented or the charger
     * refused to enter pairing mode; the host then reports the attempt as
     * failed and leaves the card pending. Honour
     * {@link EnyoChargingCardPairingRequest.timeoutMs} when it is set — the host
     * ignores a result that arrives after the deadline.
     *
     * Only register a listener when the package actually drives an RFID reader.
     * Requests carry an optional
     * {@link EnyoChargingCardPairingRequest.applianceId}; a package managing
     * several chargers should check it and reject requests for appliances it
     * does not own.
     *
     * @param listener - Callback invoked for every pairing request, resolving
     *   with the RFID identifier read from the presented card
     * @returns A unique listener ID that can be used to remove the listener
     *
     * @example
     * ```typescript
     * const chargingCard = energyApp.useChargingCard();
     * const listenerId = chargingCard.listenForPairingStarted(async (request) => {
     *     const rfid = await charger.enterPairingMode(request.applianceId, request.timeoutMs);
     *     return rfid;
     * });
     * ```
     */
    listenForPairingStarted: (
        listener: (request: EnyoChargingCardPairingRequest) => Promise<string>,
    ) => string;
    /**
     * Removes a previously registered listener.
     *
     * @param listenerId - The ID returned by {@link listenForPairingStarted}
     */
    removeListener: (listenerId: string) => void;
}
