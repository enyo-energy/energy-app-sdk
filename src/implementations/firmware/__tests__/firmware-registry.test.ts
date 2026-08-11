import {describe, expect, it} from 'vitest';
import type {EnergyAppPackageFirmwareFile} from '../../../energy-app-package-definition.js';
import {EnergyAppPackageFirmwareModeEnum} from '../../../energy-app-package-definition.js';
import {EnergyAppPermissionTypeEnum} from '../../../energy-app-permission.type.js';
import {
    defineFirmwareFile,
    resolveFirmwareUpdatePath,
    resolveNextFirmware,
} from '../define-firmware-file.js';
import {
    assertValidFirmwareRegistry,
    FirmwareRegistryValidationError,
    validateFirmwareRegistry,
} from '../firmware-validators.js';

/**
 * A three-node chain of opaque, deliberately unordered version strings — sorting
 * them alphabetically gives the wrong order, so any resolution that works here
 * cannot be comparing versions.
 */
const CHAIN: EnergyAppPackageFirmwareFile[] = [
    defineFirmwareFile({
        fileId: 'baseline',
        path: './firmware/baseline.bin',
        firmwareVersion: 'zz-2024-11-rc3',
        modelNames: ['AC-22-Pro'],
        fallbackForUnknownVersion: true,
    }),
    defineFirmwareFile({
        fileId: 'hotfix-a',
        path: './firmware/hotfix-a.bin',
        firmwareVersion: 'A7F2',
        installForFirmwareVersion: ['zz-2024-11-rc3'],
        modelNames: ['AC-22-Pro'],
    }),
    defineFirmwareFile({
        fileId: 'stable',
        path: './firmware/stable.bin',
        firmwareVersion: '1.0',
        installForFirmwareVersion: ['A7F2'],
        modelNames: ['AC-22-Pro'],
    }),
];

const DEPENDENT = {firmwareMode: EnergyAppPackageFirmwareModeEnum.Dependent} as const;

/** Wraps firmware entries in the minimal package shape the validator reads. */
function definitionWith(
    firmware: EnergyAppPackageFirmwareFile[],
    firmwareMode = EnergyAppPackageFirmwareModeEnum.Dependent,
) {
    return {
        firmware,
        firmwareMode,
        permissions: [EnergyAppPermissionTypeEnum.FirmwareRegistry],
        compatibility: [],
    };
}

describe('resolveNextFirmware — dependent mode', () => {
    it('follows a declared edge regardless of string ordering', () => {
        expect(resolveNextFirmware(CHAIN, 'zz-2024-11-rc3', {modelName: 'AC-22-Pro', ...DEPENDENT})?.fileId)
            .toBe('hotfix-a');
        expect(resolveNextFirmware(CHAIN, 'A7F2', {modelName: 'AC-22-Pro', ...DEPENDENT})?.fileId)
            .toBe('stable');
    });

    it('returns undefined at a terminal node', () => {
        expect(resolveNextFirmware(CHAIN, '1.0', {modelName: 'AC-22-Pro', ...DEPENDENT})).toBeUndefined();
    });

    it('offers the fallback for an unknown version', () => {
        expect(resolveNextFirmware(CHAIN, 'who-knows', {modelName: 'AC-22-Pro', ...DEPENDENT})?.fileId)
            .toBe('baseline');
    });

    it('does not push a device on a known terminal version back to the fallback', () => {
        expect(resolveNextFirmware(CHAIN, '1.0', {modelName: 'AC-22-Pro', ...DEPENDENT})).toBeUndefined();
    });

    it('ignores entries scoped to another model', () => {
        expect(resolveNextFirmware(CHAIN, 'zz-2024-11-rc3', {modelName: 'AC-11-Basic', ...DEPENDENT}))
            .toBeUndefined();
    });
});

describe('resolveNextFirmware — latest mode', () => {
    it('defaults to latest when no mode is given', () => {
        expect(resolveNextFirmware(CHAIN, 'zz-2024-11-rc3', {modelName: 'AC-22-Pro'})?.fileId)
            .toBe('stable');
    });

    it('offers the last declared entry whatever the current version is', () => {
        expect(resolveNextFirmware(CHAIN, 'anything-at-all', {modelName: 'AC-22-Pro'})?.fileId)
            .toBe('stable');
        expect(resolveNextFirmware(CHAIN, 'A7F2', {modelName: 'AC-22-Pro'})?.fileId).toBe('stable');
    });

    it('returns undefined once the device runs the last declared entry', () => {
        expect(resolveNextFirmware(CHAIN, '1.0', {modelName: 'AC-22-Pro'})).toBeUndefined();
    });

    it('ignores installForFirmwareVersion entirely', () => {
        const files = [
            defineFirmwareFile({fileId: 'a', path: './a.bin', firmwareVersion: 'a'}),
            defineFirmwareFile({
                fileId: 'b',
                path: './b.bin',
                firmwareVersion: 'b',
                installForFirmwareVersion: ['nothing-matches-this'],
            }),
        ];
        expect(resolveNextFirmware(files, 'a')?.fileId).toBe('b');
    });

    it('takes the last entry in scope for the given model', () => {
        const files = [
            ...CHAIN,
            defineFirmwareFile({
                fileId: 'other-model',
                path: './other.bin',
                firmwareVersion: 'other-1',
                modelNames: ['AC-11-Basic'],
            }),
        ];
        expect(resolveNextFirmware(files, 'x', {modelName: 'AC-22-Pro'})?.fileId).toBe('stable');
        expect(resolveNextFirmware(files, 'x', {modelName: 'AC-11-Basic'})?.fileId).toBe('other-model');
    });

    it('returns undefined when no entry applies to the model', () => {
        expect(resolveNextFirmware(CHAIN, 'x', {modelName: 'Unknown-Model'})).toBeUndefined();
    });
});

