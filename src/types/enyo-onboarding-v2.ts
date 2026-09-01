/**
 * Onboarding guide **v2** — the structured, multilingual **graph** authoring model
 * for enyo energy-app setup guides.
 *
 * This supersedes the linear v1 model (`EnyoOnboardingGuide` in
 * {@link ./enyo-onboarding.ts}). Where v1 is an ordered list of steps with
 * name-string routing, v2 is a **directed graph**: an energy app defines a guide
 * as a set of named steps connected by explicit {@link EnyoOnboardingV2Transition}s.
 * The installer walks it, branching on choices and device checks, and leaves through
 * one of its exits (success / enyo takeover / paused / support) — or jumps into
 * another start variant's flow.
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
    /**
     * Maintenance on an appliance that already exists — the only variant that
     * does not start from an installation.
     *
     * The other three all describe a device on its way *into* the system: not
     * found yet, found but unconfigured, or set up by hand. This one starts from
     * the opposite situation — the appliance is installed, known and running,
     * and the installer is coming back to it to service, reconfigure or
     * reconnect it.
     *
     * Because the appliance is the subject of the run rather than its result, a
     * maintenance guide MUST name it: see
     * {@link EnyoOnboardingV2Guide.applianceId}, which
     * {@link validateOnboardingGuideV2} requires on this variant and on no
     * other. That binding is what fills the `applianceId` the host passes to
     * {@link EnyoOnboardingV2DynamicRequest} and
     * {@link EnyoOnboardingV2AdditionalSetupRequest} — on an installation
     * variant those are populated only once an appliance happens to exist,
     * whereas here they are known from the first step.
     */
    Maintenance = 'maintenance',
}

/**
 * Why an onboarding run left the flow through a {@link EnyoOnboardingV2TargetType.Pause}
 * target. The reason is not a footnote — it decides what the installer sees next
 * and how (or whether) the run is picked back up.
 */
export enum EnyoOnboardingV2PauseReason {
    /**
     * **enyo übernimmt** — a full hand-off, not a park.
     *
     * Despite living under `pause` on the wire (unchanged for compatibility),
     * this is a **terminal exit alongside `success` and `support`**: the
     * installer is done, enyo finishes the setup, and the app renders the
     * takeover screen instead of returning to the cockpit. Nothing is scheduled
     * for the installer to resume, so `resumeStepName` is meaningless here.
     *
     * A guide whose only end is this hand-off is complete and correct;
     * {@link validateOnboardingGuideV2} treats it as a completing exit and does
     * **not** warn about a missing `success` path. Never invent a fake success
     * branch to silence a warning — there is none to silence.
     */
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
    /**
     * Wait for an OCPP charger to dial into enyo's CSMS.
     *
     * Searches nothing: an OCPP wallbox is never on the LAN to be found, so
     * {@link NetworkScan} is not a substitute. The installer enters the dynamic
     * OCPP URL (see {@link EnyoOnboardingV2DynamicKind.OcppUrl}) in the
     * charger's own configuration; this block then waits for the resulting
     * inbound connection and branches on whether it arrived.
     *
     * Outcome `value`s MUST be {@link EnyoOnboardingV2OcppConnectOutcome}
     * members, and both of them must be wired — a charger that never calls home
     * is the common case, not an edge case.
     */
    OcppConnect = 'ocpp-connect',
    /**
     * Let the installer pick one of the EEBUS peers discovered on the local
     * network and trust its SKI.
     *
     * EEBUS is the third way a device reaches us: it is neither typed in as an
     * IP address ({@link EnyoOnboardingV2InputValueType.IpAddress}) nor dialling
     * out to our CSMS ({@link OcppConnect}). Heat pumps and wallboxes announce
     * themselves over mDNS/SHIP and are addressed by their **SKI**, so pairing
     * means *choosing one of the announced peers* — a decision only the
     * installer standing in front of the device can make, since two identical
     * heat pumps in one house differ only by manufacturer, model and the last
     * bytes of their SKI.
     *
     * The host app renders the picker from the peers the hub discovered; the
     * guide contributes the trigger label and the branches. Because the list
     * comes from discovery, the guide must have scanned: either it keeps
     * {@link EnyoOnboardingV2Guide.requiresNetworkScan} at its default, or it
     * carries a {@link NetworkScan} block ahead of the pairing block —
     * otherwise the picker opens on an empty list.
     *
     * Outcome `value`s MUST be {@link EnyoOnboardingV2EebusPairOutcome}
     * members. The SKI the installer picked is recorded as the block's input
     * value, so a finished run says *which* peer was paired, and later steps —
     * a {@link DeviceTest}, for instance — can read it back under the block's
     * id.
     */
    EebusPair = 'eebus-pair',
}

