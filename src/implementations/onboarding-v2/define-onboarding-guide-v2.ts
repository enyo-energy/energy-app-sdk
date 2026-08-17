/**
 * Ergonomic authoring helpers for the onboarding-guide **v2** graph model
 * ({@link EnyoOnboardingV2Guide}).
 *
 * The `defineOnboardingGuideV2()` identity helper plus the block / target /
 * transition factories keep authoring type-checked and terse — mirroring the
 * SDK's `defineEnergyAppPackage()` pattern. All content strings are supplied as
 * {@link EnyoOnboardingTranslatedContent} arrays (de/en). Pair with
 * `validateOnboardingGuideV2()` (`./onboarding-v2-validators.ts`) to fail fast
 * before publishing.
 */

import type {EnyoOnboardingTranslatedContent} from '../../types/enyo-onboarding.js';
import {
    EnyoOnboardingV2ActionKind,
    EnyoOnboardingV2BlockType,
    EnyoOnboardingV2ChoiceLayout,
    EnyoOnboardingV2DeviceSelection,
    EnyoOnboardingV2TargetType,
    EnyoOnboardingV2TransitionSourceKind,
} from '../../types/enyo-onboarding-v2.js';
import type {
    EnyoOnboardingV2ActionOutcome,
    EnyoOnboardingV2Block,
    EnyoOnboardingV2ChoiceOption,
    EnyoOnboardingV2DynamicKind,
    EnyoOnboardingV2Guide,
    EnyoOnboardingV2HintVariant,
    EnyoOnboardingV2InputOutcome,
    EnyoOnboardingV2InputValueType,
    EnyoOnboardingV2PauseReason,
    EnyoOnboardingV2StartVariant,
    EnyoOnboardingV2Target,
    EnyoOnboardingV2Transition,
} from '../../types/enyo-onboarding-v2.js';

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Identity helper that type-checks a v2 guide literal at definition time
 * (mirrors `defineEnergyAppPackage`). Prefer this over a bare object literal so
 * mistakes surface where the guide is written.
 *
 * @param guide - The complete v2 guide graph to author.
 * @returns The same guide, typed as {@link EnyoOnboardingV2Guide}.
 */
export function defineOnboardingGuideV2(
    guide: EnyoOnboardingV2Guide,
): EnyoOnboardingV2Guide {
    return guide;
}

// ---------------------------------------------------------------------------
// Block factories
// ---------------------------------------------------------------------------

/**
 * Typed factories for each content/interactive block. Each returns the
 * corresponding {@link EnyoOnboardingV2Block}, so blocks can be composed inline
 * inside a step's `blocks` array.
 */
