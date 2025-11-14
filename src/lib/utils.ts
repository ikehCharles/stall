import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export enum PAYMENT_SWITCH_ENUM {
  PAYPAL = "paypal",
  SIMULATION = "simulation",
}

export const ENV = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  AUTH_VERIFICATION_MODE: import.meta.env.VITE_AUTH_VERIFICATION_MODE,
  PAYMENT_SWITCH: import.meta.env.VITE_PAYMENT_SWITCH,
};