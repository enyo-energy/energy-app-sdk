/**
 * Onboarding guide **v2** — the structured, multilingual **graph** authoring model
 * for enyo energy-app setup guides.
 *
 * This supersedes the linear v1 model (`EnyoOnboardingGuide` in
 * {@link ./enyo-onboarding.ts}). Where v1 is an ordered list of steps with
 * name-string routing, v2 is a **directed graph**: an energy app defines a guide
 * as a set of named steps connected by explicit {@link EnyoOnboardingV2Transition}s.
 * The installer walks it, branching on choices and device checks, and leaves through
 * one of three exits (success / paused / support) — or jumps into another start
 * variant's flow.
 *
 * Every author-facing string is an {@link EnyoOnboardingTranslatedContent} array
 * (de/en), reusing the v1 translation primitive so the two models stay consistent.
 *
 * Pure type declarations (no runtime logic). Use `defineOnboardingGuideV2()` and the
 * block/target/transition helpers (see
 * `../implementations/onboarding-v2/define-onboarding-guide-v2.ts`) for ergonomic,
 * type-checked authoring, and `validateOnboardingGuideV2()`
 * (`../implementations/onboarding-v2/onboarding-v2-validators.ts`) to fail fast
 * before publishing.
 */

import type {EnyoOnboardingTranslatedContent} from './enyo-onboarding.js';

// ---------------------------------------------------------------------------
// Enumerable string enums
// ---------------------------------------------------------------------------

/**
 * The situation a flow starts from. A vendor/model can have up to one guide per
 * variant; a branch can jump into another variant's flow
 * (see {@link EnyoOnboardingV2Target}).
 */
export enum EnyoOnboardingV2StartVariant {
    /** No network device was found — the installer must locate/connect it. */
    DeviceNotFound = 'device-not-found',
    /** The device is on the network but still needs configuration. */
    DeviceFoundConfig = 'device-found-config',
    /** Manual setup is required by the user (e.g. enter OCPP URL). */
    ManualSetup = 'manual-setup',
}

/** Why an onboarding run was parked; drives how it's picked back up. */
export enum EnyoOnboardingV2PauseReason {
    /** enyo needs to solve something before the installer can continue. */
    EnyoTodo = 'enyo-todo',
    /** The installer was contacted and follow-up is pending. */
    InstallerContacted = 'installer-contacted',
    /** Generic pause. */
    General = 'general',
}

/** Visual emphasis of a hint block. */
export enum EnyoOnboardingV2HintVariant {
    Important = 'important',
    Info = 'info',
    Warning = 'warning',
}

/**
 * A pre-defined dynamic value the host resolves at runtime against the device.
 * (Custom/free-form dynamic content is intentionally not supported.)
 */
export enum EnyoOnboardingV2DynamicKind {
    /** The device's OCPP / CSMS URL (copyable). */
    OcppUrl = 'ocpp-url',
    /** The device's local IP address / link to its UI. */
    DeviceIp = 'device-ip',
}

/** A host-app capability an `action` block triggers and branches on. */
export enum EnyoOnboardingV2ActionKind {
    /** Scan the local network for the device; outcomes: found / not-found. */
    NetworkScan = 'network-scan',
    /** Test the connection; outcomes: success / failure. */
    ConnectionCheck = 'connection-check',
    /**
     * Hand detected devices to the energy app for testing, and branch on whether
     * appliances were found or created.
     *
     * Unlike the other kinds this is not something the host can answer alone: it
     * calls the app's registered
     * {@link EnyoDeviceTestHandler} (see {@link EnergyAppDeviceTest}) and waits.
     * The outcomes of such a block MUST use {@link EnyoDeviceTestOutcomeEnum}
     * values, and {@link EnyoOnboardingV2ActionBlock.deviceSelection} decides
     * which devices are passed along.
     */
    DeviceTest = 'device-test',
}

/**
 * What an {@link EnyoOnboardingV2InputBlock} asks the installer for. Drives the
 * keyboard the app shows, the format check it applies and the seeded texts.
 */
