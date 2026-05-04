/*
 * PostCSS configuration.
 *
 * Next.js (under Turbopack) processes every imported CSS file through
 * PostCSS using this config. The plugin order matters:
 *
 *   1. @csstools/postcss-global-data injects the @custom-media rules
 *      from src/app/custom-media.css into every CSS file before later
 *      plugins run. Without this step, postcss-custom-media would
 *      only see declarations within the file it's currently processing
 *      — and every CSS Module is its own file. The global-data plugin
 *      picks up only the at-rules it cares about, so consumer files
 *      aren't bloated with the rest of the source file's content.
 *
 *   2. postcss-custom-media compiles `@custom-media --name (...)`
 *      and rewrites `@media (--name)` references in the same pass.
 *      With (1) populating its scope, named queries work cross-file.
 */
const config = {
  plugins: {
    "@csstools/postcss-global-data": {
      files: ["src/app/custom-media.css"],
    },
    "postcss-custom-media": {},
  },
};

export default config;