/**
 * The possible results of an {@link EnyoOnboardingV2ActionKind.EebusPair}
 * block.
 *
 * Three, not two: the two ways pairing fails need different guidance. Nothing
 * was discovered at all is a different conversation from "you picked the right
 * device but the handshake never came up".
 */
export enum EnyoOnboardingV2EebusPairOutcome {
    /** The installer picked a peer and the SHIP connection came up. */
    Paired = 'paired',
    /**
     * Discovery turned up no EEBUS peer — the device is off, on another subnet,
     * or EEBUS is not enabled in its menu.
     */
    NotFound = 'not-found',
    /**
     * A peer was picked but the SHIP handshake did not complete — the pairing
     * was not confirmed on the device, or a PIN was rejected.
     */
    Failure = 'failure',
}

/**
 * The possible results of an {@link EnyoOnboardingV2ActionKind.OcppConnect}
 * block. Deliberately binary: either the charger reached our CSMS or it did not.
 */
export enum EnyoOnboardingV2OcppConnectOutcome {
    /** The charger opened an OCPP connection to enyo's CSMS. */
    Connected = 'connected',
    /** No connection arrived within the host's waiting window. */
    Timeout = 'timeout',
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
    Auth = 'auth',
    AdditionalSetup = 'additional-setup',
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

/**
 * An image with an optional caption.
 *
 * The image is addressed in one of two ways, and exactly one of them must be
 * set:
 *
 * - {@link file} — the `name` of an entry in the declaring package's
 *   `files` ({@link EnergyAppPackagePublicFile}). Preferred: the image lives in
 *   the app repository next to the guide, the enyo CLI uploads it on release,
 *   and enyo resolves the name to a URL when the guide is rendered.
 * - {@link url} — a ready-made public URL, for an image hosted elsewhere (a
 *   vendor's own CDN). Nothing uploads or mirrors it, so the guide is only as
 *   available as that host.
 */
export interface EnyoOnboardingV2ImageBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Image;
    /**
     * A public asset URL (not translated). Set this for an externally hosted
     * image; leave it unset when {@link file} is used, in which case enyo fills
     * it in with the resolved upload URL.
     */
    url?: string;
    /**
     * Name of a file declared in the package's `files`
     * ({@link EnergyAppPackagePublicFile.name}), e.g. `'dip-switches'`. Resolved
     * to a public URL by enyo; a name matching no declaration is a validation
     * error, not a broken image in the field.
     */
    file?: string;
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

/**
 * The single routing handle of an {@link EnyoOnboardingV2AuthBlock}.
 *
 * There is exactly one, and it means "the login succeeded" — the block has no
 * failure branch by design: an installer who cannot log in stays on the step and
 * retries.
 */
export interface EnyoOnboardingV2AuthOutcome {
    /** Stable id, unique within the block; referenced by a transition. */
    id: string;
    /** Translated display label for the successful login (de/en). */
    label: EnyoOnboardingTranslatedContent[];
}

/**
 * The installer logs into the energy app's own account system — the OAuth /
 * vendor-portal sign-in an app like Solarweb or iSolarCloud needs before it can
 * see any device.
 *
 * This is not a device test with an
 * {@link EnyoDeviceTestOutcomeEnum.AuthenticationRequired} verdict: that outcome
 * *routes to* a credentials step, it cannot *be* the login. An auth block is the
 * login itself, which is what lets an OAuth app author its own onboarding.
 *
 * **The server decides whether it passed.** The block exposes one success handle
 * ({@link EnyoOnboardingV2AuthBlock.outcome}) and the host only fires it once the
 * backend confirms a valid session for this app and installation — a client
 * cannot skip past it by pretending, and there is no "continue anyway" branch to
 * author around it. Until then the installer stays on the step and may retry.
 *
 * @example
 * ```ts
 * onboardingV2Block.auth(
 *     'login',
 *     t('Bei Solarweb anmelden', 'Sign in to Solarweb'),
 *     {id: 'ok', label: t('Angemeldet', 'Signed in')},
 *     {help: t('Zugangsdaten des Anlagenbetreibers nutzen.', "Use the plant owner's credentials.")},
 * );
 * ```
 */
export interface EnyoOnboardingV2AuthBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.Auth;
    /** Translated sign-in button text, e.g. "Bei Solarweb anmelden" (de/en). */
    label: EnyoOnboardingTranslatedContent[];
    /** Optional translated help text — which account is needed (de/en). */
    help?: EnyoOnboardingTranslatedContent[];
    /**
     * Force the login to run in a web browser rather than an in-app / native
     * flow. Defaults to `false` — the host picks whatever it would normally use.
     *
     * Set it when the provider will not accept a custom-scheme redirect. Many
     * OAuth providers reject anything that is not `https`, so a redirect of
     * `enyoapp://…` fails at the authorization server with a generic
     * "invalid redirect_uri" — before the installer has typed a password, and
     * with nothing on screen that points at the cause. Declaring the constraint
     * here makes the host hand out an `https` redirect URL instead.
     *
     * This is a property of the *provider*, not of a preference: turn it on
     * because the vendor's OAuth app rejects custom schemes, not because a
     * browser seems tidier. The native flow is the better experience where it
     * works — it keeps the installer inside the app.
     *
     * The requirement travels with the request the app receives, as
     * {@link EnyoOauthAuthenticationStart.requiresWebAuthentication}, so an app
     * that registers its own redirect handler can confirm which mode it got
     * rather than inferring it from the URL's scheme.
     */
    requiresWebAuthentication?: boolean;
    /** The one success handle; routed like any other outcome. */
    outcome: EnyoOnboardingV2AuthOutcome;
}

