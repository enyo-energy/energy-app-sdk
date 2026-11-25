# Legionella Program Guide

How to move the weekly legionella program (thermal disinfection) of heat pumps and heating rods to a better time — for **energy apps** (device integrations), the **energy manager** and **core / the enyo app**.

## Contents

- [What it does](#what-it-does)
- [Key concepts](#key-concepts)
- [1. Energy app: heat pump integration](#1-energy-app-heat-pump-integration)
- [2. Energy app: heating rod](#2-energy-app-heating-rod)
- [3. Energy manager](#3-energy-manager)
- [4. Core / enyo app](#4-core--enyo-app)
- [5. Answers at a glance](#5-answers-at-a-glance-setlegionellaschedulev1)
- [API overview](#api-overview)

---

## What it does

A hot water tank has to be heated to about 60 °C once a week. The owner sets a fixed slot on the device, e.g. **Saturday 01:00** — often an expensive time with no sun. The energy manager can move that slot to a better time, e.g. **Saturday 13:00** with PV surplus. It changes only the weekday and / or the time — never the temperature or the weekly rhythm. The device always runs the program itself.

The customer chooses per device how much the energy manager may do:

| Mode | What happens |
|---|---|
| `Off` | Nothing. The device runs at the owner's slot. |
| `Recommend` (default) | The energy manager proposes a better slot in the enyo app; the customer accepts or rejects it. |
| `Auto` | The energy manager moves the slot every week by itself and puts the owner's slot back afterwards. |

It works for **heat pumps** (per hot water zone) and **standalone heating rods**.

```
                    ┌─ Off ─────── device runs at the owner's slot
 customer's mode ───┼─ Recommend ─ HeatpumpRecommendationsV1 → answer → SetLegionellaScheduleV1
                    └─ Auto ────── SetLegionellaScheduleV1 every week, then restore
```

---

## Key concepts

| Term | Meaning |
|---|---|
| `EnyoLegionellaSlot` | `{dayOfWeek: 0–6 (0 = Sunday), timeOfDay: 'HH:mm'}` — local site time, as the device stores it |
| `ownerSlot` | The owner's own slot. Never overwritten by the energy manager; what a restore puts back |
| `energyManagerSlot` | The slot the energy manager wrote. Unset while the owner's slot applies |
| `activeSlot` | What the device holds right now |
| `adjustable` | `DayAndTime` or `TimeOnly` — what the integration can write |
| `LEGIONELLA_PROGRAM_MAX_GAP_HOURS` | 192 h (8 days) — longest allowed time between two runs |
| `LEGIONELLA_PROGRAM_MIN_LEAD_MINUTES` | 60 min — a move must arrive this long before the owner's run it replaces |

Device features (each on heat pumps and heating rods):

| Feature | Required? | Effect |
|---|---|---|
| *(only report `legionella` metadata)* | — | The area appears; `Off` / `Recommend` only, the customer changes the slot by hand |
| `LegionellaSchedule` + `legionella.adjustable` | for `Auto` | The energy manager can write the slot via `SetLegionellaScheduleV1` |
| `LegionellaRunStatus` | optional | The app reports each run with `LegionellaStatusV1` |

Messages:

| Message | From → to | Purpose |
|---|---|---|
| `SetLegionellaScheduleV1` | energy manager → energy app | Write a new slot, or restore the owner's slot. Answered with `CommandAcknowledgeV1` |
| `LegionellaStatusV1` (optional) | energy app → energy manager, core | A run is scheduled, running, completed or failed |
| `HeatpumpRecommendationsV1` & co. | energy manager ↔ core | `LegionellaProgramShift` recommendations, also for heating rods |

---

## 1. Energy app: heat pump integration

### 1.1 Report the program

On each hot water zone that has a legionella program:

```ts
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoLegionellaSlotAdjustableEnum,
} from '@enyo-energy/energy-app-sdk';

await applianceManager.updateAppliance(applianceId, {
    heatpump: {
        availableFeatures: [
            // …your other features
            Feature.LegionellaSchedule,   // the app can write the slot
            Feature.LegionellaRunStatus,  // optional: the app reports runs
        ],
    },
});

await applianceManager.updateHeatpumpDomesticHotWater(applianceId, 0, {
    legionella: {
        ownerSlot: {dayOfWeek: 6, timeOfDay: '01:00'},   // read from the device
        activeSlot: {dayOfWeek: 6, timeOfDay: '01:00'},
        adjustable: EnyoLegionellaSlotAdjustableEnum.TimeOnly,
        granularityMinutes: 15,          // device only takes quarter hours
        targetTemperatureC: 60,
        estimatedDurationMinutes: 90,
        lastCompletedIso: '2026-11-21T01:35:00+01:00',  // if the device knows it
    },
});
```

Check the metadata with `validateHeatpumpAdvancedMetadata()` — it runs `validateLegionellaProgramMetadata()` for every zone.

#### Default mode

Until the customer picks a mode, the area starts on `Recommend`. If the device's own program should stay in charge until the customer opts in, register `Off` as the default. The integration owns `controlModeDefaults` and the host keeps it as written. Never write `controlModes` itself, which belongs to the customer.

```ts
await applianceManager.updateAppliance(applianceId, {
    heatpump: {
        controlModeDefaults: {
            [EnyoHeatpumpControlAreaEnum.LegionellaProgram]: EnyoHeatpumpControlModeEnum.Off,
        },
    },
});
```

Only `Off` and `Recommend` are allowed. `Auto` must be the customer's choice, so the validator rejects it and the resolvers ignore it. A mode the customer stored always wins over the default.

### 1.2 Handle the command

The base class subscribes to `SetLegionellaScheduleV1`, validates it, and — after an `Accepted` answer — stores the slot as `energyManagerSlot`. You only write it:

```ts
class MyHeatpump extends HeatpumpIntegrationEnergyApp {
    protected async handleLegionellaSchedule(message: EnyoDataBusSetLegionellaScheduleV1) {
        const {slot} = message.data;          // already validated
        try {
            await this.device.writeLegionellaStart(slot.dayOfWeek, slot.timeOfDay);
            return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
        } catch (e) {
            return {answer: EnyoCommandAcknowledgeAnswerEnum.Rejected, rejectionReason: String(e)};
        }
    }
}
```

Already rejected (or `NotSupported`) before your handler: malformed data, missing feature / program / `adjustable`, another weekday under `TimeOnly`, a time off the grid, `restored` with a slot other than the owner's, a next run in the past, a move closer than 60 min to the owner's run, and a move that skips a week.

Never start or stop a run, never change the temperature — only write the start slot. To store the metadata somewhere else, override `recordLegionellaSchedule()`.

### 1.3 Notice when the owner changes it by hand

Every time you read the slot from the device:

```ts
const zone = (await applianceManager.getById(applianceId))!.heatpump!.domesticHotWater![0];
const deviceSlot = await this.device.readLegionellaStart();   // {dayOfWeek, timeOfDay}

const {program, ownerChanged} = reconcileLegionellaProgram(zone.legionella!, deviceSlot);
await applianceManager.updateHeatpumpDomesticHotWater(applianceId, 0, {legionella: program});
```

A slot that is neither the energy manager's nor the owner's was set by the owner. It becomes the new `ownerSlot`, and the energy manager plans from it from now on.

### 1.4 Optional: report runs (`LegionellaRunStatus`)

If the device reports its runs, publish each state change:

```ts
this.publishLegionellaStatus(applianceId, {
    domesticHotWaterIndex: 0,
    state: EnyoLegionellaRunStateEnum.Completed,
    slot: zone.legionella!.activeSlot!,
    movedByEnergyManager: zone.legionella!.energyManagerSlot !== undefined,
    startedIso: '2026-11-28T12:00:00.000Z',
    completedIso: '2026-11-28T13:20:00.000Z',
    reachedTemperatureC: 61,
});
```

| State | Required fields |
|---|---|
| `Scheduled` | `nextRunIso` — send it again whenever the slot changes |
| `Running` | `startedIso` |
| `Completed` | `startedIso`, `completedIso` |
| `Failed` | `startedIso`, `failureReason` |

If the device doesn't report runs, use the detector on the tank temperature:

```ts
const detector = new LegionellaRunDetector({targetTemperatureC: 60, holdMinutes: 30, maxDurationMinutes: 240});
detector.schedule(nextLegionellaRunIso(activeSlot, 'Europe/Berlin'));

// on every DHW temperature reading:
const event = detector.update(dhwTemperatureC);
if (event) {
    this.publishLegionellaStatus(applianceId, {...event, domesticHotWaterIndex: 0, slot: activeSlot, movedByEnergyManager});
    if (event.state !== EnyoLegionellaRunStateEnum.Running) {
        detector.schedule(nextLegionellaRunIso(activeSlot, 'Europe/Berlin'));   // next week's run
    }
}
```

The detector reports `Running` from the scheduled start, `Completed` once `targetTemperatureC − toleranceK` (default 1 K) held for `holdMinutes`, and `Failed` after `maxDurationMinutes`.

Sending no status at all is fine: leave `LegionellaRunStatus` out, and the energy manager uses timing instead.

---

## 2. Energy app: heating rod

Heating rods have no integration base class, so the app wires the command itself. The rules are the same.

```ts
// 1. Report
await applianceManager.updateAppliance(rodId, {
    heatingRod: {
        ...rod.heatingRod!,
        availableFeatures: [...rod.heatingRod!.availableFeatures, EnyoHeatingRodApplianceAvailableFeaturesEnum.LegionellaSchedule],
        legionella: {
            ownerSlot: {dayOfWeek: 6, timeOfDay: '01:00'},
            adjustable: EnyoLegionellaSlotAdjustableEnum.DayAndTime,
            targetTemperatureC: 60,
            estimatedDurationMinutes: 120,
        },
    },
});

// 2. Handle the command
dataBus.listenForMessages([EnyoDataBusMessageEnum.SetLegionellaScheduleV1], async (entry) => {
    const message = entry as EnyoDataBusSetLegionellaScheduleV1;
    if (message.applianceId !== rodId) return;                    // not ours: no answer

    const rod = (await applianceManager.getById(rodId))!.heatingRod!;
    const result = validateHeatingRodLegionellaSchedule(message.data, rod);
    if (result.answer === EnyoCommandAcknowledgeAnswerEnum.Accepted) {
        await device.writeLegionellaStart(message.data.slot);
        // remember what the energy manager wrote (the base class does this for heat pumps)
        await applianceManager.updateAppliance(rodId, {
            heatingRod: {...rod, legionella: applyLegionellaSchedule(rod.legionella!, message.data)},
        });
    }
    dataBus.sendMessage([{
        id: crypto.randomUUID(),
        type: 'answer',
        message: EnyoDataBusMessageEnum.CommandAcknowledgeV1,
        source: EnyoSourceEnum.Device,
        applianceId: rodId,
        timestampIso: new Date().toISOString(),
        data: {
            messageId: message.id,
            acknowledgeMessage: message.message,
            answer: result.answer,
            rejectionReason: result.rejectionReason,
        },
    }]);
});

// 3. Reconcile on every device read
const {program} = reconcileLegionellaProgram(rod.legionella!, await device.readLegionellaStart());

// 4. Optional status
dataBus.sendMessage([buildLegionellaStatusMessage(rodId, status, EnyoSourceEnum.Device)]);
```

Report `legionella` on a rod only when the rod runs the program itself. A rod in a heat pump tank whose heat pump runs it reports nothing — the heat pump's hot water zone covers it.

---

## 3. Energy manager

### 3.1 Declare the features

```ts
energyApp.useEnergyManager().registerFeatures([
    EnergyManagerFeatureEnum.HeatpumpRecommendations,  // recommendation messages
    EnergyManagerFeatureEnum.LegionellaProgram,        // the legionella area
]);
```

The enyo app shows the area only while the active energy manager declares `LegionellaProgram`.

### 3.2 Read the mode per device

```ts
const hpModes  = resolveHeatpumpControlModes(heatpump.heatpump!, settings);
const rodModes = resolveHeatingRodControlModes(rod.heatingRod!);

const mode = hpModes[EnyoHeatpumpControlAreaEnum.LegionellaProgram];   // undefined = area not offered
```

Always read the mode through these functions: they apply the default (the integration's `controlModeDefaults`, else `Recommend`), fall back when the device can't do `Auto`, and resolve monitor-only devices to `Off`.

### 3.3 Compute the times

```ts
const tz = 'Europe/Berlin';
const program = zone.legionella!;
const ownerRunIso = nextLegionellaRunIso(program.ownerSlot, tz);       // the run being replaced
const proposed = {dayOfWeek: 6, timeOfDay: '13:00'};                   // from your PV / price plan
const nextRunIso = nextLegionellaRunIso(proposed, tz, Date.parse(ownerRunIso) - 24 * 3_600_000);
```

Rules for the slot you pick:

- With `TimeOnly`, keep `ownerSlot.dayOfWeek`. Stay on the `granularityMinutes` grid.
- `nextRunIso` at most `LEGIONELLA_PROGRAM_MAX_GAP_HOURS` after `lastCompletedIso`.
- **Plan at the evaluation before the owner's run** (18:00 the day before, or the one before for a night slot) and send at least 60 min before `ownerRunIso`. Once the owner's run of a week has passed, don't move that week — it would run twice.
- Check before sending: `validateHeatpumpLegionellaSchedule(data, metadata)` / `validateHeatingRodLegionellaSchedule(data, metadata)`.

### 3.4 Auto mode

```
Energy manager                       Energy app                  Device
     │──SetLegionellaScheduleV1─────────▶│ validate, write          │
     │   slot Sat 13:00                  │──start Sat 13:00────────▶│
     │◀──CommandAcknowledgeV1 Accepted───│ energyManagerSlot stored │
     │◀──LegionellaStatusV1 (optional)───│ scheduled/running/…      │ runs at 13:00
     │──SetLegionellaScheduleV1─────────▶│                          │
     │   slot Sat 01:00, restored: true  │──start Sat 01:00────────▶│
```

1. Send `SetLegionellaScheduleV1` with `slot`, `nextRunIso`, `ownerRunIso` and a reason, e.g. `deviceSetting: {setting: EnyoDeviceSettingEnum.HygieneProgramStart, ownerValue, appliedValue}`.
2. Wait for `CommandAcknowledgeV1`.
3. **Run done?** With `LegionellaRunStatus`: on `LegionellaStatusV1` `Completed` or `Failed`. Without: at `nextRunIso + estimatedDurationMinutes`.
4. Restore: `SetLegionellaScheduleV1` with `slot: ownerSlot`, `restored: true`, `ownerRunIso = nextRunIso` = the owner's next run.
5. If the customer switches the area to `Off` while a slot is moved, restore right away.

### 3.5 Recommend mode

```
Energy manager                      Core / enyo app              Energy app
 │──HeatpumpRecommendationsV1────────▶│ "Sat 01:00 → Sat 13:00"      │
 │◀──HeatpumpRecommendationAnswerV1───│ customer accepts             │
 │──HeatpumpRecommendationStatusV1───▶│ accepted                     │
 │──SetLegionellaScheduleV1──────────────────────────────────────────▶│
 │──HeatpumpRecommendationStatusV1───▶│ active                       │
 │   … run, restore (OneTime) …       │                              │
 │──HeatpumpRecommendationStatusV1───▶│ completed                    │
```

1. At 06:00 / 18:00 (and right away when the area switches to `Recommend`) include in `HeatpumpRecommendationsV1` — addressed to the heat pump, or to the rod:

   ```ts
   {
       id: `${applianceId}:legionella-program-shift:0:6-13:00:2026-11-28`,   // deterministic
       area: EnyoHeatpumpControlAreaEnum.LegionellaProgram,
       type: EnyoHeatpumpRecommendationTypeEnum.LegionellaProgramShift,
       cause: EnyoHeatpumpRecommendationCauseEnum.SolarSurplus,
       execution: EnyoHeatpumpRecommendationExecutionEnum.OneTime,   // or Permanent / Manual
       window: {startIso: '2026-11-28T11:00:00Z', endIso: '2026-11-28T14:00:00Z'},
       validUntilIso: '2026-11-27T23:00:00Z',     // ≤ ownerRunIso − 60 min
       benefit: {kind: EnyoHeatpumpRecommendationBenefitKindEnum.SolarEnergyKwh, value: 3.1},
       params: {
           domesticHotWaterIndex: 0,
           currentSlot: {dayOfWeek: 6, timeOfDay: '01:00'},
           proposedSlot: {dayOfWeek: 6, timeOfDay: '13:00'},
           nextRunIso: '2026-11-28T12:00:00Z',    // inside window for OneTime
           targetTemperatureC: 60,
       },
   }
   ```

   | Execution | Use when | On accept | On reset |
   |---|---|---|---|
   | `OneTime` | device has `LegionellaSchedule` | move this week's run, restore after it | restore now |
   | `Permanent` | device has `LegionellaSchedule` | write `proposedSlot` and hold it | restore the owner's slot |
   | `Manual` | device can't be written | the customer sets it on the device | compute with the previous slot again |

2. **Answer from core** (`HeatpumpRecommendationAnswerV1`): check again that it still holds, report `Accepted`, carry it out, report `Active`.
3. **Ending:**

   | Outcome | Status |
   |---|---|
   | Run finished | `Completed` |
   | Run failed | `Aborted`, stop reason `Failed` (restore right away) |
   | Device answered `Rejected` / `NotSupported` | `Aborted`, stop reason `ControlNotPossible` |
   | Owner changed it on the device (`ownerSlot` changed, `energyManagerSlot` gone) | `Aborted`, stop reason `ChangedOnDevice` |
   | `Manual` | done once `ownerSlot` equals `proposedSlot` |

Validate the list with `validateHeatpumpRecommendationsMessage()` before sending.

---

## 4. Core / enyo app

- **Show the area** only when the active energy manager declares `EnergyManagerFeatureEnum.LegionellaProgram`. Offered areas and modes:
  - heat pumps: `heatpumpControlAreas()` / `availableHeatpumpControlModes()`
  - heating rods: `heatingRodControlAreas()` / `availableHeatingRodControlModes()`
- **Store the customer's choice** in `controlModes[LegionellaProgram]` on the appliance. It is customer-owned: keep it when an integration saves the appliance.
- **Keep the integration's `controlModeDefaults`** as the integration writes it (integration-owned, the opposite of `controlModes`). Show the resolved mode, not the raw fields.
- **Recommendations** use the existing flow — `HeatpumpRecommendationsV1` in, `HeatpumpRecommendationAnswerV1` / `ResetHeatpumpRecommendationV1` out, `HeatpumpRecommendationStatusV1` in. Heating rods use the same messages with the rod's `applianceId`. Build the texts for `LegionellaProgramShift` from its `params`, `cause` and `benefit`; validate incoming lists with `validateHeatpumpRecommendationsMessage()`.
- **Show progress** from `LegionellaStatusV1` where the device sends it ("Next run Sat 13:00 — moved from 01:00 for solar power", then "Done 14:20, 61 °C"), also in `Auto`. Check it with `validateLegionellaStatusMessage()`. Without the status message, show `activeSlot` vs. `ownerSlot` from the metadata.

---

## 5. Answers at a glance (`SetLegionellaScheduleV1`)

| Situation | Answer |
|---|---|
| Malformed slot or timestamps | `Rejected` |
| No `LegionellaSchedule`, no program, no `adjustable` | `NotSupported` |
| `TimeOnly` and another weekday | `NotSupported` |
| Time off the `granularityMinutes` grid | `NotSupported` |
| `restored` but the slot isn't `ownerSlot` | `Rejected` |
| `nextRunIso` in the past | `Rejected` |
| Owner's run less than 60 min away or passed (not for restore) | `Rejected` |
| More than 8 days after `lastCompletedIso` (not for restore) | `Rejected` |
| Device can't be written right now | `Rejected` (your handler) |
| Everything fine | `Accepted` — `energyManagerSlot` stored |

---

## API overview

| Function / class | Used by | Purpose |
|---|---|---|
| `validateLegionellaProgramMetadata(program, scheduleDeclared)` | energy app | Check the reported `legionella` metadata |
| `validateHeatpumpLegionellaSchedule(data, metadata, now?)` | energy app, energy manager | Check a command for a heat pump |
| `validateHeatingRodLegionellaSchedule(data, metadata, now?)` | energy app, energy manager | Check a command for a heating rod |
| `applyLegionellaSchedule(program, data)` | heating rod app | Program after an accepted command (heat pumps: automatic) |
| `reconcileLegionellaProgram(program, deviceSlot)` | energy app | Detect an owner change on the device |
| `nextLegionellaRunIso(slot, timeZone, now?)` | energy manager, energy app | Next absolute start of a slot, DST-safe |
| `LegionellaRunDetector` | energy app | Detect runs from the tank temperature |
| `HeatpumpIntegrationEnergyApp.publishLegionellaStatus()` | heat pump app | Send `LegionellaStatusV1` |
| `buildLegionellaStatusMessage(applianceId, data, source)` | heating rod app | Build `LegionellaStatusV1` |
| `validateLegionellaStatusMessage(message)` | all | Check `LegionellaStatusV1` |
| `resolveHeatpumpControlModes()` / `resolveHeatingRodControlModes()` | energy manager, core | The mode that applies |
| `heatpumpControlAreas()` / `heatingRodControlAreas()`, `available…ControlModes()` | core | What the device offers |
