import {describe, expect, it} from 'vitest';
import {EnyoAuthenticationStateEnum} from '../../../types/enyo-authentication.js';
import {
    EnyoAuthenticationV2StateEnum,
    legacyAuthenticationV2Key,
    type EnyoAuthenticationV2,
    type EnyoAuthenticationV2Definition,
} from '../../../types/enyo-authentication-v2.js';
import {
    assertValidAuthenticationV2Definition,
    authenticationV2HasTarget,
    AuthenticationV2ValidationError,
    filterAuthenticationsV2,
    findAuthenticationV2TargetByExternalId,
    validateAuthenticationV2ReauthenticationOptions,
    toAuthenticationV1State,
    validateAuthenticationV2Definition,
} from '../authentication-v2-validators.js';

/** Builds a valid definition, overridable per test. */
function definition(overrides: Partial<EnyoAuthenticationV2Definition> = {}): EnyoAuthenticationV2Definition {
    return {
        authenticationKey: 'vendor-account',
        targets: [{type: 'vehicle', vehicleId: 'veh-1'}, {type: 'vehicle', vehicleId: 'veh-2'}],
        name: [{language: 'de', value: 'Hersteller-Konto'}, {language: 'en', value: 'Vendor account'}],
        authenticationType: 'oauth',
        oauth: {},
        ...overrides,
    };
}

/** Builds a stored authentication, overridable per test. */
function stored(overrides: Partial<EnyoAuthenticationV2> = {}): EnyoAuthenticationV2 {
    return {
        ...definition(),
        state: EnyoAuthenticationV2StateEnum.Authenticated,
        stateChangedAtIso: '2026-11-24T00:00:00.000Z',
        ...overrides,
    };
}

describe('validateAuthenticationV2Definition', () => {
    it('accepts one login for several vehicles and appliances', () => {
        expect(validateAuthenticationV2Definition(definition({
            targets: [
                {type: 'vehicle', vehicleId: 'veh-1'},
                {type: 'appliance', applianceId: 'app-1'},
                {type: 'appliance', applianceId: 'app-2'},
            ],
        }))).toEqual([]);
    });

    it('accepts a single language', () => {
        expect(validateAuthenticationV2Definition(definition({name: [{language: 'en', value: 'Account'}]}))).toEqual([]);
    });

    it('rejects an invalid key', () => {
        expect(validateAuthenticationV2Definition(definition({authenticationKey: 'has space'}))).toHaveLength(1);
        expect(validateAuthenticationV2Definition(definition({authenticationKey: ''}))).toHaveLength(1);
    });

    it('rejects missing, mixed and duplicate targets', () => {
        expect(validateAuthenticationV2Definition(definition({targets: []}))).toEqual(['targets needs at least one target']);
        expect(validateAuthenticationV2Definition(definition({
            targets: [{type: 'package'}, {type: 'vehicle', vehicleId: 'veh-1'}],
        }))).toContain('a "package" target cannot be combined with other targets');
        expect(validateAuthenticationV2Definition(definition({
            targets: [{type: 'vehicle', vehicleId: 'veh-1'}, {type: 'vehicle', vehicleId: 'veh-1'}],
        }))).toEqual(['targets[1] is a duplicate']);
        expect(validateAuthenticationV2Definition(definition({
            targets: [{type: 'appliance', applianceId: ''}],
        }))).toEqual(['targets[0] needs an applianceId']);
    });

    it('rejects bad translations', () => {
        expect(validateAuthenticationV2Definition(definition({name: []}))).toEqual(['name needs at least one translation']);
        expect(validateAuthenticationV2Definition(definition({
            name: [{language: 'de', value: 'A'}, {language: 'de', value: 'B'}],
        }))).toEqual(['name has more than one "de" translation']);
        expect(validateAuthenticationV2Definition(definition({
            description: [{language: 'fr' as 'de', value: 'Compte'}],
        }))).toEqual(['description has unsupported language "fr" (supported: de, en)']);
        expect(validateAuthenticationV2Definition(definition({
            name: [{language: 'en', value: '  '}],
        }))).toEqual(['name has an empty "en" translation']);
    });

    it('requires the configuration of the chosen method', () => {
        expect(validateAuthenticationV2Definition(definition({authenticationType: 'apiKey'})))
            .toEqual(['authenticationType "apiKey" requires apiKey']);
    });

    it('rejects a timeout above the maximum', () => {
        expect(validateAuthenticationV2Definition(definition({timeoutMs: 10 * 60 * 1000}))).toHaveLength(1);
    });

    it('throws all errors at once', () => {
        expect(() => assertValidAuthenticationV2Definition(definition({targets: [], name: []})))
            .toThrow(AuthenticationV2ValidationError);
    });
});