describe('resolveFirmwareUpdatePath', () => {
    it('returns the ordered chain to the terminal node in dependent mode', () => {
        const path = resolveFirmwareUpdatePath(CHAIN, 'zz-2024-11-rc3', {
            modelName: 'AC-22-Pro',
            ...DEPENDENT,
        });
        expect(path.map(file => file.fileId)).toEqual(['hotfix-a', 'stable']);
    });

    it('is empty when already up to date', () => {
        expect(resolveFirmwareUpdatePath(CHAIN, '1.0', {modelName: 'AC-22-Pro', ...DEPENDENT})).toEqual([]);
    });

    it('yields at most one step in latest mode', () => {
        const path = resolveFirmwareUpdatePath(CHAIN, 'zz-2024-11-rc3', {modelName: 'AC-22-Pro'});
        expect(path.map(file => file.fileId)).toEqual(['stable']);
    });

    it('terminates on a cyclic graph instead of looping', () => {
        const cyclic = [
            defineFirmwareFile({
                fileId: 'a',
                path: './a.bin',
                firmwareVersion: 'a',
                installForFirmwareVersion: ['b'],
            }),
            defineFirmwareFile({
                fileId: 'b',
                path: './b.bin',
                firmwareVersion: 'b',
                installForFirmwareVersion: ['a'],
            }),
        ];
        expect(resolveFirmwareUpdatePath(cyclic, 'a', DEPENDENT).length).toBeLessThanOrEqual(2);
    });
});