export enum EnyoOnboardingV2InputValueType {
    /** Free text; any non-empty value is accepted. */
    Text = 'text',
    /** An IPv4 address. This is the only type the host actually checks. */
    IpAddress = 'ip-address',
    /** A number; `,` and `.` are both accepted as the decimal separator. */
    Number = 'number',
}

/**
 * Which devices a {@link EnyoOnboardingV2ActionKind.DeviceTest} block hands to
 * the app.
 */
export enum EnyoOnboardingV2DeviceSelection {
    /** Everything the preceding `network-scan` in this run turned up. */
    Detected = 'detected',
    /** Only the single device the run is already bound to. */
    Current = 'current',
    /** The installer picks from the detected devices before the test runs. */
    UserSelected = 'user-selected',
}

/** Icon shown for the guide in the library (falls back to `Connector`). */
export enum EnyoOnboardingV2IconKey {
    Grid = 'grid',
    Meter = 'meter',
    Solar = 'solar',
    Connector = 'connector',
}

/** How a choice block is rendered. */
export enum EnyoOnboardingV2ChoiceLayout {
    Buttons = 'buttons',
    List = 'list',
}

// ---------------------------------------------------------------------------
// Content & interactive blocks
// ---------------------------------------------------------------------------

/** Discriminator for the {@link EnyoOnboardingV2Block} union. */
export enum EnyoOnboardingV2BlockType {
    Text = 'text',
    Headline = 'headline',
    Bullets = 'bullets',
    Image = 'image',
    Hint = 'hint',
    Dynamic = 'dynamic',
    Choice = 'choice',
    Action = 'action',
    Link = 'link',
    Input = 'input',
}

/** Fields shared by every content/interactive block. */
export interface EnyoOnboardingV2BlockBase {
    /**
     * Stable id, unique within the guide. Referenced by transitions for
     * `Choice`/`Action` blocks.
     */
    id: string;
}

/** One or more paragraphs (a blank line starts a new paragraph). */
export interface EnyoOnboardingV2TextBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Text;
    /** Translated body text (de/en). */
    text: EnyoOnboardingTranslatedContent[];
}

/** A sub-heading inside a step. */
export interface EnyoOnboardingV2HeadlineBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Headline;
    /** Translated heading text (de/en). */
    text: EnyoOnboardingTranslatedContent[];
}

/** A bulleted list; each bullet is independently translated. */
export interface EnyoOnboardingV2BulletsBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Bullets;
    /** One translated entry per bullet (non-empty). */
    items: EnyoOnboardingTranslatedContent[][];
}

/** An image with an optional caption. */
export interface EnyoOnboardingV2ImageBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Image;
    /** A public asset URL (not translated). */
    url: string;
    /** Optional translated caption (de/en). */
    caption?: EnyoOnboardingTranslatedContent[];
}

/** A callout (important / info / warning). */
export interface EnyoOnboardingV2HintBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Hint;
    variant: EnyoOnboardingV2HintVariant;
    /** Translated callout text (de/en). */
    text: EnyoOnboardingTranslatedContent[];
}

/** A pre-defined dynamic value resolved at runtime from the device. */
export interface EnyoOnboardingV2DynamicBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Dynamic;
    kind: EnyoOnboardingV2DynamicKind;
}

/**
 * A single answer of an {@link EnyoOnboardingV2ChoiceBlock}; each option is a
 * routing handle.
 */
export interface EnyoOnboardingV2ChoiceOption {
    /** Stable id, unique within the block; referenced by a transition. */
    id: string;
    /** The translated button/label text shown to the installer (de/en). */
    label: EnyoOnboardingTranslatedContent[];
}

/**
 * A button group / single-select. The installer picks exactly one option, which
 * routes the flow. Each option MUST have exactly one outgoing transition.
 */
export interface EnyoOnboardingV2ChoiceBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Choice;
    /** Optional translated question shown above the options (de/en). */
    prompt?: EnyoOnboardingTranslatedContent[];
    layout: EnyoOnboardingV2ChoiceLayout;
    options: EnyoOnboardingV2ChoiceOption[];
}

/**
 * A possible result of an {@link EnyoOnboardingV2ActionBlock}; each outcome is a
 * routing handle.
 */