export const onboardingV2Block = {
    /**
     * A text block (one or more paragraphs).
     * @param id - Stable block id, unique within the guide.
     * @param text - Translated body text (de/en).
     */
    text: (id: string, text: EnyoOnboardingTranslatedContent[]): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.Text,
        text,
    }),
    /**
     * A sub-heading block.
     * @param id - Stable block id, unique within the guide.
     * @param text - Translated heading text (de/en).
     */
    headline: (id: string, text: EnyoOnboardingTranslatedContent[]): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.Headline,
        text,
    }),
    /**
     * A bulleted list block.
     * @param id - Stable block id, unique within the guide.
     * @param items - One translated entry per bullet (de/en).
     */
    bullets: (
        id: string,
        items: EnyoOnboardingTranslatedContent[][],
    ): EnyoOnboardingV2Block => ({id, type: EnyoOnboardingV2BlockType.Bullets, items}),
    /**
     * An image block.
     * @param id - Stable block id, unique within the guide.
     * @param url - Public asset URL.
     * @param caption - Optional translated caption (de/en).
     */
    image: (
        id: string,
        url: string,
        caption?: EnyoOnboardingTranslatedContent[],
    ): EnyoOnboardingV2Block => ({id, type: EnyoOnboardingV2BlockType.Image, url, caption}),
    /**
     * A hint/callout block.
     * @param id - Stable block id, unique within the guide.
     * @param variant - Visual emphasis (important / info / warning).
     * @param text - Translated callout text (de/en).
     */
    hint: (
        id: string,
        variant: EnyoOnboardingV2HintVariant,
        text: EnyoOnboardingTranslatedContent[],
    ): EnyoOnboardingV2Block => ({id, type: EnyoOnboardingV2BlockType.Hint, variant, text}),
    /**
     * A pre-defined dynamic value block (resolved at runtime from the device).
     * @param id - Stable block id, unique within the guide.
     * @param kind - Which dynamic value to embed (`OcppUrl` | `DeviceIp`).
     */
    dynamic: (id: string, kind: EnyoOnboardingV2DynamicKind): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.Dynamic,
        kind,
    }),
    /**
     * A choice block (single-select routing decision).
     * @param id - Stable block id, unique within the guide.
     * @param options - The selectable options; each is a routing handle.
     * @param opts - Optional translated `prompt` and `layout` (defaults to `Buttons`).
     */
    choice: (
        id: string,
        options: EnyoOnboardingV2ChoiceOption[],
        opts?: {prompt?: EnyoOnboardingTranslatedContent[]; layout?: EnyoOnboardingV2ChoiceLayout},
    ): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.Choice,
        prompt: opts?.prompt,
        layout: opts?.layout ?? EnyoOnboardingV2ChoiceLayout.Buttons,
        options,
    }),
    /**
     * An action block (host capability that branches on its outcome).
     * @param id - Stable block id, unique within the guide.
     * @param action - Which host capability to run (`NetworkScan` | `ConnectionCheck`).
     * @param label - Translated trigger button text (de/en).
     * @param outcomes - The possible results; each is a routing handle.
     */
    action: (
        id: string,
        action: EnyoOnboardingV2ActionKind,
        label: EnyoOnboardingTranslatedContent[],
        outcomes: EnyoOnboardingV2ActionOutcome[],
    ): EnyoOnboardingV2Block => ({id, type: EnyoOnboardingV2BlockType.Action, action, label, outcomes}),
    /**
     * A device-test action block: hand devices to the energy app and branch on
     * whether appliances were found or created.
     *
     * A convenience wrapper over {@link onboardingV2Block.action} that pins the
     * action kind and carries the device selection. Outcome `value`s must be
     * {@link EnyoDeviceTestOutcomeEnum} members — the validator enforces that,
     * and that `failed` is wired, since every breakdown lands there.
     *
     * @param id - Stable block id, unique within the guide.
     * @param label - Translated trigger button text (de/en).
     * @param outcomes - The possible verdicts; each is a routing handle.
     * @param deviceSelection - Which devices to test (defaults to `Detected`).
     */
    deviceTest: (
        id: string,
        label: EnyoOnboardingTranslatedContent[],
        outcomes: EnyoOnboardingV2ActionOutcome[],
        deviceSelection: EnyoOnboardingV2DeviceSelection = EnyoOnboardingV2DeviceSelection.Detected,
    ): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.Action,
        action: EnyoOnboardingV2ActionKind.DeviceTest,
        label,
        outcomes,
        deviceSelection,
    }),
    /**
     * A link block: a fixed URL the installer opens or copies.
     *
     * Passive content — it produces no routing handle, so a step whose only
     * non-content block is a link still routes through `continue`.
     *
     * @param id - Stable block id, unique within the guide.
     * @param url - Absolute `http(s)` URL. Other schemes are rejected by the validator.
     * @param label - Translated link text (de/en).
     * @param opts - Optional translated `description` and `copyable` (defaults to `true`).
     */
    link: (
        id: string,
        url: string,
        label: EnyoOnboardingTranslatedContent[],
        opts?: {description?: EnyoOnboardingTranslatedContent[]; copyable?: boolean},
    ): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.Link,
        url,
        label,
        description: opts?.description,
        copyable: opts?.copyable ?? true,
    }),
    /**
     * An input block: the installer types a value and the host checks it,
     * producing the branch.
     *
     * For {@link EnyoOnboardingV2InputValueType.IpAddress} the host runs this
     * app's registered device-test handler against the typed address; see
     * {@link EnyoOnboardingV2InputBlock} for how a verdict picks an outcome.
     * Route the outcomes with {@link onOutcomeV2} — there is no separate helper.
     *
     * @param id - Stable block id, unique within the guide.
     * @param valueType - What is asked for (`Text` | `IpAddress` | `Number`).
     * @param label - Translated field label (de/en).
     * @param submitLabel - Translated submit button text (de/en).
     * @param outcomes - The possible verdicts; each is a routing handle.
     * @param opts - Optional translated `placeholder` and `help`.
     */
    input: (
        id: string,
        valueType: EnyoOnboardingV2InputValueType,
        label: EnyoOnboardingTranslatedContent[],
        submitLabel: EnyoOnboardingTranslatedContent[],
        outcomes: EnyoOnboardingV2InputOutcome[],
        opts?: {
            placeholder?: EnyoOnboardingTranslatedContent[];
            help?: EnyoOnboardingTranslatedContent[];
        },
    ): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.Input,
        valueType,
        label,
        submitLabel,
        outcomes,
        placeholder: opts?.placeholder,
        help: opts?.help,
    }),
};

