"use client";

import posthog from 'posthog-js'

export function initInstrumentation() {
  if (typeof window !== 'undefined') {
    posthog.init("phc_v1zGl740rSRNUNCouxKTzOdK31AIcRRWXNf4VMpfa4y", {
      api_host: "https://us.i.posthog.com",
      person_profiles: 'identified_only', // Recommended for newer PostHog versions
      capture_pageview: false // We disable automatic capture to avoid double-counting in SPAs
    });
    console.log("PostHog initialized on client");
  }
}
