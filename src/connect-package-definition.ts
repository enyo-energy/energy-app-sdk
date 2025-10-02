import {ConnectEmsPermissionType} from "./connect-ems-permission.type.js";

export interface ConnectPackageRestrictedInternetAccessOption {
    // List of allowed internet origins (domains) that the EMS Integration can access. Only these origins will be accessible. This information is shown to the user
    origins: string[];
}

export interface ConnectPackageOptions {
    restrictedInternetAccess?: ConnectPackageRestrictedInternetAccessOption;
}

export interface ConnectPackageDefinition {
    version: '1';
    packageName: string;
    permissions: ConnectEmsPermissionType[];
    options?: ConnectPackageOptions;
}

export function defineConnectEmsPackage(definition: ConnectPackageDefinition) {
    return definition;
}