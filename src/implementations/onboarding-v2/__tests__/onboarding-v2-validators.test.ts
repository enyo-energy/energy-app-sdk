import {describe, expect, it} from 'vitest';
import type {EnyoOnboardingTranslatedContent} from '../../../types/enyo-onboarding.js';
import {
    EnyoOnboardingV2ActionKind,
    EnyoOnboardingV2BlockType,
    EnyoOnboardingV2ChoiceLayout,
    EnyoOnboardingV2DeviceSelection,
    EnyoOnboardingV2EebusPairOutcome,
    EnyoOnboardingV2InputValueType,
    EnyoOnboardingV2OcppConnectOutcome,
    EnyoOnboardingV2PauseReason,
    EnyoOnboardingV2StartVariant,
    type EnyoOnboardingV2Guide,
    type EnyoOnboardingV2InputOutcome,
} from '../../../types/enyo-onboarding-v2.js';
import {EnyoDeviceTestOutcomeEnum} from '../../../types/enyo-device-test.js';
import {
    defineOnboardingGuideV2,
    onboardingV2Block,
    onboardingV2Target,
    onContinueV2,
    onOptionV2,
    onOutcomeV2,
} from '../define-onboarding-guide-v2.js';
import {
    assertValidOnboardingGuideV2,
    OnboardingV2ValidationError,
    validateOnboardingGuideV2,
} from '../onboarding-v2-validators.js';

/** Short de/en translated-content helper for terse fixtures. */
const t = (de: string, en: string): EnyoOnboardingTranslatedContent[] => [
    {language: 'de', value: de},
    {language: 'en', value: en},
];

/**
 * A minimal, fully-valid guide: an action step branching to a success exit
 * (found) and a support exit (not-found). Exercises the authoring factories.
 */
function validGuide(): EnyoOnboardingV2Guide {
    return defineOnboardingGuideV2({
        title: t('WLAN-Einrichtung', 'Wi-Fi setup'),
        startVariant: EnyoOnboardingV2StartVariant.DeviceNotFound,
        startStepId: 'step-scan',
        steps: [
            {
                id: 'step-scan',
                name: 'scan',
                title: t('Gerät suchen', 'Find the device'),
                blocks: [
                    onboardingV2Block.text('b-intro', t('Suche startet …', 'Scanning …')),
                    onboardingV2Block.action('b-scan', EnyoOnboardingV2ActionKind.NetworkScan, t('Scannen', 'Scan'), [
                        {id: 'found', value: 'found', label: t('Gefunden', 'Found')},
                        {id: 'missing', value: 'not-found', label: t('Nicht gefunden', 'Not found')},
                    ]),
                ],
                transitions: [
                    onOutcomeV2('b-scan', 'found', onboardingV2Target.success()),
                    onOutcomeV2('b-scan', 'missing', onboardingV2Target.support()),
                ],
            },
        ],
    });
}