// ---------------------------------------------------------------------------
// Target factories
// ---------------------------------------------------------------------------

/** Typed factories for each transition {@link EnyoOnboardingV2Target}. */
export const onboardingV2Target = {
    /**
     * Go to another step in this guide.
     * @param stepId - The target step's id.
     */
    step: (stepId: string): EnyoOnboardingV2Target => ({type: EnyoOnboardingV2TargetType.Step, stepId}),
    /** Exit: onboarding succeeded (hand back to the app). */
    success: (): EnyoOnboardingV2Target => ({type: EnyoOnboardingV2TargetType.Success}),
    /** Exit: escalate to enyo support. */
    support: (): EnyoOnboardingV2Target => ({type: EnyoOnboardingV2TargetType.Support}),
    /**
     * Exit: pause the run (resumable) with a reason.
     * @param reason - Why the run is parked.
     * @param resumeStepName - Optional step `name` to resume at.
     */
    pause: (
        reason: EnyoOnboardingV2PauseReason,
        resumeStepName?: string,
    ): EnyoOnboardingV2Target => ({type: EnyoOnboardingV2TargetType.Pause, reason, resumeStepName}),
    /**
     * Jump into another start variant's flow for the same vendor/model.
     * @param variant - The start variant to hand off to.
     */
    variant: (variant: EnyoOnboardingV2StartVariant): EnyoOnboardingV2Target => ({
        type: EnyoOnboardingV2TargetType.StartVariant,
        variant,
    }),
};

// ---------------------------------------------------------------------------
// Transition factories (deterministic ids from the source handle)
// ---------------------------------------------------------------------------

/**
 * Route the step's plain "continue" button (steps with no interactive block).
 * @param to - Where the continue button leads.
 * @param note - Optional author note.
 */
export function onContinueV2(
    to: EnyoOnboardingV2Target,
    note?: string,
): EnyoOnboardingV2Transition {
    return {id: 'continue', source: {kind: EnyoOnboardingV2TransitionSourceKind.Continue}, target: to, note};
}

/**
 * Route a `Choice` option.
 * @param blockId - The choice block's id.
 * @param optionId - The chosen option's id.
 * @param to - Where picking this option leads.
 * @param note - Optional author note.
 */
export function onOptionV2(
    blockId: string,
    optionId: string,
    to: EnyoOnboardingV2Target,
    note?: string,
): EnyoOnboardingV2Transition {
    return {
        id: `choice:${blockId}:${optionId}`,
        source: {kind: EnyoOnboardingV2TransitionSourceKind.Choice, blockId, optionId},
        target: to,
        note,
    };
}

/**
 * Route an `Action` outcome.
 * @param blockId - The action block's id.
 * @param outcomeId - The fired outcome's id.
 * @param to - Where this outcome leads.
 * @param note - Optional author note.
 */
export function onOutcomeV2(
    blockId: string,
    outcomeId: string,
    to: EnyoOnboardingV2Target,
    note?: string,
): EnyoOnboardingV2Transition {
    return {
        id: `outcome:${blockId}:${outcomeId}`,
        source: {kind: EnyoOnboardingV2TransitionSourceKind.Outcome, blockId, outcomeId},
        target: to,
        note,
    };
}
