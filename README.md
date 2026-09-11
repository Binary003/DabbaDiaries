# DabbaDiaries

DabbaDiaries is a home-cooked tiffin subscription platform for Indian
households. Customers subscribe to meals from home cooks; cooks manage menus,
capacity, and handovers; admins verify kitchens and operate delivery zones.

## Monorepo

```text
apps/web       Customer and cook application
apps/admin     Separate admin back-office application
packages/core  Shared domain types and pure business rules
packages/ui    Shared React UI primitives and design tokens
packages/config Shared TypeScript configuration
supabase/      Database migrations, RLS, and Edge Functions
```

The public web build does not import the admin application. Admin is a separate
entry point and can be deployed to its own subdomain with independent auth and
environment variables.

## Development

Install dependencies from the repository root:

```bash
npm install
```

Run the public app at `http://127.0.0.1:5173`:

```bash
npm run dev:web
```

Run the admin app at `http://127.0.0.1:5174`:

```bash
npm run dev:admin
```

Validate the project:

```bash
npm run test
npm run typecheck
npm run build
```

## Supabase

Create a Supabase project, apply the migration in
`supabase/migrations`, and deploy the functions in `supabase/functions`.
Copy the relevant `.env.example` into each app's local environment file.
Only the publishable anon key belongs in frontend environment variables. Never
put a service-role key in either app.

Critical mutations are protected in the database: cook capacity is capped by a
transactional RPC, and only the assigned cook can confirm a handover code.
Customers can display their code but cannot mark an order delivered.

## Core rules

`packages/core` owns handover validation, capacity boundaries, delivery-mode
eligibility, and fee splits. The unit tests in `packages/core/tests` cover the
four-digit code boundary, capacity limits, distance calculation, and all three
delivery modes.
