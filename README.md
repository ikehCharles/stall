# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/d9a7acf5-9e62-4c4e-b5ff-25496221631b

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d9a7acf5-9e62-4c4e-b5ff-25496221631b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d9a7acf5-9e62-4c4e-b5ff-25496221631b) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Connecting via Local

#### Requirement

* Setup /supabase/.env(SUPABASE)

  * PAYPAL_API_CLIENT=""
  * PAYPAL_API_SECRET=""
  * PAYPAL_API=""
  * CLIENT_BASEURL=""
* Setup .env(REACT)

  * VITE_SUPABASE_PROJECT_ID=""
  * VITE_SUPABASE_PUBLISHABLE_KEY=""
  * VITE_SUPABASE_URL=""
  * AUTH_VERIFICATION_MODE=""
  * PAYMENT_SWITCH=""
* Install Docker Desktop and get it running
* Install [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started?queryGroups=access-method&access-method=studio&queryGroups=platform&platform=npm)

#### SCRIPT

###### Database Commands

* Run Supabase locally: [`supabase init`](https://supabase.com/docs/reference/cli/usage#supabase-init) and [`supabase start`](https://supabase.com/docs/reference/cli/usage#supabase-start)
* Manage database migrations: [`supabase migration`](https://supabase.com/docs/reference/cli/usage#supabase-migration)
* Generate types directly from your database schema: [`supabase gen types`](https://supabase.com/docs/reference/cli/usage#supabase-gen)
* Resetting local database... supabase db reset
* CI/CD for releasing to production: [`supabase db push`](https://supabase.com/docs/reference/cli/usage#supabase-db-push)
* Manage your Supabase projects: [`supabase projects`](https://supabase.com/docs/reference/cli/usage#supabase-projects)

**Functions Command**

* [supabase functions download](https://supabase.com/docs/reference/cli/supabase-functions-download)
* [supabase functions list](https://supabase.com/docs/reference/cli/supabase-functions-list)
* [supabase functions serve](https://supabase.com/docs/reference/cli/supabase-functions-serve)
* [supabase functions new](https://supabase.com/docs/reference/cli/supabase-functions-new)
* [supabase functions deploy](https://supabase.com/docs/reference/cli/supabase-functions-deploy)
* [supabase functions delete](https://supabase.com/docs/reference/cli/supabase-functions-delete)

###### React/SPA Command

* npm run dev (start locally)
* npm run build (generate build files)