describe('validateOnboardingGuideV2', () => {
    it('accepts a well-formed guide', () => {
        const result = validateOnboardingGuideV2(validGuide());
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('rejects an empty steps array', () => {
        const result = validateOnboardingGuideV2({...validGuide(), steps: []});
        expect(result.ok).toBe(false);
        expect(result.errors[0]).toContain('`steps` must be a non-empty array');
    });

    it('flags a duplicate step id', () => {
        const guide = validGuide();
        guide.steps.push({...guide.steps[0], name: 'scan-2'});
        const result = validateOnboardingGuideV2(guide);
        expect(result.errors.some((e) => e.includes('duplicate id'))).toBe(true);
    });

    it('flags a non-slug step name', () => {
        const guide = validGuide();
        guide.steps[0].name = 'Not A Slug';
        const result = validateOnboardingGuideV2(guide);
        expect(result.errors.some((e) => e.includes('kebab-case slug'))).toBe(true);
    });

    it('flags a dangling startStepId', () => {
        const result = validateOnboardingGuideV2({...validGuide(), startStepId: 'nope'});
        expect(result.errors.some((e) => e.includes('`startStepId` must reference'))).toBe(true);
    });

    it('flags an unwired routing handle (dead branch)', () => {
        const guide = validGuide();
        guide.steps[0].transitions = [onOutcomeV2('b-scan', 'found', onboardingV2Target.success())];
        const result = validateOnboardingGuideV2(guide);
        expect(result.errors.some((e) => e.includes('has no transition'))).toBe(true);
    });

    it('flags a transition targeting a missing step', () => {
        const guide = validGuide();
        guide.steps[0].transitions = [
            onOutcomeV2('b-scan', 'found', onboardingV2Target.step('ghost')),
            onOutcomeV2('b-scan', 'missing', onboardingV2Target.support()),
        ];
        const result = validateOnboardingGuideV2(guide);
        expect(result.errors.some((e) => e.includes('targets missing step'))).toBe(true);
    });

    it('flags an unknown pause resumeStepName', () => {
        const guide = validGuide();
        guide.steps[0].transitions = [
            onOutcomeV2('b-scan', 'found', onboardingV2Target.success()),
            onOutcomeV2('b-scan', 'missing', onboardingV2Target.pause(EnyoOnboardingV2PauseReason.General, 'ghost-step')),
        ];
        const result = validateOnboardingGuideV2(guide);
        expect(result.errors.some((e) => e.includes('resumeStepName'))).toBe(true);
    });

    it('warns about an unreachable step and no success exit', () => {
        const guide = validGuide();
        // Make both outcomes route to support so there is no success and the extra step is unreachable.
        guide.steps[0].transitions = [
            onOutcomeV2('b-scan', 'found', onboardingV2Target.support()),
            onOutcomeV2('b-scan', 'missing', onboardingV2Target.support()),
        ];
        guide.steps.push({
            id: 'step-orphan',
            name: 'orphan',
            title: t('Waise', 'Orphan'),
            blocks: [onboardingV2Block.text('b-o', t('…', '…'))],
            transitions: [onContinueV2(onboardingV2Target.success())],
        });
        const result = validateOnboardingGuideV2(guide);
        expect(result.ok).toBe(true); // warnings do not block
        expect(result.warnings.some((w) => w.includes('unreachable'))).toBe(true);
    });

    it('validates a choice block wired via onOptionV2', () => {
        const guide = defineOnboardingGuideV2({
            title: t('Auswahl', 'Choice'),
            startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
            startStepId: 's1',
            steps: [
                {
                    id: 's1',
                    name: 'pick',
                    title: t('Wähle', 'Pick'),
                    blocks: [
                        onboardingV2Block.choice(
                            'c1',
                            [
                                {id: 'a', label: t('A', 'A')},
                                {id: 'b', label: t('B', 'B')},
                            ],
                            {prompt: t('Welcher?', 'Which?'), layout: EnyoOnboardingV2ChoiceLayout.List},
                        ),
                    ],
                    transitions: [
                        onOptionV2('c1', 'a', onboardingV2Target.success()),
                        onOptionV2('c1', 'b', onboardingV2Target.support()),
                    ],
                },
            ],
        });
        expect(validateOnboardingGuideV2(guide).ok).toBe(true);
    });
});

describe('device-test action blocks', () => {
    /**
     * A guide whose single step is a device-test action wiring the given outcome
     * values. Every outcome routes to a terminal, so the only findings reported
     * are the device-test rules themselves.
     */
    function guideWithOutcomes(...values: string[]): EnyoOnboardingV2Guide {
        return defineOnboardingGuideV2({
            title: t('Gerät testen', 'Test the device'),
            startVariant: EnyoOnboardingV2StartVariant.DeviceNotFound,
            startStepId: 'step-test',
            steps: [
                {
                    id: 'step-test',
                    name: 'test',
                    title: t('Gerät testen', 'Test the device'),
                    blocks: [
                        onboardingV2Block.deviceTest(
                            'probe',
                            t('Testen', 'Test'),
                            values.map((value, i) => ({id: `o${i}`, value, label: t(value, value)})),
                        ),
                    ],
                    transitions: values.map((_, i) =>
                        onOutcomeV2('probe', `o${i}`, onboardingV2Target.success()),
                    ),
                },
            ],
        });
    }

    it('accepts a block that wires known outcome values including failed', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithOutcomes(
                EnyoDeviceTestOutcomeEnum.AppliancesCreated,
                EnyoDeviceTestOutcomeEnum.Failed,
            ),
        );
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });

    it('defaults the device selection to detected', () => {
        const block = onboardingV2Block.deviceTest('probe', t('Testen', 'Test'), []);
        expect(block).toMatchObject({
            action: EnyoOnboardingV2ActionKind.DeviceTest,
            deviceSelection: EnyoOnboardingV2DeviceSelection.Detected,
        });
    });

    it('rejects an outcome value that is not a device-test outcome', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithOutcomes('found', EnyoDeviceTestOutcomeEnum.Failed),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('not an EnyoDeviceTestOutcomeEnum member'))).toBe(true);
    });

    it('rejects a block that does not wire the failed outcome', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithOutcomes(EnyoDeviceTestOutcomeEnum.AppliancesCreated),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('would have no exit'))).toBe(true);
    });

    it('rejects a duplicated outcome value', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithOutcomes(EnyoDeviceTestOutcomeEnum.Failed, EnyoDeviceTestOutcomeEnum.Failed),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('more than once'))).toBe(true);
    });

    it('warns about each unhandled outcome', () => {
        const {warnings} = validateOnboardingGuideV2(
            guideWithOutcomes(EnyoDeviceTestOutcomeEnum.Failed),
        );
        expect(warnings.some((w) => w.includes('does not handle outcome "not-supported"'))).toBe(true);
    });

    it('warns when a non-device-test action sets a device selection', () => {
        const guide = guideWithOutcomes(EnyoDeviceTestOutcomeEnum.Failed);
        const block = guide.steps[0].blocks[0] as {action: EnyoOnboardingV2ActionKind};
        block.action = EnyoOnboardingV2ActionKind.NetworkScan;
        const {warnings} = validateOnboardingGuideV2(guide);
        expect(warnings.some((w) => w.includes('deviceSelection but is not a device-test action'))).toBe(true);
    });
});

