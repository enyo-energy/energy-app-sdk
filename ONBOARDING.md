# Onboarding Flow Documentation

> **Deprecation notice.** Everything described below is the **v1** onboarding
> model (`EnyoOnboardingGuide`, linear steps + sections, name-string routing). It
> is **deprecated** in favour of the **v2 graph model** — see
> [v2 (graph model)](#v2-graph-model) at the end of this document. v1 stays
> supported for backward compatibility and will be removed in a future major;
> author new guides with `defineOnboardingGuideV2()`.

This document describes how the onboarding flow works in the Energy App SDK. The onboarding system provides a guided multi-step configuration experience for users when an app or appliance requires initial setup.

## Overview

Onboarding is a guided configuration system that walks users through setup steps when:
- A package's state is `ConfigurationRequired` (package-level onboarding)
- An appliance's state is `ConfigurationRequired` (appliance-specific onboarding)

The onboarding flow allows packages to collect user input, display information, and validate configuration before transitioning to the `Running` state.

## Core Concepts

### Onboarding Guide (`EnyoOnboardingGuide`)

The top-level container for an onboarding flow. Each guide has:
- `id` - Unique identifier for the guide
- `applianceId` - Optional; if set, this is an appliance-specific guide
- `steps` - Ordered array of steps the user progresses through

### Steps (`EnyoOnboardingStep`)

Individual screens in the onboarding flow. Each step contains:
- `name` - Internal identifier for the step (used in submission handling)
- `imageUrl` - Optional URL for an image displayed at the top
- `sections` - Array of content sections
- `nextButtonLabel` - Translated text for the continue button

### Sections (`EnyoOnboardingSection`)

Content blocks within a step. Each section has:
- `type` - The section type (determines rendering)
- `heading` - Translated heading text
- `content` - Translated content body

### Section Types (`EnyoOnboardingSectionType`)

| Type | Description |
|------|-------------|
| `Heading` | Large title text |
| `Text` | Body text/paragraph |
| `PasswordInput` | Secure text input field |
| `Credentials` | Read-only credential display |

## UI Components

This section describes how each section type appears in the app.

### Heading Section

Displays large, prominent title text. Use for major section headers or step titles.

```typescript
{
  type: EnyoOnboardingSectionType.Heading,
  heading: [{ language: 'en', value: 'Welcome to Setup' }],
  content: []
}
```

### Text Section

Displays body text for instructions or descriptions. Use for explanatory content.

```typescript
{
  type: EnyoOnboardingSectionType.Text,
  heading: [{ language: 'en', value: '' }],
  content: [{ language: 'en', value: 'Please follow the steps below to configure your device.' }],
  text: [{ language: 'en', value: 'Additional details here.' }]
}
```

### PasswordInput Section

Renders a secure text input field with a label. The `fieldName` identifies the value in form submissions.

```typescript
{
  type: EnyoOnboardingSectionType.PasswordInput,
  heading: [{ language: 'en', value: '' }],
  content: [{ language: 'en', value: '' }],
  password: {
    title: [{ language: 'en', value: 'Enter your API key' }],
    fieldName: 'apiKey'
  }
}
```

### Credentials Section

Displays read-only key-value pairs, such as generated API keys or usernames.

```typescript
{
  type: EnyoOnboardingSectionType.Credentials,
  heading: [{ language: 'en', value: 'Your Credentials' }],
  content: [{ language: 'en', value: '' }],
  credentials: [
    { title: [{ language: 'en', value: 'Username' }], value: 'user@example.com' },
    { title: [{ language: 'en', value: 'API Key' }], value: 'sk-abc123...' }
  ]
}
```

### Step Layout

Each step renders in this order:
1. **Image** (optional) - Displayed at the top if `imageUrl` is provided
2. **Sections** - Rendered sequentially from the `sections` array
3. **Next Button** - Displayed at the bottom with translated label

### Navigation

- Users tap the next button to submit the current step
- After successful validation, the app moves to the next step
- Users can navigate back to previous steps

### Error States

When a step submission fails, the error message is displayed to the user:
- Errors are provided as translated content (`EnyoOnboardingTranslatedContent[]`)
- The app displays the message in the user's preferred language
- The user remains on the current step until the error is resolved

## API Reference

Access the onboarding API via the SDK:

```typescript
const onboarding = sdk.useOnboarding();
```

### saveOnboardingGuide

Saves an onboarding guide for display. Call this when your package enters `ConfigurationRequired` state.

```typescript
saveOnboardingGuide(guide: EnyoOnboardingGuide, applianceId?: string): Promise<void>
```

**Parameters:**
- `guide` - The complete onboarding guide configuration
- `applianceId` - Optional; provide for appliance-specific onboarding

### removeOnboardingGuide

Removes a previously saved onboarding guide.

```typescript
removeOnboardingGuide(applianceId?: string): Promise<void>
```

**Parameters:**
- `applianceId` - Optional; omit to remove the package-level guide

### getCurrentStep

Returns the current step being displayed, or `null` if no onboarding is active.

```typescript
getCurrentStep(applianceId?: string): EnyoOnboardingStep | null
```

### listenForStepSubmission

Registers a callback to handle step submissions. This is called when users tap the next button.

```typescript
listenForStepSubmission(listener: EnyoOnboardingStepListener): void
```

The listener receives an `EnyoOnboardingStepSubmission` with:
- `stepName` - The name of the submitted step
- `applianceId` - Optional; present for appliance-specific onboarding
- `data` - Optional; form data from the step (e.g., password input values)

The listener must return a Promise resolving to `EnyoOnboardingStepResponse`:
- `{ state: 'success' }` - Step completed successfully
- `{ state: 'error', errorMessage: [...] }` - Validation failed with translated message
- `{ state: 'success', goToAuthentication: true }` - Step completed successfully and the host
  should route the user to the pending authentication request (created earlier via
  `requestAuthentication`). Typically used on the final step. This is fire-and-forget — the guide
  still completes regardless of the authentication outcome.

### respondToStepSubmission

Programmatically responds to a step (alternative to listener return value).

```typescript
respondToStepSubmission(
  stepName: string,
  response: EnyoOnboardingStepResponse,
  applianceId?: string
): Promise<void>
```

### moveToNextStep

Advances to the next step. No effect if already at the last step.

```typescript
moveToNextStep(applianceId?: string): Promise<void>
```

### moveToPreviousStep

Returns to the previous step. No effect if at the first step.

```typescript
moveToPreviousStep(applianceId?: string): Promise<void>
```

### addStep

Adds a new step to an existing guide at runtime. Use this when the next step can only be determined after the user submits the current one (e.g. a discovery step that finds N devices and needs N follow-up configuration steps). Combine with `moveToStep` to navigate into the freshly added step.

```typescript
addStep(
  guideName: string,
  step: EnyoOnboardingStep,
  options?: { after?: string }
): Promise<void>
```

**Parameters:**
- `guideName` - The guide to extend
- `step` - The step to add. Its `name` must be unique within the guide.
- `options.after` - Optional; insert immediately after the step with this `name`. Omit to append at the end.

```typescript
onboarding.listenForStepSubmission(async (submission) => {
  if (submission.stepName === 'discover-devices') {
    const devices = await scanForDevices();
    for (const device of devices) {
      await onboarding.addStep(submission.guideName, {
        name: `configure-${device.id}`,
        sections: buildSectionsFor(device),
        nextButtonLabel: [{ language: 'en', value: 'Continue' }],
      }, { after: 'discover-devices' });
    }
    await onboarding.moveToStep(submission.guideName, `configure-${devices[0].id}`);
    return { state: 'success' };
  }
  return { state: 'success' };
});
```

### completeOnboarding

Marks onboarding as complete and clears the `ConfigurationRequired` state.

```typescript
completeOnboarding(applianceId?: string): Promise<void>
```

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        INITIALIZATION                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Package starts in 'launching' state                         │
│  2. Package determines configuration is needed                  │
│  3. Package calls updateEnergyAppState(ConfigurationRequired)   │
│  4. Package calls saveOnboardingGuide(guide)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ONBOARDING ACTIVE                           │
├─────────────────────────────────────────────────────────────────┤
│  5. App displays first step to user                             │
│  6. User fills in fields and taps Next                          │
│  7. listenForStepSubmission callback fires                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VALIDATION                                 │
├─────────────────────────────────────────────────────────────────┤
│  8. Package validates submission data                           │
│     ├── Success: return { state: 'success' }                    │
│     │   └── moveToNextStep() or continue to next step           │
│     └── Error: return { state: 'error', errorMessage: [...] }   │
│         └── User sees error, stays on current step              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   REPEAT FOR EACH STEP                          │
├─────────────────────────────────────────────────────────────────┤
│  9. Steps 6-8 repeat until all steps complete                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      COMPLETION                                 │
├─────────────────────────────────────────────────────────────────┤
│  10. Package calls completeOnboarding()                         │
│  11. Package calls updateEnergyAppState(Running)                │
│  12. App exits onboarding, package operates normally            │
│      └── Optional: final step returns goToAuthentication: true  │
│          to route the user to a pending authentication request  │
└─────────────────────────────────────────────────────────────────┘
```

## Code Examples

### Basic Single-Step Onboarding

```typescript
import { EnyoEnergyAppSdk, EnergyAppStateEnum } from 'connect-ems-api';
import { EnyoOnboardingSectionType } from 'connect-ems-api/types/enyo-onboarding';

export function init(sdk: EnyoEnergyAppSdk) {
  sdk.register(async (packageName, version, channel) => {
    const storage = sdk.useStorage();
    const onboarding = sdk.useOnboarding();

    // Check if already configured
    const apiKey = await storage.get('apiKey');
    if (apiKey) {
      sdk.updateEnergyAppState(EnergyAppStateEnum.Running);
      return;
    }

    // Set up onboarding
    sdk.updateEnergyAppState(EnergyAppStateEnum.ConfigurationRequired);

    await onboarding.saveOnboardingGuide({
      id: 'api-key-setup',
      steps: [
        {
          name: 'enter-api-key',
          imageUrl: 'https://example.com/setup-image.png',
          sections: [
            {
              type: EnyoOnboardingSectionType.Heading,
              heading: [
                { language: 'en', value: 'API Key Required' },
                { language: 'de', value: 'API-Schlüssel erforderlich' }
              ],
              content: []
            },
            {
              type: EnyoOnboardingSectionType.Text,
              heading: [],
              content: [
                { language: 'en', value: 'Enter your API key to connect to the service.' },
                { language: 'de', value: 'Geben Sie Ihren API-Schlüssel ein, um eine Verbindung herzustellen.' }
              ]
            },
            {
              type: EnyoOnboardingSectionType.PasswordInput,
              heading: [],
              content: [],
              password: {
                title: [
                  { language: 'en', value: 'API Key' },
                  { language: 'de', value: 'API-Schlüssel' }
                ],
                fieldName: 'apiKey'
              }
            }
          ],
          nextButtonLabel: [
            { language: 'en', value: 'Continue' },
            { language: 'de', value: 'Weiter' }
          ]
        }
      ]
    });

    // Handle step submission
    onboarding.listenForStepSubmission(async (submission) => {
      if (submission.stepName === 'enter-api-key') {
        const key = submission.data?.apiKey;

        if (!key || key.length < 10) {
          return {
            state: 'error',
            errorMessage: [
              { language: 'en', value: 'Please enter a valid API key.' },
              { language: 'de', value: 'Bitte geben Sie einen gültigen API-Schlüssel ein.' }
            ]
          };
        }

        // Save and complete
        await storage.set('apiKey', key);
        await onboarding.completeOnboarding();
        sdk.updateEnergyAppState(EnergyAppStateEnum.Running);
      }

      return { state: 'success' };
    });
  });
}
```

### Requiring Authentication After Onboarding

Set up an authentication request during initialization, then route the user to it from the final
step's response using `goToAuthentication: true`. The guide completes normally; the host presents
the authentication request afterward, and its result is handled by `listenForAuthenticationResponse`.

```typescript
import { EnyoEnergyAppSdk, EnergyAppStateEnum } from 'connect-ems-api';
import { EnyoAuthenticationStateEnum } from 'connect-ems-api/types/enyo-authentication';

export function setupCloudOnboarding(sdk: EnyoEnergyAppSdk) {
  const onboarding = sdk.useOnboarding();
  const auth = sdk.useAuthentication();

  // Create the authentication request up front.
  auth.requestAuthentication({
    authenticationType: 'oauth',
    oneTimeAuthentication: true,
    oauth: {
      description: [{ language: 'en', value: 'Sign in to your cloud account.' }]
    }
  });

  // Store the credentials / mark the account authenticated when the user finishes auth.
  auth.listenForAuthenticationResponse(async (response) => {
    // ...persist tokens from response.oauth...
    return { state: EnyoAuthenticationStateEnum.Authenticated };
  });

  onboarding.listenForStepSubmission(async (submission) => {
    if (submission.stepName === 'finish') {
      await onboarding.completeOnboarding(submission.guideName);
      sdk.updateEnergyAppState(EnergyAppStateEnum.Running);
      // Route the user to the authentication request created above.
      return { state: 'success', goToAuthentication: true };
    }
    return { state: 'success' };
  });
}
```

### Multi-Step Appliance Onboarding

```typescript
import { EnyoEnergyAppSdk, EnergyAppStateEnum } from 'connect-ems-api';
import { EnyoOnboardingSectionType } from 'connect-ems-api/types/enyo-onboarding';
import { EnyoApplianceStateEnum } from 'connect-ems-api/types/enyo-appliance';

export function setupApplianceOnboarding(
  sdk: EnyoEnergyAppSdk,
  applianceId: string
) {
  const onboarding = sdk.useOnboarding();
  const appliances = sdk.useAppliances();

  onboarding.saveOnboardingGuide({
    id: 'inverter-setup',
    applianceId: applianceId,
    steps: [
      {
        name: 'welcome',
        imageUrl: 'https://example.com/inverter.png',
        sections: [
          {
            type: EnyoOnboardingSectionType.Heading,
            heading: [{ language: 'en', value: 'Inverter Setup' }],
            content: []
          },
          {
            type: EnyoOnboardingSectionType.Text,
            heading: [],
            content: [{ language: 'en', value: 'Follow these steps to configure your inverter.' }]
          }
        ],
        nextButtonLabel: [{ language: 'en', value: 'Start Setup' }]
      },
      {
        name: 'credentials',
        sections: [
          {
            type: EnyoOnboardingSectionType.Heading,
            heading: [{ language: 'en', value: 'Enter Credentials' }],
            content: []
          },
          {
            type: EnyoOnboardingSectionType.PasswordInput,
            heading: [],
            content: [],
            password: {
              title: [{ language: 'en', value: 'Inverter Password' }],
              fieldName: 'inverterPassword'
            }
          }
        ],
        nextButtonLabel: [{ language: 'en', value: 'Connect' }]
      },
      {
        name: 'confirmation',
        sections: [
          {
            type: EnyoOnboardingSectionType.Heading,
            heading: [{ language: 'en', value: 'Setup Complete' }],
            content: []
          },
          {
            type: EnyoOnboardingSectionType.Text,
            heading: [],
            content: [{ language: 'en', value: 'Your inverter is now connected and ready to use.' }]
          }
        ],
        nextButtonLabel: [{ language: 'en', value: 'Done' }]
      }
    ]
  }, applianceId);

  onboarding.listenForStepSubmission(async (submission) => {
    // Only handle this appliance's submissions
    if (submission.applianceId !== applianceId) {
      return { state: 'success' };
    }

    switch (submission.stepName) {
      case 'welcome':
        await onboarding.moveToNextStep(applianceId);
        return { state: 'success' };

      case 'credentials':
        const password = submission.data?.inverterPassword;
        const isValid = await validateInverterConnection(password);

        if (!isValid) {
          return {
            state: 'error',
            errorMessage: [
              { language: 'en', value: 'Could not connect. Please check the password.' }
            ]
          };
        }

        await onboarding.moveToNextStep(applianceId);
        return { state: 'success' };

      case 'confirmation':
        await onboarding.completeOnboarding(applianceId);
        // Update appliance state
        await appliances.updateAppliance(applianceId, {
          metadata: { state: EnyoApplianceStateEnum.Connected }
        });
        return { state: 'success' };

      default:
        return { state: 'success' };
    }
  });
}

async function validateInverterConnection(password: string): Promise<boolean> {
  // Implementation: attempt connection with provided password
  return password.length > 0;
}
```

### Error Handling Patterns

```typescript
onboarding.listenForStepSubmission(async (submission) => {
  try {
    // Attempt operation
    const result = await performSetup(submission.data);

    if (result.success) {
      return { state: 'success' };
    }

    // Handle known error cases
    return {
      state: 'error',
      errorMessage: [
        { language: 'en', value: result.errorMessage },
        { language: 'de', value: translateError(result.errorCode, 'de') }
      ]
    };
  } catch (error) {
    // Handle unexpected errors
    console.error('Onboarding error:', error);
    return {
      state: 'error',
      errorMessage: [
        { language: 'en', value: 'An unexpected error occurred. Please try again.' },
        { language: 'de', value: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' }
      ]
    };
  }
});
```

## Type Reference

### EnyoOnboardingGuide

```typescript
interface EnyoOnboardingGuide {
  /** Unique identifier for this guide */
  id: string;
  /** Optional appliance ID if this is an appliance-specific guide */
  applianceId?: string;
  /** Ordered array of steps in the onboarding flow */
  steps: EnyoOnboardingStep[];
}
```

### EnyoOnboardingStep

```typescript
interface EnyoOnboardingStep {
  /** Internal name/identifier for this step */
  name: string;
  /** Optional URL for an image to display at the top of the step */
  imageUrl?: string;
  /** Array of content sections with headings and descriptions */
  sections: EnyoOnboardingSection[];
  /** Translated label for the next/continue button */
  nextButtonLabel: EnyoOnboardingTranslatedContent[];
}
```

### EnyoOnboardingSection

```typescript
interface EnyoOnboardingSection {
  /** The type of content this section displays */
  type: EnyoOnboardingSectionType;
  /** Translated heading for this section */
  heading: EnyoOnboardingTranslatedContent[];
  /** Translated content body for this section */
  content: EnyoOnboardingTranslatedContent[];
  /** Optional translated text content, used when type is 'text' */
  text?: EnyoOnboardingTranslatedContent[];
  /** Optional password input configuration, used when type is 'password-input' */
  password?: EnyoOnboardingSectionPassword;
  /** Optional credentials to display, used when type is 'credentials' */
  credentials?: EnyoOnboardingSectionCredential[];
}
```

### EnyoOnboardingSectionType

```typescript
enum EnyoOnboardingSectionType {
  Heading = "heading",
  Text = "text",
  PasswordInput = "password-input",
  Credentials = "credentials",
}
```

### EnyoOnboardingTranslatedContent

```typescript
interface EnyoOnboardingTranslatedContent {
  /** Language code for this translation */
  language: EnergyAppPackageLanguage;
  /** The translated text value */
  value: string;
}
```

### EnyoOnboardingSectionPassword

```typescript
interface EnyoOnboardingSectionPassword {
  /** Translated title for the password input */
  title: EnyoOnboardingTranslatedContent[];
  /** The field name used when submitting the password value */
  fieldName: string;
}
```

### EnyoOnboardingSectionCredential

```typescript
interface EnyoOnboardingSectionCredential {
  /** Translated title/label for the credential */
  title: EnyoOnboardingTranslatedContent[];
  /** The credential value to display */
  value: string;
}
```

### EnyoOnboardingStepSubmission

```typescript
interface EnyoOnboardingStepSubmission {
  /** Name of the step being submitted */
  stepName: string;
  /** Optional appliance ID if this is from appliance-specific onboarding */
  applianceId?: string;
  /** Optional data submitted with the step */
  data?: any;
}
```

### EnyoOnboardingStepResponse

```typescript
interface EnyoOnboardingStepResponse {
  /** State of the step submission - success or error */
  state: 'success' | 'error';
  /** Optional translated error message if state is 'error' */
  errorMessage?: EnyoOnboardingTranslatedContent[];
  /**
   * When true on a successful response, routes the user to the pending authentication
   * request (created separately via `requestAuthentication`) after this step completes.
   * Typically set on the final step. Fire-and-forget: the guide completes regardless of
   * the authentication outcome. Ignored when `state` is 'error'.
   */
  goToAuthentication?: boolean;
}
```

### EnyoOnboardingStepListener

```typescript
type EnyoOnboardingStepListener = (
  submission: EnyoOnboardingStepSubmission
) => Promise<EnyoOnboardingStepResponse>;
```

## Related Types

### EnergyAppStateEnum

Used for package-level state management:

```typescript
enum EnergyAppStateEnum {
  Launching = 'launching',
  Running = 'running',
  ConfigurationRequired = 'configuration-required',
  InternetConnectionRequired = 'internet-connection-required',
}
```

### EnyoApplianceStateEnum

Used for appliance-level state management:

```typescript
enum EnyoApplianceStateEnum {
  Connected = 'connected',
  ConnectionPending = 'connection-pending',
  Offline = 'offline',
  ConfigurationRequired = 'configuration-required',
}
```

## v2 (graph model)

The v2 model replaces v1's linear list of steps with a **directed graph**. It is
the authoring format used by the onboarding-guide editor, the runtime guide
executor, and the guide-authoring tooling.

### How v2 differs from v1

| | v1 (`EnyoOnboardingGuide`) | v2 (`EnyoOnboardingV2Guide`) |
|---|---|---|
| Structure | ordered `steps[]` | graph of `steps[]` reached via transitions |
| Step content | `sections[]` (heading/text/password/…) | typed `blocks[]` (text/headline/bullets/image/hint/dynamic/choice/action) |
| Routing | name-string routing (`branches.routes` → `targetStepName`) | explicit `transitions[]`: a source **handle** → a `target` |
| Exits | implicit (last step / complete) | explicit terminals: `success` \| `support` \| `pause` (incl. the `enyo-todo` hand-off) |
| Cross-flow | — | `start-variant` hand-off between a vendor/model's flows |
| Entry situation | — | `startVariant` (`device-not-found` \| `device-found-config` \| `manual-setup`) + `requiresNetworkScan` |

Both models are **multilingual**: every author-facing string is an
`EnyoOnboardingTranslatedContent[]` (de/en). v2 reuses that v1 primitive.

### Authoring a v2 guide

Use `defineOnboardingGuideV2()` with the `onboardingV2Block`, `onboardingV2Target`
and `on*V2` transition factories, then validate with
`validateOnboardingGuideV2()` (or `assertValidOnboardingGuideV2()`, which throws).

```typescript
import {
  defineOnboardingGuideV2,
  EnyoOnboardingV2ActionKind,
  EnyoOnboardingV2StartVariant,
  onboardingV2Block,
  onboardingV2Target,
  onOutcomeV2,
  validateOnboardingGuideV2,
} from '@enyo-energy/energy-app-sdk';

const t = (de: string, en: string) => [
  {language: 'de' as const, value: de},
  {language: 'en' as const, value: en},
];

const guide = defineOnboardingGuideV2({
  title: t('Wechselrichter finden', 'Find the inverter'),
  startVariant: EnyoOnboardingV2StartVariant.DeviceNotFound,
  startStepId: 'scan',
  steps: [
    {
      id: 'scan',
      name: 'scan',
      title: t('Netzwerk scannen', 'Scan the network'),
      blocks: [
        onboardingV2Block.text('intro', t('Wir suchen das Gerät …', 'Searching for the device …')),
        onboardingV2Block.action('do-scan', EnyoOnboardingV2ActionKind.NetworkScan, t('Scannen', 'Scan'), [
          {id: 'found', value: 'found', label: t('Gefunden', 'Found')},
          {id: 'missing', value: 'not-found', label: t('Nicht gefunden', 'Not found')},
        ]),
      ],
      transitions: [
        onOutcomeV2('do-scan', 'found', onboardingV2Target.success()),
        onOutcomeV2('do-scan', 'missing', onboardingV2Target.support()),
      ],
    },
  ],
});

const {ok, errors, warnings} = validateOnboardingGuideV2(guide);
```

### Content blocks

| Block | Factory | Purpose |
|---|---|---|
| `text` / `headline` | `onboardingV2Block.text` / `.headline` | prose / sub-heading |
| `bullets` | `onboardingV2Block.bullets` | bulleted list (each bullet translated) |
| `image` | `onboardingV2Block.image` | image + optional caption |
| `hint` | `onboardingV2Block.hint` | callout (`important` \| `info` \| `warning`) |
| `dynamic` | `onboardingV2Block.dynamic` | runtime-resolved value (`ocpp-url` \| `device-ip`) |
| `choice` | `onboardingV2Block.choice` | single-select decision; each option is a routing handle |
| `action` | `onboardingV2Block.action` | host capability (`network-scan` \| `connection-check` \| `device-test`); each outcome is a routing handle |
| `action` (device test) | `onboardingV2Block.deviceTest` | hand detected devices to the energy app and branch on whether appliances were found or created |
| `action` (OCPP) | `onboardingV2Block.ocppConnect` | wait for an OCPP charger to dial into enyo's CSMS; branches `connected` \| `timeout` |
| `link` | `onboardingV2Block.link` | a fixed `http(s)` URL to open or copy (passive — no routing handle) |
| `input` | `onboardingV2Block.input` | the installer types a value, the host checks it and branches |
| `auth` | `onboardingV2Block.auth` | sign into the energy app's account system; one server-decided success handle |

`choice`, `action`, `input` and `auth` are the graph's **decision points**: every option/outcome
must be wired by exactly one transition (`onOptionV2` / `onOutcomeV2`); a step with
no decision block is wired by a single `onContinueV2`. The validator enforces this
along with unique ids/slugs, resolvable targets, and reachability warnings.

### Testing devices from a guide (`device-test`)

`network-scan` finds a box at an IP. It cannot tell you whether that box is *your*
inverter — only the energy app knows the register map, the auth handshake and the
model fingerprint — and it cannot create the appliance. That is what the
`device-test` action is for: the host hands the detected devices to the app's
registered handler (`useDeviceTest()`, see the SDK README) and branches on the
verdict.

Its outcome `value`s are **not free-form**: they must be members of
`EnyoDeviceTestOutcomeEnum`, because they are exactly what the handler can return.

```typescript
onboardingV2Block.deviceTest(
  'probe',
  t('Gerät prüfen', 'Test the device'),
  [
    {id: 'created', value: EnyoDeviceTestOutcomeEnum.AppliancesCreated, label: t('Eingerichtet', 'Set up')},
    {id: 'known',   value: EnyoDeviceTestOutcomeEnum.AppliancesAlreadyExisted, label: t('Bereits bekannt', 'Already known')},
    {id: 'auth',    value: EnyoDeviceTestOutcomeEnum.AuthenticationRequired, label: t('Passwort nötig', 'Password needed')},
    {id: 'failed',  value: EnyoDeviceTestOutcomeEnum.Failed, label: t('Fehlgeschlagen', 'Failed')},
  ],
  EnyoOnboardingV2DeviceSelection.Detected,
)
```

`deviceSelection` decides which devices are passed along: `detected` (everything
the preceding `network-scan` turned up, the default), `current` (the single device
the run is bound to), or `user-selected` (the installer picks first).

The validator adds three rules on top of the normal wiring checks:

- every outcome `value` must be an `EnyoDeviceTestOutcomeEnum` member — an unknown
  value is a branch that can never fire;
- `failed` **must** be wired. Every breakdown lands there, including a handler the
  host gave up waiting for, so a guide without it strands the installer on a step
  with no exit;
- each outcome the block does not handle is reported as a warning, so dropping one
  is a decision rather than an oversight.

### Exits: success, support, and "enyo übernimmt"

A run leaves the graph through a `target` that is not a step:

| Target | Factory | Meaning |
|---|---|---|
| `success` | `onboardingV2Target.success()` | onboarding succeeded; hand back to the app |
| `support` | `onboardingV2Target.support(reason?)` | escalate to enyo support |
| `pause` (`enyo-todo`) | `onboardingV2Target.enyoTakeover()` | **enyo übernimmt** — the installer is done, enyo finishes the setup |
| `pause` (other reasons) | `onboardingV2Target.pause(reason, resumeStepName?)` | park the run, resumable |
| `start-variant` | `onboardingV2Target.variant(v)` | jump into another start variant's flow |

`enyo-todo` still travels on the wire as a `pause` reason — nothing migrates — but
it is **a terminal exit alongside `success` and `support`**, not a park: the app
renders the takeover screen instead of bouncing to the cockpit, and there is
nothing for the installer to resume (a `resumeStepName` on it is warned about and
ignored).

The validator counts it accordingly: a guide completes if any branch reaches
`success` **or** the `enyo-todo` hand-off. A guide that legitimately ends in a
hand-off no longer draws a "can never complete" warning, so there is never a
reason to author a fake success path to silence one.

`support` takes an optional `reason` — a short internal key such as
`firmware-too-old`, never shown to the installer — so a hand-off can say what
failed:

```typescript
onOutcomeV2('probe', 'failed', onboardingV2Target.support('device-unreachable-after-retry'))
```

### Signing into the energy app (`auth`)

An OAuth app (Solarweb, iSolarCloud, …) sees nothing until the installer signs
into the vendor account. The `authentication-required` device-test outcome cannot
serve as that login — it *routes to* a credentials step, it cannot *be* one. The
`auth` block is the login itself.

```typescript
onboardingV2Block.auth(
  'login',
  t('Bei Solarweb anmelden', 'Sign in to Solarweb'),
  {id: 'ok', label: t('Angemeldet', 'Signed in')},
  {help: t('Zugangsdaten des Anlagenbetreibers nutzen.', "Use the plant owner's credentials.")},
)
// transitions: [onOutcomeV2('login', 'ok', onboardingV2Target.step('pick-plant'))]
```

It exposes exactly **one** handle, and it means "the login succeeded". The
**server** decides when that fires — only a backend-confirmed session for this app
and installation releases the step — so a client cannot skip past it, and there is
no failure branch to author: a failed attempt simply keeps the installer on the
step to retry.

The validator requires the handle to be wired, allows at most one `auth` block per
step, and warns when another decision block sits next to it, since that would
offer a way past a gate the client is not allowed to skip.

### Waiting for an OCPP charger (`ocpp-connect`)

An OCPP wallbox is never on the LAN to be found, so `network-scan` is not a
substitute — it searches for something that is not there and then frames the
result as a failure. `ocpp-connect` searches nothing: the installer enters the
dynamic OCPP URL (`onboardingV2Block.dynamic(..., EnyoOnboardingV2DynamicKind.OcppUrl)`)
in the charger's own configuration, and this block waits for the charger to dial
into enyo's CSMS.

```typescript
onboardingV2Block.ocppConnect('await-ocpp', t('Auf Verbindung warten', 'Wait for the connection'), [
  {id: 'up',   value: EnyoOnboardingV2OcppConnectOutcome.Connected, label: t('Verbunden', 'Connected')},
  {id: 'none', value: EnyoOnboardingV2OcppConnectOutcome.Timeout,   label: t('Keine Verbindung', 'No connection')},
])
```

Outcome `value`s are closed over `EnyoOnboardingV2OcppConnectOutcome`, and **both**
must be wired: a charger that never calls home — wrong URL typed, no coverage in
the garage — is the common case, and a guide without a `timeout` branch strands
the installer on a spinner.

### Skipping the host's network scan (`requiresNetworkScan`)

`requiresNetworkScan` defaults to `true`: before entering the guide, the host scans
the local network and frames what follows around what it found. That is right for a
LAN device and wrong for one that is never there — an OCPP wallbox, a cloud-only
inverter. Setting it to `false` means *don't search, start here*: the run opens at
`startStepId` instead of spending ~20 s on a scan that must fail and showing "we
couldn't find your device".

```typescript
defineOnboardingGuideV2({
  title: t('Wallbox über OCPP', 'Wallbox via OCPP'),
  startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
  requiresNetworkScan: false,
  startStepId: 'enter-url',
  steps: [/* … */],
});
```

A guide that opts out has no scan results to work with, so `deviceSelection:
'detected'` has nothing to select from — the validator warns about that
combination unless the guide runs its own `network-scan` action first.