export interface EnyoOnboardingV2ActionOutcome {
    /** Stable id, unique within the block; referenced by a transition. */
    id: string;
    /** Semantic key (e.g. `found`, `not-found`, `success`, `failure`); not translated. */
    value: string;
    /** Translated display label for the outcome (de/en). */
    label: EnyoOnboardingTranslatedContent[];
}

/**
 * A host capability the installer triggers (or the app runs), branching on the
 * result. Each outcome MUST have exactly one outgoing transition.
 */
export interface EnyoOnboardingV2ActionBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Action;
    action: EnyoOnboardingV2ActionKind;
    /** Translated trigger button text, e.g. "Netzwerk scannen" (de/en). */
    label: EnyoOnboardingTranslatedContent[];
    outcomes: EnyoOnboardingV2ActionOutcome[];
    /**
     * Which devices to hand to the app. Only meaningful for
     * {@link EnyoOnboardingV2ActionKind.DeviceTest}; ignored by the other kinds.
     * Defaults to {@link EnyoOnboardingV2DeviceSelection.Detected}.
     */
    deviceSelection?: EnyoOnboardingV2DeviceSelection;
}

/**
 * A fixed URL the installer opens or copies — a vendor portal, a manual, a
 * firmware download.
 *
 * Passive content: it produces no routing handle, so a step whose only
 * non-content block is a link still routes through its single `continue`
 * handle. Unlike {@link EnyoOnboardingV2DynamicBlock}, the URL is the same for
 * every installer — nothing is resolved per device.
 */
export interface EnyoOnboardingV2LinkBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Link;
    /**
     * Absolute `http(s)` URL, not translated. Any other scheme is rejected by
     * the validator and by the host: the installer app renders this as a tap
     * target.
     */
    url: string;
    /** Translated link text (de/en). Falls back to the raw URL when empty. */
    label: EnyoOnboardingTranslatedContent[];
    /** Optional translated context line below the link (de/en). */
    description?: EnyoOnboardingTranslatedContent[];
    /**
     * Show a copy-to-clipboard button. Defaults to `true` — on a phone it is the
     * more useful affordance of the two.
     */
    copyable?: boolean;
}

/**
 * A possible verdict of an {@link EnyoOnboardingV2InputBlock}'s check; each
 * outcome is a routing handle.
 */
export interface EnyoOnboardingV2InputOutcome {
    /** Stable id, unique within the block; referenced by a transition. */
    id: string;
    /**
     * Semantic key, not translated. Either an {@link EnyoDeviceTestOutcomeEnum}
     * member (routed exactly) or one of the binary keys the host collapses
     * onto — `reachable` / `unreachable`. See {@link EnyoOnboardingV2InputBlock}
     * for the full mapping.
     */
    value: string;
    /** Translated display label for the verdict (de/en). */
    label: EnyoOnboardingTranslatedContent[];
}