describe('link blocks', () => {
    /**
     * A guide whose single step is a text block plus one link block. A link
     * routes nothing, so the step keeps its plain `continue` handle.
     */
    function guideWithLink(url: string, label = t('Anleitung', 'Manual')): EnyoOnboardingV2Guide {
        return defineOnboardingGuideV2({
            title: t('Anleitung öffnen', 'Open the manual'),
            startVariant: EnyoOnboardingV2StartVariant.DeviceFoundConfig,
            startStepId: 'step-link',
            steps: [
                {
                    id: 'step-link',
                    name: 'anleitung',
                    title: t('Anleitung', 'Manual'),
                    blocks: [
                        onboardingV2Block.text('b-intro', t('Siehe Handbuch.', 'See the manual.')),
                        onboardingV2Block.link('b-link', url, label),
                    ],
                    transitions: [onContinueV2(onboardingV2Target.success())],
                },
            ],
        });
    }

    it('accepts an absolute https url and keeps the step on its continue handle', () => {
        const {ok, errors} = validateOnboardingGuideV2(guideWithLink('https://support.example.com/find-ip'));
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });

    it('accepts an absolute http url', () => {
        expect(validateOnboardingGuideV2(guideWithLink('http://192.168.1.1/')).ok).toBe(true);
    });

    it('defaults copyable to true and carries an optional description', () => {
        const block = onboardingV2Block.link('b-link', 'https://example.com', t('Portal', 'Portal'), {
            description: t('Fritz!Box: Heimnetz', 'Fritz!Box: Home network'),
        });
        expect(block).toMatchObject({
            type: EnyoOnboardingV2BlockType.Link,
            copyable: true,
            description: t('Fritz!Box: Heimnetz', 'Fritz!Box: Home network'),
        });
    });

    it('honours copyable: false', () => {
        const block = onboardingV2Block.link('b-link', 'https://example.com', t('Portal', 'Portal'), {
            copyable: false,
        });
        expect(block).toMatchObject({copyable: false});
    });

    it('rejects a missing url', () => {
        const {ok, errors} = validateOnboardingGuideV2(guideWithLink('   '));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('has no url'))).toBe(true);
    });

    it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', '/relative/path', 'support.example.com'])(
        'rejects the non-http(s) url %s',
        (url) => {
            const {ok, errors} = validateOnboardingGuideV2(guideWithLink(url));
            expect(ok).toBe(false);
            expect(errors.some((e) => e.includes('must be an absolute http(s) URL'))).toBe(true);
        },
    );

    it('warns about a missing label but still validates', () => {
        const {ok, warnings} = validateOnboardingGuideV2(guideWithLink('https://example.com', []));
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('the raw URL is shown instead'))).toBe(true);
    });
});

