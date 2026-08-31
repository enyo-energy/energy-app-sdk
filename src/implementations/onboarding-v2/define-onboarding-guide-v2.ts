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
    EnyoOnboardingV2PauseReason,
    EnyoOnboardingV2TargetType,
    EnyoOnboardingV2TransitionSourceKind,
} from '../../types/enyo-onboarding-v2.js';
import type {
    EnyoOnboardingV2ActionOutcome,
    EnyoOnboardingV2AuthOutcome,
    EnyoOnboardingV2SetupField,
    EnyoOnboardingV2SetupOutcome,
    EnyoOnboardingV2SetupSkipHandle,
    EnyoOnboardingV2Block,
    EnyoOnboardingV2ChoiceOption,
    EnyoOnboardingV2DynamicKind,
    EnyoOnboardingV2Guide,
    EnyoOnboardingV2HintVariant,
    EnyoOnboardingV2InputOutcome,
    EnyoOnboardingV2InputValueType,
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
     * An image block addressing an externally hosted image by URL.
     *
     * Prefer {@link block.imageFile} for an image that lives in the app
     * repository: nothing mirrors the URL passed here, so the guide is only as
     * available as the host serving it.
     *
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
     * An image block addressing a file shipped with the package.
     *
     * The file must be declared in the package definition's `files`
     * ({@link EnergyAppPackagePublicFile}); the enyo CLI uploads it on release
     * and enyo resolves the name to a public URL when the guide is rendered.
     * Pass the package's declarations to `validateOnboardingGuideV2()` to have
     * a mistyped name rejected before publishing.
     *
     * @param id - Stable block id, unique within the guide.
     * @param file - Name of the declared package file, e.g. `'dip-switches'`.
     * @param caption - Optional translated caption (de/en).
     *
     * @example
     * ```typescript
     * block.imageFile('dip', 'dip-switches', [
     *     {language: 'de', value: 'DIP-Schalter hinter der Frontblende'},
     *     {language: 'en', value: 'DIP switches behind the front cover'}
     * ])
     * ```
     */
    imageFile: (
        id: string,
        file: string,
        caption?: EnyoOnboardingTranslatedContent[],
    ): EnyoOnboardingV2Block => ({id, type: EnyoOnboardingV2BlockType.Image, file, caption}),
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
     * An OCPP-connect action block: wait for the charger to dial into enyo's
     * CSMS after the installer has entered the dynamic OCPP URL in it.
     *
     * A convenience wrapper over {@link onboardingV2Block.action} that pins the
     * action kind. Nothing is searched — an OCPP wallbox is never on the LAN, so
     * {@link EnyoOnboardingV2ActionKind.NetworkScan} is not a substitute. Pair it
     * with an {@link onboardingV2Block.dynamic} `ocpp-url` block on the same or a
     * preceding step.
     *
     * Outcome `value`s must be {@link EnyoOnboardingV2OcppConnectOutcome} members
     * and both must be wired — the validator enforces that, since a charger that
     * never calls home is the common case.
     *
     * @param id - Stable block id, unique within the guide.
     * @param label - Translated trigger button text (de/en).
     * @param outcomes - The `connected` / `timeout` results; each is a routing handle.
     */
    ocppConnect: (
        id: string,
        label: EnyoOnboardingTranslatedContent[],
        outcomes: EnyoOnboardingV2ActionOutcome[],
    ): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.Action,
        action: EnyoOnboardingV2ActionKind.OcppConnect,
        label,
        outcomes,
    }),
    /**
     * An EEBUS-pair action block: the installer picks one of the discovered
     * EEBUS peers and the host trusts its SKI.
     *
     * A convenience wrapper over {@link onboardingV2Block.action} that pins the
     * action kind. The picker is drawn from what mDNS discovery found, so the
     * guide must have scanned — keep
     * {@link EnyoOnboardingV2Guide.requiresNetworkScan} at its default or place
     * a {@link EnyoOnboardingV2ActionKind.NetworkScan} block ahead of this one.
     *
     * Most EEBUS devices only announce themselves once pairing is enabled in
     * their own menu or portal, and many ask for a confirmation there while the
     * handshake runs, so put that instruction in a text/hint block on the
     * preceding step — the app cannot do it for the installer.
     *
     * Outcome `value`s must be {@link EnyoOnboardingV2EebusPairOutcome} members;
     * route `not-found` to troubleshooting and `failure` to a step describing
     * the confirmation on the device. A retry must lead into a *second* pairing
     * step: a back-edge onto the same step reads as a loop and ends the run.
     *
     * @param id - Stable block id, unique within the guide.
     * @param label - Translated trigger button text (de/en).
     * @param outcomes - The `paired` / `not-found` / `failure` results; each is a routing handle.
     */
    eebusPair: (
        id: string,
        label: EnyoOnboardingTranslatedContent[],
        outcomes: EnyoOnboardingV2ActionOutcome[],
    ): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.Action,
        action: EnyoOnboardingV2ActionKind.EebusPair,
        label,
        outcomes,
    }),
    /**
     * An auth block: the installer signs into the energy app's own account
     * system (OAuth / vendor portal).
     *
     * Exactly one routing handle, and it means "the login succeeded". The server
     * decides when it fires, so the installer cannot skip it; there is no failure
     * branch to author — a failed attempt simply keeps them on the step. Route
     * the handle with {@link onOutcomeV2}, passing `outcome.id`.
     *
     * @param id - Stable block id, unique within the guide.
     * @param label - Translated sign-in button text (de/en).
     * @param outcome - The single success handle (`{id, label}`).
     * @param opts - Optional translated `help` naming the account that is needed,
     *   and `requiresWebAuthentication` to force the login into a web browser
     *   when the provider rejects a custom-scheme redirect such as `enyoapp://`.
     */
    auth: (
        id: string,
        label: EnyoOnboardingTranslatedContent[],
        outcome: EnyoOnboardingV2AuthOutcome,
        opts?: {
            help?: EnyoOnboardingTranslatedContent[];
            requiresWebAuthentication?: boolean;
        },
    ): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.Auth,
        label,
        outcome,
        help: opts?.help,
        requiresWebAuthentication: opts?.requiresWebAuthentication,
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
    /**
     * An additional-setup block: collect zero or more values, hand them to this
     * energy app, and branch on the verdict the app returns.
     *
     * The only interactive block the app itself judges — use it for a vendor API
     * key, a service token, an installer code. Keep
     * {@link onboardingV2Block.auth} for the app's own OAuth session, whose
     * server gating this cannot replace.
     *
     * `outcomes` must contain at least two entries, one of them valued `failed`
     * ({@link ENYO_ONBOARDING_V2_SETUP_FAILED_OUTCOME}) — every breakdown lands
     * there, including an outcome the handler returns that no branch declares.
     * Route each outcome with {@link onOutcomeV2} and the optional skip with
     * {@link onSkipV2}.
     *
     * `Password` and `Token` fields are treated as secrets: masked, never logged,
     * never prefilled, and not persisted in run state.
     *
     * @param id - Stable block id, unique within the guide.
     * @param setupKey - App-facing key the handler switches on; may repeat across guides.
     * @param opts - `cta` and `description` (both translated, both required),
     *   optional `fields`, the `outcomes`, and an optional `skip` handle.
     *
     * @example
     * ```typescript
     * onboardingV2Block.additionalSetup('cloud', 'vendor-cloud-token', {
     *     cta: t('Cloud verbinden', 'Connect the cloud'),
     *     description: t('Optional: bessere Prognosen.', 'Optional: better forecasts.'),
     *     fields: [{
     *         name: 'api-token',
     *         type: EnyoOnboardingV2SetupFieldType.Token,
     *         label: t('API-Token', 'API token'),
     *     }],
     *     outcomes: [
     *         {id: 'ok',     value: 'connected', label: t('Verbunden', 'Connected')},
     *         {id: 'failed', value: 'failed',    label: t('Fehlgeschlagen', 'Failed')},
     *     ],
     *     skip: {id: 'later', label: t('Später', 'Later')},
     * })
     * ```
     */
    additionalSetup: (
        id: string,
        setupKey: string,
        opts: {
            cta: EnyoOnboardingTranslatedContent[];
            description: EnyoOnboardingTranslatedContent[];
            fields?: EnyoOnboardingV2SetupField[];
            outcomes: EnyoOnboardingV2SetupOutcome[];
            skip?: EnyoOnboardingV2SetupSkipHandle;
        },
    ): EnyoOnboardingV2Block => ({
        id,
        type: EnyoOnboardingV2BlockType.AdditionalSetup,
        setupKey,
        cta: opts.cta,
        description: opts.description,
        fields: opts.fields,
        outcomes: opts.outcomes,
        skip: opts.skip,
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
    /**
     * Exit: escalate to enyo support.
     * @param reason - Optional short internal key describing what failed, e.g.
     * `firmware-too-old`. Never shown to the installer; it travels with the
     * hand-off so support knows why it arrived.
     */
    support: (reason?: string): EnyoOnboardingV2Target => ({
        type: EnyoOnboardingV2TargetType.Support,
        reason,
    }),
    /**
     * Exit: pause the run (resumable) with a reason.
     *
     * For {@link EnyoOnboardingV2PauseReason.EnyoTodo} prefer
     * {@link onboardingV2Target.enyoTakeover} — that reason is a terminal
     * hand-off, not a park, and `resumeStepName` does not apply to it.
     *
     * @param reason - Why the run is parked.
     * @param resumeStepName - Optional step `name` to resume at.
     */
    pause: (
        reason: EnyoOnboardingV2PauseReason,
        resumeStepName?: string,
    ): EnyoOnboardingV2Target => ({type: EnyoOnboardingV2TargetType.Pause, reason, resumeStepName}),
    /**
     * Exit: **enyo übernimmt** — the installer is done and enyo finishes the
     * setup. A terminal exit alongside `success` and `support`: the app shows the
     * takeover screen rather than returning to the cockpit.
     *
     * Emits the unchanged wire shape (`pause` with reason `enyo-todo`), and
     * counts as a completing exit for {@link validateOnboardingGuideV2} — a guide
     * that only ends here needs no `success` branch.
     */
    enyoTakeover: (): EnyoOnboardingV2Target => ({
        type: EnyoOnboardingV2TargetType.Pause,
        reason: EnyoOnboardingV2PauseReason.EnyoTodo,
    }),
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
 * Route the skip handle of an `AdditionalSetup` block.
 *
 * Only an optional setup has one. It leaves the block without a verdict, so
 * nothing is collected and the handler is never called — which is what keeps a
 * failing bonus feature from blocking an otherwise finished onboarding.
 *
 * @param blockId - The additional-setup block's id.
 * @param skipId - The skip handle's id.
 * @param to - Where skipping leads.
 * @param note - Optional author note.
 */
export function onSkipV2(
    blockId: string,
    skipId: string,
    to: EnyoOnboardingV2Target,
    note?: string,
): EnyoOnboardingV2Transition {
    return {
        id: `skip:${blockId}:${skipId}`,
        source: {kind: EnyoOnboardingV2TransitionSourceKind.Skip, blockId, skipId},
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
