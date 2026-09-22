/**
 * Runtime environment an energy app is executed in.
 *
 * The environment is handed to the callback passed to `register()` so an app can
 * adapt its behaviour, e.g. use verbose logging or mocked hardware access while
 * developing, and skip anything that requires real hardware when it runs inside
 * the developer portal simulation.
 */
export enum EnyoEnergyAppEnvironment {
    /** Running on a real enyo device in development mode (e.g. a developer's test device). */
    OnDeviceDevelopment = 'on-device-development',
    /** Running on a real enyo device in production, i.e. at a customer's site. */
    OnDeviceProduction = 'on-device-production',
    /** Running inside the developer portal simulation, without real hardware attached. */
    DeveloperPortalSimulation = 'developer-portal-simulation',
}