describe('input blocks', () => {
    /** The outcome set of the canonical `device-not-found` IP-address flow. */
    const ipOutcomes: EnyoOnboardingV2InputOutcome[] = [
        {id: 'ok', value: 'reachable', label: t('Gerät erreichbar', 'Device reachable')},
        {
            id: 'auth',
            value: EnyoDeviceTestOutcomeEnum.AuthenticationRequired,
            label: t('Passwort nötig', 'Password required'),
        },
        {id: 'no', value: 'unreachable', label: t('Nicht erreichbar', 'Not reachable')},
    ];

    /**
     * A guide whose single step asks for a value and routes every outcome to a
     * terminal, so the only findings reported are the input-block rules.
     */
    function guideWithInput(
        valueType: EnyoOnboardingV2InputValueType,
        outcomes: EnyoOnboardingV2InputOutcome[],
        opts?: {label?: EnyoOnboardingTranslatedContent[]; submitLabel?: EnyoOnboardingTranslatedContent[]},
    ): EnyoOnboardingV2Guide {
        return defineOnboardingGuideV2({
            title: t('Wechselrichter einrichten', 'Set up inverter'),
            startVariant: EnyoOnboardingV2StartVariant.DeviceNotFound,
            startStepId: 'step-ip',
            steps: [
                {
                    id: 'step-ip',
                    name: 'geraete-ip-eingeben',
                    title: t('IP-Adresse eingeben', 'Enter the IP address'),
                    blocks: [
                        onboardingV2Block.input(
                            'b-ip',
                            valueType,
                            opts?.label ?? t('IP-Adresse des Geräts', 'Device IP address'),
                            opts?.submitLabel ?? t('Gerät prüfen', 'Check device'),
                            outcomes,
                            {placeholder: t('z. B. 192.168.1.42', 'e.g. 192.168.1.42')},
                        ),
                    ],
                    transitions: outcomes.map((o) =>
                        onOutcomeV2('b-ip', o.id, onboardingV2Target.success()),
                    ),
                },
            ],
        });
    }

    it('accepts the canonical ip-address flow wired via onOutcomeV2', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, ipOutcomes),
        );
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });

    it('collects an outcome handle per input outcome', () => {
        // Dropping a transition must surface as a dead branch — proof that
        // requiredHandleKeys() sees input outcomes at all.
        const guide = guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, ipOutcomes);
        guide.steps[0].transitions = guide.steps[0].transitions.slice(0, 2);
        const {ok, errors} = validateOnboardingGuideV2(guide);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('routing handle "outcome:b-ip:no" has no transition'))).toBe(true);
    });

    it('does not report input transitions as unmatched sources', () => {
        const {errors} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, ipOutcomes),
        );
        expect(errors.some((e) => e.includes('matches no option/outcome'))).toBe(false);
    });

    it('carries the optional placeholder and help through the factory', () => {
        const block = onboardingV2Block.input(
            'b-ip',
            EnyoOnboardingV2InputValueType.Text,
            t('Passwort', 'Password'),
            t('Weiter', 'Continue'),
            ipOutcomes,
            {help: t('Auf dem Typenschild', 'On the type plate')},
        );
        expect(block).toMatchObject({
            type: EnyoOnboardingV2BlockType.Input,
            valueType: EnyoOnboardingV2InputValueType.Text,
            help: t('Auf dem Typenschild', 'On the type plate'),
        });
    });

    it('rejects an unknown valueType', () => {
        const guide = guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, ipOutcomes);
        (guide.steps[0].blocks[0] as {valueType: string}).valueType = 'mac-address';
        const {ok, errors} = validateOnboardingGuideV2(guide);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('unknown valueType "mac-address"'))).toBe(true);
    });

    it('rejects a missing label and submitLabel', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, ipOutcomes, {
                label: [],
                submitLabel: [],
            }),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('has no label'))).toBe(true);
        expect(errors.some((e) => e.includes('has no submitLabel'))).toBe(true);
    });

    it('rejects fewer than two outcomes', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, [ipOutcomes[0]]),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('needs at least 2 outcomes'))).toBe(true);
    });

    it('rejects a duplicate outcome id', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, [
                ipOutcomes[0],
                {...ipOutcomes[2], id: 'ok'},
            ]),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('duplicate outcome id "ok"'))).toBe(true);
    });

    it('rejects a duplicate outcome value', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, [
                ipOutcomes[0],
                {...ipOutcomes[0], id: 'ok2'},
                ipOutcomes[2],
            ]),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('wires outcome value "reachable" more than once'))).toBe(true);
    });

    it('rejects an ip-address block with no positive outcome', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, [
                {id: 'no', value: 'unreachable', label: t('Nicht erreichbar', 'Not reachable')},
                {id: 'fail', value: EnyoDeviceTestOutcomeEnum.Failed, label: t('Fehler', 'Error')},
            ]),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('no outcome for a successful check'))).toBe(true);
    });

    it('rejects an ip-address block with no negative outcome', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, [
                {id: 'ok', value: 'reachable', label: t('Erreichbar', 'Reachable')},
                {
                    id: 'created',
                    value: EnyoDeviceTestOutcomeEnum.AppliancesCreated,
                    label: t('Angelegt', 'Created'),
                },
            ]),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('no outcome for a failed check'))).toBe(true);
    });

    it('counts an exact EnyoDeviceTestOutcomeEnum success member as the positive outcome', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.IpAddress, [
                {
                    id: 'existed',
                    value: EnyoDeviceTestOutcomeEnum.AppliancesAlreadyExisted,
                    label: t('Vorhanden', 'Already there'),
                },
                {id: 'no', value: 'unreachable', label: t('Nicht erreichbar', 'Not reachable')},
            ]),
        );
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });

    it('does not apply the positive/negative rule to text inputs', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.Text, [
                {id: 'a', value: 'entered', label: t('Erfasst', 'Recorded')},
                {id: 'b', value: 'skipped', label: t('Übersprungen', 'Skipped')},
            ]),
        );
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });

    it('warns that a text input runs no check, so extra outcomes are dead branches', () => {
        const {warnings} = validateOnboardingGuideV2(
            guideWithInput(EnyoOnboardingV2InputValueType.Number, [
                {id: 'a', value: 'success', label: t('Erfasst', 'Recorded')},
                {id: 'b', value: 'failure', label: t('Fehler', 'Error')},
            ]),
        );
        expect(warnings.some((w) => w.includes('which runs no check'))).toBe(true);
    });
});

