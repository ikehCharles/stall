import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { INTENT } from "./enums";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isValidEmail = (val:string)=> /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);


export const generateInvoiceUrl = (bookingId: string) => {
  const url = `${window.location.origin}/vendor/invoice/${bookingId}`;
  return url
};

export const formatCurrency = (amount: number, currency?: string) => {
  return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
  }).format(amount);
};

export const getCurrencySymbol = (currency?: string) => {
  return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
  }).formatToParts(0).find(part => part.type === 'currency')?.value || currency;
};

export enum PAYMENT_SWITCH_ENUM {
  PAYPAL = "paypal",
  SIMULATION = "simulation",
}

export const ENV = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  AUTH_VERIFICATION_MODE: import.meta.env.VITE_AUTH_VERIFICATION_MODE,
  PAYMENT_SWITCH: import.meta.env.VITE_PAYMENT_SWITCH,
  PAYMENT_INTENT: Number(import.meta.env.VITE_PAYMENT_INTENT || INTENT.CAPTURE),
};

export const MAXKYCREVIEWCOUNT = 3;