/**
 * What an {@link EnyoOnboardingV2SetupField} collects. Drives the keyboard, the
 * masking, and — for {@link Password} and {@link Token} — whether the value is
 * treated as a secret.
 *
 * Secrecy is **derived from the type** rather than declared separately: one
 * fewer thing to get wrong, and a field holding a credential is exactly the
 * field that should be masked.
 */
export enum EnyoOnboardingV2SetupFieldType {
    /** Free text; any non-empty value is accepted. */
    Text = 'text',
    /** A number; `,` and `.` are both accepted as the decimal separator. */
    Number = 'number',
    /** One of {@link EnyoOnboardingV2SetupField.options}. */
    Select = 'select',
    /** A password. Masked, and handled as a secret — see {@link EnyoOnboardingV2AdditionalSetupBlock}. */
    Password = 'password',
    /** An API token or key. Masked, paste-friendly, and handled as a secret. */
    Token = 'token',
}

/** One choice of a {@link EnyoOnboardingV2SetupFieldType.Select} field. */
export interface EnyoOnboardingV2SetupFieldOption {
    /** The value handed to the handler when this option is picked; not translated. */
    value: string;
    /** The translated label shown to the installer (de/en). */
    label: EnyoOnboardingTranslatedContent[];
}

/**
 * One value an {@link EnyoOnboardingV2AdditionalSetupBlock} collects before
 * calling the app.
 */
export interface EnyoOnboardingV2SetupField {
    /**
     * App-defined key, unique within the block and echoed back to the handler as
     * {@link EnyoOnboardingV2SetupFieldValue.name}. Kebab-case.
     */
    name: string;
    /** What this field collects. */
    type: EnyoOnboardingV2SetupFieldType;
    /** Translated field label (de/en). */
    label: EnyoOnboardingTranslatedContent[];
    /** Optional translated placeholder (de/en). */
    placeholder?: EnyoOnboardingTranslatedContent[];
    /** Optional translated help text — where the installer finds the value (de/en). */
    help?: EnyoOnboardingTranslatedContent[];
    /**
     * Whether the installer must fill this in before the CTA is enabled.
     * Defaults to `true`.
     *
     * An optional secret is usually a sign the *block* wants a
     * {@link EnyoOnboardingV2AdditionalSetupBlock.skip} instead: half-submitted
     * credentials fail inside the handler rather than on screen, which is a
     * worse place to explain the problem.
     */
    required?: boolean;
    /** The options; {@link EnyoOnboardingV2SetupFieldType.Select} only, at least 2. */
    options?: EnyoOnboardingV2SetupFieldOption[];
}

/**
 * A possible verdict of an {@link EnyoOnboardingV2AdditionalSetupBlock}; each is
 * a routing handle.
 */
export interface EnyoOnboardingV2SetupOutcome {
    /** Stable id, unique within the block; referenced by a transition. */
    id: string;
    /**
     * App-defined key the handler returns to select this branch; not translated.
     *
     * `failed` is reserved and **mandatory** on every block. It absorbs a
     * rejected handler, one that exceeded its budget, a package with no handler
     * registered, and a returned value matching no declared outcome. Guide and
     * handler are linked only by these strings — nothing checks them against
     * each other at compile time — so a typo between the two is a live
     * possibility, and `failed` is what stops it stranding the installer.
     */
    value: string;
    /** Translated display label for the verdict (de/en). */
    label: EnyoOnboardingTranslatedContent[];
}