describe('enyo-takeover exit', () => {
    /**
     * A guide whose only exits are the given targets, reached from a two-option
     * choice — so "does the guide complete?" is the only thing under test.
     */
    function guideEndingIn(...targets: ReturnType<typeof onboardingV2Target.support>[]): EnyoOnboardingV2Guide {
        return defineOnboardingGuideV2({
            title: t('Übergabe', 'Hand-off'),
            startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
            startStepId: 's1',
            steps: [
                {
                    id: 's1',
                    name: 'hand-off',
                    title: t('Ende', 'End'),
                    blocks: [
                        onboardingV2Block.choice('c1', [
                            {id: 'a', label: t('A', 'A')},
                            {id: 'b', label: t('B', 'B')},
                        ]),
                    ],
                    transitions: [
                        onOptionV2('c1', 'a', targets[0]!),
                        onOptionV2('c1', 'b', targets[1]!),
                    ],
                },
            ],
        });
    }

    it('treats the enyo-todo hand-off as a completing exit', () => {
        const result = validateOnboardingGuideV2(
            guideEndingIn(onboardingV2Target.enyoTakeover(), onboardingV2Target.support()),
        );
        expect(result.ok).toBe(true);
        expect(result.warnings.some((w) => w.includes('completing exit'))).toBe(false);
    });

    it('still warns when nothing completes the run', () => {
        const result = validateOnboardingGuideV2(
            guideEndingIn(
                onboardingV2Target.support(),
                onboardingV2Target.pause(EnyoOnboardingV2PauseReason.InstallerContacted),
            ),
        );
        expect(result.warnings.some((w) => w.includes('completing exit'))).toBe(true);
    });

    it('warns that a resumeStepName on an enyo-todo hand-off is ignored', () => {
        const result = validateOnboardingGuideV2(
            guideEndingIn(
                onboardingV2Target.pause(EnyoOnboardingV2PauseReason.EnyoTodo, 'hand-off'),
                onboardingV2Target.success(),
            ),
        );
        expect(result.ok).toBe(true);
        expect(result.warnings.some((w) => w.includes('resumeStepName'))).toBe(true);
    });

    it('carries a support reason through the target factory', () => {
        expect(onboardingV2Target.support('firmware-too-old')).toEqual({
            type: 'support',
            reason: 'firmware-too-old',
        });
    });
});

