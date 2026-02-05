# Onboarding Flow Documentation

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