/**
 * The handle for leaving an {@link EnyoOnboardingV2AdditionalSetupBlock} without
 * running it at all.
 *
 * Present only on a genuinely optional setup, and it is what keeps a failing
 * bonus feature from blocking an otherwise finished onboarding.
 */
export interface EnyoOnboardingV2SetupSkipHandle {
    /** Stable id, unique within the block; referenced by a transition. */
    id: string;
    /** Translated label, e.g. "Später einrichten" (de/en). */
    label: EnyoOnboardingTranslatedContent[];
}

/**
 * An app-defined setup: collect zero or more values, hand them to the energy
 * app, and branch on the verdict **the app** returns.
 *
 * The fourth interactive block, and the only one the app itself judges. The
 * others each answer a different question:
 *
 * - {@link EnyoOnboardingV2InputBlock} — one value, checked by the **host**.
 *   Note that `Text` and `Number` run no check at all and always take the
 *   positive branch, so a password typed into one is simply waved through. That
 *   gap is what this block exists to close.
 * - {@link EnyoOnboardingV2AuthBlock} — the app's own OAuth session, gated by the
 *   **server**. Keep using it for that: server gating is a security property an
 *   app cannot self-assert, and no handler here substitutes for it.
 * - {@link EnyoOnboardingV2ActionBlock} — a **closed** set of host capabilities.
 *
 * Use this for what none of those cover: a vendor API key that unlocks
 * forecasts, a service token for an optional feature, an installer code checked
 * against the app's own backend.
 *
 * **Secrets.** A {@link EnyoOnboardingV2SetupFieldType.Password} or
 * {@link EnyoOnboardingV2SetupFieldType.Token} field is deliberately **not**
 * persisted in run state — the opposite of {@link EnyoOnboardingV2InputBlock},
 * whose value is kept so back/resume does not force a retype. Leaving the step
 * clears it; returning asks again. That costs the installer a retype, which is
 * less than a credential outliving the session in run state. The host logs field
 * names and the resulting outcome key, never values, and an app should persist
 * what it receives through {@link EnergyAppSecretManager} rather than its own
 * storage. A secret field carries no default and is never prefilled: guides are
 * pulled and cached, so there is nowhere safe for one to live.
 *
 * Each outcome and the skip handle MUST have exactly one outgoing transition.
 *
 * @example
 * ```ts
 * onboardingV2Block.additionalSetup('cloud', 'vendor-cloud-token', {
 *     cta: t('Cloud verbinden', 'Connect the cloud'),
 *     description: t(
 *         'Optional: verbindet das Hersteller-Portal für genauere Prognosen.',
 *         'Optional: connects the vendor portal for better forecasts.',
 *     ),
 *     fields: [
 *         {
 *             name: 'api-token',
 *             type: EnyoOnboardingV2SetupFieldType.Token,
 *             label: t('API-Token', 'API token'),
 *             help: t('Portal → Einstellungen → API', 'Portal → Settings → API'),
 *         },
 *     ],
 *     outcomes: [
 *         {id: 'ok',     value: 'connected', label: t('Verbunden', 'Connected')},
 *         {id: 'bad',    value: 'invalid',   label: t('Token ungültig', 'Invalid token')},
 *         {id: 'failed', value: 'failed',    label: t('Fehlgeschlagen', 'Failed')},
 *     ],
 *     skip: {id: 'later', label: t('Später einrichten', 'Set up later')},
 * });
 * ```
 */
export interface EnyoOnboardingV2AdditionalSetupBlock extends EnyoOnboardingV2BlockBase {
    type: EnyoOnboardingV2BlockType.AdditionalSetup;
    /**
     * App-defined key naming *which* setup this is, passed to the handler
     * verbatim. Kebab-case.
     *
     * Deliberately distinct from {@link EnyoOnboardingV2BlockBase.id}: the id is
     * a routing handle unique to one guide, while this is the app-facing
     * identity and may repeat across guides. One handler switches on it instead
     * of carrying a branch per guide.
     */
    setupKey: string;
    /** Translated CTA caption — the button the installer presses (de/en). */
    cta: EnyoOnboardingTranslatedContent[];
    /** Translated description of what this unlocks, and why it is worth doing (de/en). */
    description: EnyoOnboardingTranslatedContent[];
    /** What to collect before calling the app. Omit for a pure "do it now" action. */
    fields?: EnyoOnboardingV2SetupField[];
    /**
     * The verdicts; each is a routing handle. At least 2, and exactly one of them
     * MUST be valued `failed`.
     */
    outcomes: EnyoOnboardingV2SetupOutcome[];
    /** Optional escape hatch. Present only on a genuinely optional setup. */
    skip?: EnyoOnboardingV2SetupSkipHandle;
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
    | EnyoOnboardingV2InputBlock
    | EnyoOnboardingV2AuthBlock
    | EnyoOnboardingV2AdditionalSetupBlock;

/**
 * Blocks that produce routing handles (a step's decision points).
 *
 * A {@link EnyoOnboardingV2LinkBlock} is deliberately absent: it is passive
 * content and routes nothing.
 */
export type EnyoOnboardingV2InteractiveBlock =
    | EnyoOnboardingV2ChoiceBlock
    | EnyoOnboardingV2ActionBlock
    | EnyoOnboardingV2InputBlock
    | EnyoOnboardingV2AuthBlock
    | EnyoOnboardingV2AdditionalSetupBlock;

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
    /** The installer skipped an `AdditionalSetup` block without running it. */
    Skip = 'skip',
}