describe('auth blocks', () => {
    /** A guide whose single step is a login routed to success. */
    function loginGuide(): EnyoOnboardingV2Guide {
        return defineOnboardingGuideV2({
            title: t('Anmeldung', 'Sign-in'),
            startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
            startStepId: 's1',
            requiresNetworkScan: false,
            steps: [
                {
                    id: 's1',
                    name: 'login',
                    title: t('Anmelden', 'Sign in'),
                    blocks: [
                        onboardingV2Block.auth(
                            'a1',
                            t('Bei Solarweb anmelden', 'Sign in to Solarweb'),
                            {id: 'ok', label: t('Angemeldet', 'Signed in')},
                            {help: t('Konto des Betreibers', "Operator's account")},
                        ),
                    ],
                    transitions: [onOutcomeV2('a1', 'ok', onboardingV2Target.success())],
                },
            ],
        });
    }

    it('accepts a login step wired through its single success handle', () => {
        const result = validateOnboardingGuideV2(loginGuide());
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('requires the success handle to be wired', () => {
        const guide = loginGuide();
        guide.steps[0]!.transitions = [];
        const result = validateOnboardingGuideV2(guide);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.includes('outcome:a1:ok'))).toBe(true);
    });

    it('rejects a second auth block in the same step', () => {
        const guide = loginGuide();
        guide.steps[0]!.blocks.push(
            onboardingV2Block.auth('a2', t('Nochmal', 'Again'), {id: 'ok2', label: t('OK', 'OK')}),
        );
        guide.steps[0]!.transitions.push(onOutcomeV2('a2', 'ok2', onboardingV2Target.success()));
        const result = validateOnboardingGuideV2(guide);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.includes('at most one login'))).toBe(true);
    });

    it('warns when another decision block offers a way past the login', () => {
        const guide = loginGuide();
        guide.steps[0]!.blocks.push(
            onboardingV2Block.choice('c1', [
                {id: 'skip', label: t('Überspringen', 'Skip')},
                {id: 'stay', label: t('Bleiben', 'Stay')},
            ]),
        );
        guide.steps[0]!.transitions.push(
            onOptionV2('c1', 'skip', onboardingV2Target.success()),
            onOptionV2('c1', 'stay', onboardingV2Target.support()),
        );
        const result = validateOnboardingGuideV2(guide);
        expect(result.warnings.some((w) => w.includes('way past a login'))).toBe(true);
    });
});