/**
 * The installer types a value and the **host** checks it, producing the branch —
 * unlike {@link EnyoOnboardingV2ChoiceBlock}, where the installer picks the
 * branch directly.
 *
 * For {@link EnyoOnboardingV2InputValueType.IpAddress} the host pairs the typed
 * address with this energy app (creating the network device when the scan never
 * discovered it) and runs the app's registered {@link EnyoDeviceTestHandler}
 * against it, so the verdict is the app's own — it confirms *your* device, not
 * merely a live host. `Text` and `Number` are recorded and take the positive
 * branch; there is nothing the host could check about them.
 *
 * Each outcome MUST have exactly one outgoing transition.
 *
 * **How a verdict picks an outcome**
 *
 * 1. *Exact match wins.* An outcome whose `value` is an
 *    {@link EnyoDeviceTestOutcomeEnum} member receives that verdict verbatim —
 *    so a guide can route `authentication-required` to a credentials step and
 *    `user-action-required` to a "press the pairing button" step.
 * 2. *Otherwise it collapses to a binary pair.* `appliances-created`,
 *    `appliances-already-existed` and `device-confirmed-no-appliance` go to the
 *    first outcome valued `reachable` / `success` / `found`; everything else
 *    (`unreachable`, `not-supported`, `authentication-required`,
 *    `access-not-granted`, `user-action-required`, `failed`) goes to the first
 *    outcome valued `unreachable` / `failure` / `failed` / `not-found`.
 * 3. `Text` and `Number` run no check: the value is recorded and the flow takes
 *    the positive outcome (first `reachable`/`success`/`found`, else the first
 *    outcome). Any further outcome on such a block can never fire.
 * 4. An offline hub, a package that is not installed, or no energy app linked to
 *    the vendor/model all resolve to the **negative** branch — never an error.
 *    The guide always gets an outcome to route on.
 *
 * The typed value is persisted per block in the run state and handed back on
 * resume/back, so a typo is corrected rather than retyped. Values may be secrets
 * (a device password typed into a `Text` input): the host logs outcome keys
 * only, never the value itself.
 *
 * @example
 * ```ts
 * onboardingV2Block.input(
 *     'b3',
 *     EnyoOnboardingV2InputValueType.IpAddress,
 *     t('IP-Adresse des Geräts', 'Device IP address'),
 *     t('Gerät prüfen', 'Check device'),
 *     [
 *         {id: 'ok', value: 'reachable', label: t('Gerät erreichbar', 'Device reachable')},
 *         {
 *             id: 'auth',
 *             value: EnyoDeviceTestOutcomeEnum.AuthenticationRequired,
 *             label: t('Passwort nötig', 'Password required'),
 *         },
 *         {id: 'no', value: 'unreachable', label: t('Nicht erreichbar', 'Not reachable')},
 *     ],
 *     {placeholder: t('z. B. 192.168.1.42', 'e.g. 192.168.1.42')},
 * );
 * ```
 */
export interface EnyoOnboardingV2InputBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Input;
    /** What is asked for; drives keyboard, format check and seeded texts. */
    valueType: EnyoOnboardingV2InputValueType;
    /** Translated field label, e.g. "IP-Adresse des Geräts" (de/en). */
    label: EnyoOnboardingTranslatedContent[];
    /** Optional translated placeholder, e.g. "z. B. 192.168.1.42" (de/en). */
    placeholder?: EnyoOnboardingTranslatedContent[];
    /** Optional translated help text — where the installer finds the value (de/en). */
    help?: EnyoOnboardingTranslatedContent[];
    /** Translated submit button text, e.g. "Gerät prüfen" (de/en). */
    submitLabel: EnyoOnboardingTranslatedContent[];
    /** The possible verdicts; each is a routing handle. At least 2. */
    outcomes: EnyoOnboardingV2InputOutcome[];
}

/** Any block that can appear in a step's `blocks`. */
export type EnyoOnboardingV2Block =
    | EnyoOnboardingV2TextBlock
    | EnyoOnboardingV2HeadlineBlock
    | EnyoOnboardingV2BulletsBlock
    | EnyoOnboardingV2ImageBlock
    | EnyoOnboardingV2HintBlock
    | EnyoOnboardingV2DynamicBlock
    | EnyoOnboardingV2ChoiceBlock
    | EnyoOnboardingV2ActionBlock
    | EnyoOnboardingV2LinkBlock
    | EnyoOnboardingV2InputBlock;

/**
 * Blocks that produce routing handles (a step's decision points).
 *
 * A {@link EnyoOnboardingV2LinkBlock} is deliberately absent: it is passive
 * content and routes nothing.
 */
export type EnyoOnboardingV2InteractiveBlock =
    | EnyoOnboardingV2ChoiceBlock
    | EnyoOnboardingV2ActionBlock
    | EnyoOnboardingV2InputBlock;

// ---------------------------------------------------------------------------
// Routing: transitions & targets
// ---------------------------------------------------------------------------

/** Discriminator for the {@link EnyoOnboardingV2TransitionSource} union. */
export enum EnyoOnboardingV2TransitionSourceKind {
    /** The step's plain "continue" button (steps with no interactive block). */
    Continue = 'continue',
    /** A specific option of a `Choice` block was picked. */
    Choice = 'choice',
    /** A specific outcome of an `Action` or `Input` block fired. */
    Outcome = 'outcome',
}

