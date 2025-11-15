// src/utils/version.ts
// Utility to get app version from package.json (frontend)
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "0.0.0";
export const IS_TEST = import.meta.env.VITE_ENV !== "prod";