describe('ocpp-connect action blocks', () => {
    /** A guide whose single step is an ocpp-connect block wiring `values`. */
    function ocppGuide(...values: string[]): EnyoOnboardingV2Guide {
        return defineOnboardingGuideV2({
            title: t('Wallbox verbinden', 'Connect the wallbox'),
            startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
            startStepId: 's1',
            requiresNetworkScan: false,
            steps: [
                {
                    id: 's1',
                    name: 'await-ocpp',
                    title: t('Warten', 'Waiting'),
                    blocks: [
                        onboardingV2Block.ocppConnect(
                            'o1',
                            t('Verbindung abwarten', 'Wait for the connection'),
                            values.map((value, i) => ({id: `h${i}`, value, label: t(value, value)})),
                        ),
                    ],
                    transitions: values.map((_, i) =>
                        onOutcomeV2('o1', `h${i}`, i === 0 ? onboardingV2Target.success() : onboardingV2Target.support()),
                    ),
                },
            ],
        });
    }

    it('accepts both outcomes wired', () => {
        const result = validateOnboardingGuideV2(
            ocppGuide(
                EnyoOnboardingV2OcppConnectOutcome.Connected,
                EnyoOnboardingV2OcppConnectOutcome.Timeout,
            ),
        );
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('rejects a missing timeout branch', () => {
        const result = validateOnboardingGuideV2(
            ocppGuide(EnyoOnboardingV2OcppConnectOutcome.Connected),
        );
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.includes('"timeout" outcome'))).toBe(true);
    });

    it('rejects an outcome value outside the enum', () => {
        const result = validateOnboardingGuideV2(
            ocppGuide('connected', 'timeout', 'maybe'),
        );
        expect(result.ok).toBe(false);
        expect(
            result.errors.some((e) => e.includes('EnyoOnboardingV2OcppConnectOutcome')),
        ).toBe(true);
    });
});

describe('eebus-pair action blocks', () => {
    /**
     * A guide whose single step pairs an EEBUS device, wiring `values` as its
     * outcomes. Scans first, so only the outcome checks can fire.
     */
    function eebusGuide(...values: string[]): EnyoOnboardingV2Guide {
        return defineOnboardingGuideV2({
            title: t('Wärmepumpe koppeln', 'Pair the heat pump'),
            startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
            startStepId: 's1',
            steps: [
                {
                    id: 's1',
                    name: 'pair',
                    title: t('Koppeln', 'Pair'),
                    blocks: [
                        onboardingV2Block.eebusPair(
                            'e1',
                            t('EEBUS-Gerät auswählen', 'Select the EEBUS device'),
                            values.map((value, i) => ({id: `h${i}`, value, label: t(value, value)})),
                        ),
                    ],
                    transitions: values.map((_, i) =>
                        onOutcomeV2('e1', `h${i}`, i === 0 ? onboardingV2Target.success() : onboardingV2Target.support()),
                    ),
                },
            ],
        });
    }

    it('accepts all three outcomes wired', () => {
        const result = validateOnboardingGuideV2(
            eebusGuide(
                EnyoOnboardingV2EebusPairOutcome.Paired,
                EnyoOnboardingV2EebusPairOutcome.NotFound,
                EnyoOnboardingV2EebusPairOutcome.Failure,
            ),
        );
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it('rejects an outcome value outside the enum', () => {
        const result = validateOnboardingGuideV2(
            eebusGuide(EnyoOnboardingV2EebusPairOutcome.Paired, 'timeout'),
        );
        expect(result.ok).toBe(false);
        expect(
            result.errors.some((e) => e.includes('EnyoOnboardingV2EebusPairOutcome')),
        ).toBe(true);
    });

    it('rejects a duplicated outcome value', () => {
        const result = validateOnboardingGuideV2(
            eebusGuide(
                EnyoOnboardingV2EebusPairOutcome.Paired,
                EnyoOnboardingV2EebusPairOutcome.Paired,
            ),
        );
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.includes('more than once'))).toBe(true);
    });

    it('warns when the positive branch is missing', () => {
        const result = validateOnboardingGuideV2(
            eebusGuide(
                EnyoOnboardingV2EebusPairOutcome.NotFound,
                EnyoOnboardingV2EebusPairOutcome.Failure,
            ),
        );
        expect(result.warnings.some((w) => w.includes('"paired" outcome'))).toBe(true);
    });

    it('warns when a scan-free guide pairs without scanning itself', () => {
        const guide = eebusGuide(
            EnyoOnboardingV2EebusPairOutcome.Paired,
            EnyoOnboardingV2EebusPairOutcome.NotFound,
            EnyoOnboardingV2EebusPairOutcome.Failure,
        );
        guide.requiresNetworkScan = false;
        const result = validateOnboardingGuideV2(guide);
        expect(result.ok).toBe(true);
        expect(result.warnings.some((w) => w.includes('empty'))).toBe(true);
    });

    it('stays quiet when the scan-free guide scans itself first', () => {
        const guide = eebusGuide(
            EnyoOnboardingV2EebusPairOutcome.Paired,
            EnyoOnboardingV2EebusPairOutcome.NotFound,
            EnyoOnboardingV2EebusPairOutcome.Failure,
        );
        guide.requiresNetworkScan = false;
        guide.steps.unshift({
            id: 's0',
            name: 'scan',
            title: t('Scannen', 'Scan'),
            blocks: [
                onboardingV2Block.action('b-scan', EnyoOnboardingV2ActionKind.NetworkScan, t('Scannen', 'Scan'), [
                    {id: 'found', value: 'found', label: t('Gefunden', 'Found')},
                    {id: 'none', value: 'not-found', label: t('Nichts', 'Nothing')},
                ]),
            ],
            transitions: [
                onOutcomeV2('b-scan', 'found', onboardingV2Target.step('s1')),
                onOutcomeV2('b-scan', 'none', onboardingV2Target.support()),
            ],
        });
        guide.startStepId = 's0';
        const result = validateOnboardingGuideV2(guide);
        expect(result.warnings.some((w) => w.includes('requiresNetworkScan'))).toBe(false);
    });
});

