# Anchor

A logs explorer prototype with an in-place "View Context" affordance — surrounding lines fluidly expand around the selected line while filters and live tail stay intact.

> **Status:** in active development. This README is a stub; it will grow with the project. Screenshots and a live demo link will land when the prototype is ready to show.

## Tech stack

- **[Next.js](https://nextjs.org/)** (App Router) on **React 19**
- **TypeScript**, strict mode
- **CSS Modules** with **CSS custom properties** for design tokens
- **[JetBrains Mono](https://www.jetbrains.com/lp/mono/)** via `next/font/google`
- **pnpm** for package management
- **Turbopack** as the dev bundler

Animation, accessible primitives, and other libraries will be introduced as the relevant features are built.

## Run locally

Requirements: **Node.js 20+** and **pnpm**.

```bash
# Install dependencies
pnpm install

# Start the dev server (Turbopack)
pnpm dev
```

Then open <http://localhost:3000>.

## License

[MIT](./LICENSE) — © 2026 Jamie Thompson
