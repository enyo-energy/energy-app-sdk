# Connect EMS API Client

This is the official TypeScript API client for Connect EMS.

## Installation

You can install the package using npm:

```bash
npm install connect-ems-api
```

## Usage

Here's a basic example of how to use the client:

```typescript
const { ConnectEmsApi } = require('connect-ems-api');

const client = new ConnectEmsApi('YOUR_API_KEY');

async function main() {
  try {
    const data = await client.someEndpoint();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

main();
```

## Building

To build the project, run the following command:

```bash
npm run build
```

This will compile the TypeScript code into JavaScript in the `dist` directory.

## Publishing to npm

To publish the package to the npm registry, follow these steps:

1.  **Login to npm:**
    If you haven't already, log in to your npm account from the command line:
    ```bash
    npm login
    ```

2.  **Update the version:**
    Before publishing a new version, it's a good practice to update the version number in `package.json`. You can do this manually or use the `npm version` command:
    ```bash
    npm version <major|minor|patch>
    ```

3.  **Publish the package:**
    Once you're ready, publish the package to npm:
    ```bash
    npm publish
    ```
    The `prepublishOnly` script in `package.json` will automatically run the build process before publishing.
