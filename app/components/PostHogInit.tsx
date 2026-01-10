"use client";

import { useEffect } from "react";
import { initInstrumentation } from "@/instrumentation-client";

export default function PostHogInit() {
  useEffect(() => {
    initInstrumentation();
  }, []);

  return null;
}