/** Where a transition leaves from within a step. */
export type EnyoOnboardingV2TransitionSource =
    /** The step's plain "continue" button (steps with no interactive block). */
    | {kind: EnyoOnboardingV2TransitionSourceKind.Continue}
    /** A specific option of a `Choice` block was picked. */
    | {kind: EnyoOnboardingV2TransitionSourceKind.Choice; blockId: string; optionId: string}
    /** A specific outcome of an `Action` or `Input` block fired. */
    | {kind: EnyoOnboardingV2TransitionSourceKind.Outcome; blockId: string; outcomeId: string};

/** Discriminator for the {@link EnyoOnboardingV2Target} union. */
export enum EnyoOnboardingV2TargetType {
    /** Go to another step in this guide. */
    Step = 'step',
    /** Exit: onboarding succeeded (hand back to the app). */
    Success = 'success',
    /** Exit: escalate to enyo support. */
    Support = 'support',
    /** Exit: pause the run (resumable) with a reason. */
    Pause = 'pause',
    /** Jump into the flow of another start variant for the same vendor/model. */
    StartVariant = 'start-variant',
}

/** Where a transition goes. */
export type EnyoOnboardingV2Target =
    /** Go to another step in this guide. */
    | {type: EnyoOnboardingV2TargetType.Step; stepId: string}
    /** Exit: onboarding succeeded (hand back to the app). */
    | {type: EnyoOnboardingV2TargetType.Success}
    /** Exit: escalate to enyo support. */
    | {type: EnyoOnboardingV2TargetType.Support}
    /** Exit: pause the run (resumable) with a reason. */
    | {type: EnyoOnboardingV2TargetType.Pause; reason: EnyoOnboardingV2PauseReason; resumeStepName?: string}
    /** Jump into the flow of another start variant for the same vendor/model. */
    | {type: EnyoOnboardingV2TargetType.StartVariant; variant: EnyoOnboardingV2StartVariant};

/**
 * A directed edge from a handle within a step to an
 * {@link EnyoOnboardingV2Target}.
 */
export interface EnyoOnboardingV2Transition {
    /** Stable id, unique within the step. */
    id: string;
    source: EnyoOnboardingV2TransitionSource;
    target: EnyoOnboardingV2Target;
    /** Optional author note / free-text condition (internal, not shown to users). */
    note?: string;
}

// ---------------------------------------------------------------------------
// Steps & guide
// ---------------------------------------------------------------------------

/** A node in the guide graph. */
export interface EnyoOnboardingV2Step {
    /** Stable id, unique within the guide; referenced by step transitions. */
    id: string;
    /**
     * Unique internal name (kebab-case slug). Stable across title edits — this is
     * the pause/resume anchor, so keep it constant once shipped.
     */
    name: string;
    /** Translated human-facing heading (de/en). */
    title: EnyoOnboardingTranslatedContent[];
    /** Ordered content, 1..n blocks. */
    blocks: EnyoOnboardingV2Block[];
    /** Outgoing edges — one per interactive handle, or a single `Continue`. */
    transitions: EnyoOnboardingV2Transition[];
}

/**
 * A complete onboarding guide graph authored by an energy app. Vendor/model are
 * usually bound at registration/publish time and may be omitted here.
 */
export interface EnyoOnboardingV2Guide {
    /** Translated display title (de/en). */
    title: EnyoOnboardingTranslatedContent[];
    /** Which start situation this guide covers. */
    startVariant: EnyoOnboardingV2StartVariant;
    /** Optional translated summary shown in the library (de/en). */
    summary?: EnyoOnboardingTranslatedContent[];
    /** Library icon (defaults to `Connector`). */
    iconKey?: EnyoOnboardingV2IconKey;
    /** Voraussetzungen — things needed before starting; each entry translated. */
    prerequisites?: EnyoOnboardingTranslatedContent[][];
    /** Benötigtes Werkzeug — tools the installer needs; each entry translated. */
    tools?: EnyoOnboardingTranslatedContent[][];
    /** The entry node — an id present in `steps`. */
    startStepId: string;
    /** The graph nodes (a set, not an ordered list). */
    steps: EnyoOnboardingV2Step[];
    /** Optional vendor binding (catalog id). Usually set at publish time. */
    vendorId?: string;
    /** Optional model bindings (catalog ids). Usually set at publish time. */
    modelIds?: string[];
}
