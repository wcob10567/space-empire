import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// AST selector for any `supabase.from(...)` call. Used to keep direct table
// access out of pages/components — see CLAUDE.md "Where things go".
const SUPABASE_FROM_SELECTOR =
  "CallExpression[callee.type='MemberExpression'][callee.object.name='supabase'][callee.property.name='from']"

const SUPABASE_FROM_MESSAGE =
  'Use `queries.X(...)` from src/services/queries.js (or `debitResources` from src/services/resources.js) ' +
  'instead of inline `supabase.from(...)` in pages / components. See CLAUDE.md.'

// Standard flat config — later entries override earlier ones for the same files.
export default [
  { ignores: ['dist', '.claude/**', 'backups/**'] },

  // Baseline recommended rules.
  js.configs.recommended,
  reactRefresh.configs.vite,

  // Project-wide overrides for js/jsx.
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Two classic React Hooks rules; the v7 React Compiler suite is off below.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Explicitly disable the v7 React Compiler rules. They flag legitimate
      // patterns in this codebase (Date.now in async handlers, supabase.from
      // mutations, inline TechNode/BuildingCard component definitions in big
      // page files) and don't offer a clean migration path here.
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
      'react-hooks/component-hook-factories': 'off',

      // Catch leftover debug logs. console.error/warn are legit in catch blocks.
      'no-console': ['warn', { allow: ['error', 'warn'] }],

      // Catch stranded imports + unused locals. Underscore-prefixed are intentional.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],

      // Discourage inline supabase.from() in pages / components.
      // The service files override this below.
      'no-restricted-syntax': ['warn', {
        selector: SUPABASE_FROM_SELECTOR,
        message: SUPABASE_FROM_MESSAGE,
      }],

      // Downgrade — fires on the classic Context "export Provider + useX hook from
      // one file" pattern (e.g. AuthContext.jsx). The HMR fast-refresh hit is real
      // but minor; not worth restructuring.
      'react-refresh/only-export-components': 'warn',
    },
  },

  // Service files: inline supabase.from() is the whole point.
  {
    files: ['src/services/**/*.{js,jsx}', 'src/lib/supabase.{js,jsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]