/** Where a transition leaves from within a step. */
export type EnyoOnboardingV2TransitionSource =
    /** The step's plain "continue" button (steps with no interactive block). */
    | {kind: EnyoOnboardingV2TransitionSourceKind.Continue}
    /** A specific option of a `Choice` block was picked. */
    | {kind: EnyoOnboardingV2TransitionSourceKind.Choice; blockId: string; optionId: string}
    /** A specific outcome of an `Action` or `Input` block fired. */
    | {kind: EnyoOnboardingV2TransitionSourceKind.Outcome; blockId: string; outcomeId: string}
    /** An `AdditionalSetup` block was skipped, leaving without a verdict. */
    | {kind: EnyoOnboardingV2TransitionSourceKind.Skip; blockId: string; skipId: string};

/** Discriminator for the {@link EnyoOnboardingV2Target} union. */
export enum EnyoOnboardingV2TargetType {
    /** Go to another step in this guide. */
    Step = 'step',
    /** Exit: onboarding succeeded (hand back to the app). */
    Success = 'success',
    /** Exit: escalate to enyo support (optionally with a `reason`). */
    Support = 'support',
    /**
     * Exit: leave the flow with an {@link EnyoOnboardingV2PauseReason}. Usually
     * a resumable park — except {@link EnyoOnboardingV2PauseReason.EnyoTodo},
     * which is the terminal "enyo übernimmt" hand-off.
     */
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
    /**
     * Exit: escalate to enyo support, optionally recording what failed in
     * `reason` — a short internal key, never shown to the installer.
     */
    | {type: EnyoOnboardingV2TargetType.Support; reason?: string}
    /**
     * Exit: leave the flow with a reason. Resumable at `resumeStepName`, except
     * for the terminal {@link EnyoOnboardingV2PauseReason.EnyoTodo} hand-off.
     */
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
    /**
     * Whether the host runs its local network scan before entering this guide.
     *
     * Defaults to `true` — the historic behaviour, and the right one for a
     * LAN device. Set it to `false` for a guide whose device is never on the
     * LAN to be found (an OCPP wallbox, a cloud-only inverter): the run then
     * starts at {@link startStepId} directly instead of spending ~20 s on a scan
     * that must fail and framing the result as "we couldn't find your device".
     *
     * A guide that opts out cannot rely on scan results, so
     * {@link EnyoOnboardingV2DeviceSelection.Detected} has nothing to select from
     * unless the guide runs its own
     * {@link EnyoOnboardingV2ActionKind.NetworkScan} block first, and an
     * {@link EnyoOnboardingV2ActionKind.EebusPair} block would offer the
     * installer an empty list of peers.
     */
    requiresNetworkScan?: boolean;
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
    /**
     * The appliance this guide is bound to — **required on**
     * {@link EnyoOnboardingV2StartVariant.Maintenance}, and meaningless on every
     * other variant.
     *
     * A maintenance run services an appliance that already exists, so the
     * appliance is an input to the run rather than something it produces: the
     * host binds the run to this id and passes it on as
     * {@link EnyoOnboardingV2DynamicRequest.applianceId} and
     * {@link EnyoOnboardingV2AdditionalSetupRequest.applianceId} from the first
     * step onwards. The installation variants have nothing to bind — their
     * appliance is created by the run, if it is created at all — and a guide
     * that sets this anyway is warned about and the value ignored.
     *
     * Optional in the type because one interface serves all four variants; the
     * variant-dependent requirement is enforced by
     * {@link validateOnboardingGuideV2} instead of by the compiler.
     */
    applianceId?: string;
    /** Optional vendor binding (catalog id). Usually set at publish time. */
    vendorId?: string;
    /** Optional model bindings (catalog ids). Usually set at publish time. */
    modelIds?: string[];
}
