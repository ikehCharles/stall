/**
 * Centralised app branding defaults.
 *
 * The canonical values are stored in the `settings` table (key = "app_name", source = "platform")
 * and exposed through `usePlatformSettings().data.appName`.
 *
 * These constants are used as the fallback when settings haven't loaded yet
 * or on unauthenticated pages (e.g. the login screen).
 */

export const APP_NAME_DEFAULT = "Stall Inc";

/** First letter of the app name — used for the letter-logo. */
export const appInitial = (name?: string | null) =>
  (name || APP_NAME_DEFAULT).charAt(0).toUpperCase();
