"use client";

import { useSyncExternalStore } from "react";
import { getConsent, subscribeConsent, type ConsentState } from "@/lib/consent";

const SERVER: ConsentState = { analytics: null, version: 0, decidedAt: null };

export function useConsent(): ConsentState {
  return useSyncExternalStore(subscribeConsent, getConsent, () => SERVER);
}
