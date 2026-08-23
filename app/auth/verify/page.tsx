"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    const url = new URL("/verify-email", window.location.origin);
    if (token) {
      url.searchParams.set("token", token);
    }
    router.replace(url.pathname + url.search);
  }, [router, token]);

  return null;
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyRedirect />
    </Suspense>
  );
}
