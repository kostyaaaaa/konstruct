# apps

Every konstruct app lives here as its own pnpm workspace package. Empty for now.

An app is expected to:

- own its `package.json`, with shared code pulled in as `"@konstruct/<pkg>": "workspace:*"`
- own an `eslint.config.js` extending `@konstruct/eslint-config/base`
- inherit Prettier from the root config, or extend `@konstruct/prettier-config`
  in a local `prettier.config.js`
- have a description in `docs/apps/<app-name>.md`

See [docs/project/structure.md](../docs/project/structure.md).
