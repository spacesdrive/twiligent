import rootPackage from '../../package.json' with { type: 'json' };

// the release version from the root package.json, which every release sets, so the MCP server reports what is deployed
export const APP_VERSION: string = rootPackage.version;
