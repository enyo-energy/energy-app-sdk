import {describe, expect, it} from 'vitest';
import type {EnergyAppPackagePublicFile} from '../../../energy-app-package-definition.js';
import {definePublicFile, resolvePublicFile} from '../define-public-file.js';
import {
    assertValidPackageFiles,
    isImagePublicFile,
    PackageFilesValidationError,
    validatePackageFiles,
} from '../public-file-validators.js';

/** A valid declaration, overridable field by field for the failure cases. */
const file = (over: Partial<EnergyAppPackagePublicFile> = {}): EnergyAppPackagePublicFile =>
    definePublicFile({name: 'dip-switches', path: './assets/dip-switches.png', ...over});

describe('validatePackageFiles', () => {
    it('accepts an undeclared and an empty list', () => {
        expect(validatePackageFiles(undefined).ok).toBe(true);
        expect(validatePackageFiles([]).ok).toBe(true);
    });

    it('accepts a well-formed declaration', () => {
        const result = validatePackageFiles([file(), file({name: 'wiring', path: 'assets/wiring.jpg'})]);
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it('flags a non-slug name', () => {
        const result = validatePackageFiles([file({name: 'DIP Switches'})]);
        expect(result.errors.some((e) => e.includes('kebab-case slug'))).toBe(true);
    });

    it('flags a duplicate name', () => {
        const result = validatePackageFiles([file(), file({path: './assets/other.png'})]);
        expect(result.errors.some((e) => e.includes('duplicate name'))).toBe(true);
    });

    it.each([
        ['/etc/passwd'],
        ['../../secrets/key.png'],
        ['https://cdn.example.com/dip.png'],
        ['C:\\assets\\dip.png'],
    ])('flags a path escaping the package: %s', (path) => {
        const result = validatePackageFiles([file({path})]);
        expect(result.errors.some((e) => e.includes('relative to the package root'))).toBe(true);
    });

    it('flags a path without an extension', () => {
        const result = validatePackageFiles([file({path: './assets/dip-switches'})]);
        expect(result.errors.some((e) => e.includes('no file extension'))).toBe(true);
    });

    it('flags a malformed mimeType', () => {
        const result = validatePackageFiles([file({mimeType: 'png'})]);
        expect(result.errors.some((e) => e.includes('not a valid MIME type'))).toBe(true);
    });

    it('warns when two names share one path', () => {
        const result = validatePackageFiles([file(), file({name: 'dip-switches-alt'})]);
        expect(result.ok).toBe(true);
        expect(result.warnings.some((w) => w.includes('already declared'))).toBe(true);
    });
});

describe('assertValidPackageFiles', () => {
    it('returns the declarations when they are valid', () => {
        const files = [file()];
        expect(assertValidPackageFiles(files)).toBe(files);
    });

    it('throws with every blocking error', () => {
        expect(() => assertValidPackageFiles([file({name: 'Nope', path: '/abs.png'})])).toThrow(
            PackageFilesValidationError,
        );
    });
});

describe('isImagePublicFile', () => {
    it('judges by extension when no mimeType is declared', () => {
        expect(isImagePublicFile(file({path: './a/b.PNG'}))).toBe(true);
        expect(isImagePublicFile(file({path: './a/manual.pdf'}))).toBe(false);
    });

    it('prefers a declared mimeType over the extension', () => {
        expect(isImagePublicFile(file({path: './a/diagram.bin', mimeType: 'image/png'}))).toBe(true);
        expect(isImagePublicFile(file({path: './a/b.png', mimeType: 'application/pdf'}))).toBe(false);
    });
});

describe('resolvePublicFile', () => {
    it('finds a declared file by name', () => {
        expect(resolvePublicFile([file()], 'dip-switches')?.path).toBe('./assets/dip-switches.png');
    });

    it('returns undefined for an unknown name or no declarations', () => {
        expect(resolvePublicFile([file()], 'nope')).toBeUndefined();
        expect(resolvePublicFile(undefined, 'dip-switches')).toBeUndefined();
    });
});
