# Weverse API Client

This is a Node.js client for the Weverse API. However, please note that as of April 2025, the Weverse API has undergone significant changes that have affected the functionality of this client.

## Current Status

The Weverse API appears to have changed substantially, with previous API endpoints no longer functioning as expected. Our investigations have shown:

1. The old authentication method no longer works
2. The API endpoints have changed
3. Direct API access might now be restricted
4. The API might now be only intended for internal use by the Weverse web and mobile applications

## Usage Options

### Option 1: Use a Valid API Token

If you have a valid Weverse API token (obtained through browser inspection or other means), you can use it directly:

1. Create a `.env` file in the root directory
2. Add your API token:
   ```
   WEVERSE_API_TOKEN=your_api_token_here
   ```
3. Instantiate the client: `const weverseClient = require('./lib/weverseClient');`

### Option 2: Use a Third-Party Library

Consider using other third-party libraries that may have more up-to-date implementations:

1. [jonah-saltzman/weverse](https://github.com/jonah-saltzman/weverse)
2. [teamreflex/weverse-fetch](https://github.com/teamreflex/weverse-fetch)

### Option 3: Implement a Browser Automation Solution

If direct API access is no longer feasible, you might consider using browser automation tools like Puppeteer or Playwright to scrape content directly from the Weverse website.

## Dependencies

- axios
- dotenv
- node-forge (for authentication)

## Setup

```bash
npm install
```

## Troubleshooting

If you encounter issues:

1. Make sure your API token is valid and not expired
2. Verify that you're using the correct Weverse account with appropriate permissions
3. Consider that Weverse may have implemented stricter API access controls

## Disclaimer

This client is not officially supported by Weverse. The API is subject to change without notice, and using it may violate Weverse's terms of service. #