describe('validateFirmwareRegistry', () => {
    it('accepts a well-formed dependent chain', () => {
        const result = validateFirmwareRegistry(definitionWith(CHAIN));
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('accepts a package declaring no firmware', () => {
        expect(validateFirmwareRegistry({permissions: [], compatibility: []}).ok).toBe(true);
    });

    it('rejects firmware declared without the FirmwareRegistry permission', () => {
        const result = validateFirmwareRegistry({
            firmware: CHAIN,
            firmwareMode: EnergyAppPackageFirmwareModeEnum.Dependent,
            permissions: [EnergyAppPermissionTypeEnum.Storage],
            compatibility: [],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.join()).toContain('FirmwareRegistry');
    });

    it('rejects two entries installing for the same version on overlapping models', () => {
        const result = validateFirmwareRegistry(definitionWith([
            ...CHAIN,
            defineFirmwareFile({
                fileId: 'rival',
                path: './rival.bin',
                firmwareVersion: 'rival-1',
                installForFirmwareVersion: ['A7F2'],
                modelNames: ['AC-22-Pro'],
            }),
        ]));
        expect(result.ok).toBe(false);
        expect(result.errors.join()).toContain('ambiguous');
    });

    it('allows the same source version for entries scoped to different models', () => {
        const result = validateFirmwareRegistry(definitionWith([
            ...CHAIN,
            defineFirmwareFile({
                fileId: 'other-model',
                path: './other.bin',
                firmwareVersion: 'other-1',
                installForFirmwareVersion: ['A7F2'],
                modelNames: ['AC-11-Basic'],
            }),
        ]));
        expect(result.ok).toBe(true);
    });

    it('rejects duplicate fileIds', () => {
        const result = validateFirmwareRegistry(definitionWith([
            ...CHAIN,
            defineFirmwareFile({
                fileId: 'stable',
                path: './dup.bin',
                firmwareVersion: 'dup-1',
                installForFirmwareVersion: ['1.0'],
            }),
        ]));
        expect(result.errors.join()).toContain('duplicate fileId');
    });

    it('rejects a cycle', () => {
        const result = validateFirmwareRegistry(definitionWith([
            defineFirmwareFile({
                fileId: 'a',
                path: './a.bin',
                firmwareVersion: 'a',
                installForFirmwareVersion: ['b'],
            }),
            defineFirmwareFile({
                fileId: 'b',
                path: './b.bin',
                firmwareVersion: 'b',
                installForFirmwareVersion: ['a'],
            }),
        ]));
        expect(result.ok).toBe(false);
        expect(result.errors.join()).toContain('cycle');
    });

    it('rejects an entry referencing its own version', () => {
        const result = validateFirmwareRegistry(definitionWith([
            defineFirmwareFile({
                fileId: 'a',
                path: './a.bin',
                firmwareVersion: 'a',
                installForFirmwareVersion: ['a'],
            }),
        ]));
        expect(result.errors.join()).toContain('its own firmwareVersion');
    });

    it('rejects two fallbacks for overlapping models', () => {
        const result = validateFirmwareRegistry(definitionWith([
            ...CHAIN,
            defineFirmwareFile({
                fileId: 'second-fallback',
                path: './fb.bin',
                firmwareVersion: 'fb-1',
                fallbackForUnknownVersion: true,
                modelNames: ['AC-22-Pro'],
            }),
        ]));
        expect(result.errors.join()).toContain('fallbackForUnknownVersion');
    });

    it('rejects duplicate versions in either mode', () => {
        const duplicate = [
            defineFirmwareFile({fileId: 'a', path: './a.bin', firmwareVersion: 'same'}),
            defineFirmwareFile({fileId: 'b', path: './b.bin', firmwareVersion: 'same'}),
        ];
        expect(validateFirmwareRegistry(definitionWith(duplicate)).ok).toBe(false);
        expect(validateFirmwareRegistry(
            definitionWith(duplicate, EnergyAppPackageFirmwareModeEnum.Latest),
        ).ok).toBe(false);
    });

    it('warns, but does not fail, on a source version with no matching node', () => {
        const result = validateFirmwareRegistry(definitionWith([
            defineFirmwareFile({
                fileId: 'attaches-to-legacy',
                path: './a.bin',
                firmwareVersion: 'new-1',
                installForFirmwareVersion: ['shipped-before-the-registry'],
            }),
        ]));
        expect(result.ok).toBe(true);
        expect(result.warnings.join()).toContain('matches no declared firmwareVersion');
    });

    it('warns on a model missing from compatibility', () => {
        const result = validateFirmwareRegistry({
            firmware: CHAIN,
            firmwareMode: EnergyAppPackageFirmwareModeEnum.Dependent,
            permissions: [EnergyAppPermissionTypeEnum.FirmwareRegistry],
            compatibility: [{vendorName: 'Acme', models: [{modelName: 'AC-11-Basic', features: []}]}],
        });
        expect(result.warnings.join()).toContain('AC-22-Pro');
    });
});

describe('validateFirmwareRegistry — latest mode', () => {
    it('accepts a plain list with no graph fields', () => {
        const result = validateFirmwareRegistry(definitionWith([
            defineFirmwareFile({fileId: 'a', path: './a.bin', firmwareVersion: 'a'}),
            defineFirmwareFile({fileId: 'b', path: './b.bin', firmwareVersion: 'b'}),
        ], EnergyAppPackageFirmwareModeEnum.Latest));
        expect(result.ok).toBe(true);
        expect(result.warnings).toEqual([]);
    });

    it('defaults to latest when firmwareMode is omitted', () => {
        const result = validateFirmwareRegistry({
            firmware: [defineFirmwareFile({fileId: 'a', path: './a.bin', firmwareVersion: 'a'})],
            permissions: [EnergyAppPermissionTypeEnum.FirmwareRegistry],
            compatibility: [],
        });
        expect(result.ok).toBe(true);
        expect(result.warnings).toEqual([]);
    });

    it('warns that declared graph fields are ignored', () => {
        const result = validateFirmwareRegistry(
            definitionWith(CHAIN, EnergyAppPackageFirmwareModeEnum.Latest),
        );
        expect(result.ok).toBe(true);
        expect(result.warnings.join()).toContain('installForFirmwareVersion');
        expect(result.warnings.join()).toContain('fallbackForUnknownVersion');
    });

    it('does not report cycles, which cannot occur without a graph', () => {
        const result = validateFirmwareRegistry(definitionWith([
            defineFirmwareFile({
                fileId: 'a',
                path: './a.bin',
                firmwareVersion: 'a',
                installForFirmwareVersion: ['b'],
            }),
            defineFirmwareFile({
                fileId: 'b',
                path: './b.bin',
                firmwareVersion: 'b',
                installForFirmwareVersion: ['a'],
            }),
        ], EnergyAppPackageFirmwareModeEnum.Latest));
        expect(result.ok).toBe(true);
    });
});

describe('assertValidFirmwareRegistry', () => {
    it('throws with every blocking error listed', () => {
        expect(() => assertValidFirmwareRegistry(definitionWith([
            defineFirmwareFile({
                fileId: 'a',
                path: './a.bin',
                firmwareVersion: 'a',
                installForFirmwareVersion: ['a'],
            }),
        ]))).toThrow(FirmwareRegistryValidationError);
    });

    it('passes a valid registry', () => {
        expect(() => assertValidFirmwareRegistry(definitionWith(CHAIN))).not.toThrow();
    });
});