describe('external ids on targets', () => {
    it('accepts ids such as a vendor user id per vehicle', () => {
        expect(validateAuthenticationV2Definition(definition({
            targets: [{type: 'vehicle', vehicleId: 'veh-1', externalIds: {userId: 'u-4711', vendorVehicleId: 'LRW123'}}],
        }))).toEqual([]);
    });

    it('rejects bad keys and values', () => {
        expect(validateAuthenticationV2Definition(definition({
            targets: [{type: 'vehicle', vehicleId: 'veh-1', externalIds: {'user id': 'u', empty: ''}}],
        }))).toEqual([
            'targets[0].externalIds key "user id" must be 1–64 characters out of A–Z a–z 0–9 . _ -',
            'targets[0].externalIds.empty must be a string of 1–256 characters',
        ]);
    });

    it('does not let external ids make a target distinct', () => {
        expect(validateAuthenticationV2Definition(definition({
            targets: [
                {type: 'vehicle', vehicleId: 'veh-1', externalIds: {userId: 'a'}},
                {type: 'vehicle', vehicleId: 'veh-1', externalIds: {userId: 'b'}},
            ],
        }))).toEqual(['targets[1] is a duplicate']);
    });

    it('finds a target by external id', () => {
        const auth = definition({
            targets: [
                {type: 'vehicle', vehicleId: 'veh-1', externalIds: {vendorVehicleId: 'A'}},
                {type: 'vehicle', vehicleId: 'veh-2', externalIds: {vendorVehicleId: 'B'}},
            ],
        });
        expect(findAuthenticationV2TargetByExternalId(auth, 'vendorVehicleId', 'B')).toEqual(auth.targets[1]);
        expect(findAuthenticationV2TargetByExternalId(auth, 'vendorVehicleId', 'C')).toBeUndefined();
    });
});

describe('validateAuthenticationV2ReauthenticationOptions', () => {
    it('accepts a permission update for one affected vehicle', () => {
        expect(validateAuthenticationV2ReauthenticationOptions(definition(), {
            reason: 'insufficientPermissions',
            stateReason: [{language: 'de', value: 'Bitte Zugriff bestätigen.'}],
            affectedTargets: [{type: 'vehicle', vehicleId: 'veh-2'}],
        })).toEqual([]);
    });

    it('rejects affected targets outside the authentication', () => {
        expect(validateAuthenticationV2ReauthenticationOptions(definition(), {
            reason: 'sessionExpired',
            affectedTargets: [{type: 'appliance', applianceId: 'app-9'}],
        })).toEqual(['affectedTargets[0] is not a target of this authentication']);
    });
});

describe('filterAuthenticationsV2', () => {
    const vehicles = stored({authenticationKey: 'cars'});
    const wallbox = stored({
        authenticationKey: 'wallbox',
        targets: [{type: 'appliance', applianceId: 'app-1'}],
        state: EnyoAuthenticationV2StateEnum.ReauthenticationRequired,
    });
    const account = stored({authenticationKey: 'legacy', targets: [{type: 'package'}]});
    const all = [vehicles, wallbox, account];

    it('finds the logins of a vehicle or appliance', () => {
        expect(filterAuthenticationsV2(all, {vehicleId: 'veh-2'})).toEqual([vehicles]);
        expect(filterAuthenticationsV2(all, {applianceId: 'app-1'})).toEqual([wallbox]);
    });

    it('filters by package-wide and state', () => {
        expect(filterAuthenticationsV2(all, {packageWide: true})).toEqual([account]);
        expect(filterAuthenticationsV2(all, {states: [EnyoAuthenticationV2StateEnum.ReauthenticationRequired]})).toEqual([wallbox]);
        expect(filterAuthenticationsV2(all)).toEqual(all);
    });

    it('does not treat a package-wide login as covering a vehicle', () => {
        expect(authenticationV2HasTarget(account, {type: 'vehicle', vehicleId: 'veh-1'})).toBe(false);
    });
});

describe('v1 compatibility', () => {
    it('maps v2 states to v1', () => {
        expect(toAuthenticationV1State(EnyoAuthenticationV2StateEnum.Authenticated)).toBe(EnyoAuthenticationStateEnum.Authenticated);
        expect(toAuthenticationV1State(EnyoAuthenticationV2StateEnum.AuthenticationFailed)).toBe(EnyoAuthenticationStateEnum.AuthenticationFailed);
        expect(toAuthenticationV1State(EnyoAuthenticationV2StateEnum.ReauthenticationRequired)).toBe(EnyoAuthenticationStateEnum.Unauthenticated);
        expect(toAuthenticationV1State(EnyoAuthenticationV2StateEnum.Unauthenticated)).toBe(EnyoAuthenticationStateEnum.Unauthenticated);
    });

    it('builds legacy keys', () => {
        expect(legacyAuthenticationV2Key()).toBe('legacy');
        expect(legacyAuthenticationV2Key('app-1')).toBe('legacy:appliance:app-1');
    });
});