describe('requiresNetworkScan', () => {
    it('warns when a scan-free guide device-tests detected devices', () => {
        const guide = defineOnboardingGuideV2({
            title: t('Ohne Scan', 'No scan'),
            startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
            startStepId: 's1',
            requiresNetworkScan: false,
            steps: [
                {
                    id: 's1',
                    name: 'probe',
                    title: t('Prüfen', 'Probe'),
                    blocks: [
                        onboardingV2Block.deviceTest(
                            'd1',
                            t('Prüfen', 'Probe'),
                            [
                                {
                                    id: 'ok',
                                    value: EnyoDeviceTestOutcomeEnum.AppliancesCreated,
                                    label: t('OK', 'OK'),
                                },
                                {id: 'no', value: EnyoDeviceTestOutcomeEnum.Failed, label: t('Fehler', 'Failed')},
                            ],
                            EnyoOnboardingV2DeviceSelection.Detected,
                        ),
                    ],
                    transitions: [
                        onOutcomeV2('d1', 'ok', onboardingV2Target.success()),
                        onOutcomeV2('d1', 'no', onboardingV2Target.support()),
                    ],
                },
            ],
        });
        const result = validateOnboardingGuideV2(guide);
        expect(result.ok).toBe(true);
        expect(result.warnings.some((w) => w.includes('requiresNetworkScan'))).toBe(true);
    });

    it('stays quiet for a scan-free guide that does not depend on detected devices', () => {
        const result = validateOnboardingGuideV2(
            defineOnboardingGuideV2({
                title: t('Ohne Scan', 'No scan'),
                startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
                startStepId: 's1',
                requiresNetworkScan: false,
                steps: [
                    {
                        id: 's1',
                        name: 'done',
                        title: t('Fertig', 'Done'),
                        blocks: [onboardingV2Block.text('b1', t('Fertig', 'Done'))],
                        transitions: [onContinueV2(onboardingV2Target.success())],
                    },
                ],
            }),
        );
        expect(result.warnings.some((w) => w.includes('requiresNetworkScan'))).toBe(false);
    });
});

describe('assertValidOnboardingGuideV2', () => {
    it('returns the guide when valid', () => {
        const guide = validGuide();
        expect(assertValidOnboardingGuideV2(guide)).toBe(guide);
    });

    it('throws OnboardingV2ValidationError with the errors when invalid', () => {
        let thrown: unknown;
        try {
            assertValidOnboardingGuideV2({...validGuide(), steps: []});
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBeInstanceOf(OnboardingV2ValidationError);
        expect((thrown as OnboardingV2ValidationError).errors.length).toBeGreaterThan(0);
    });
});
