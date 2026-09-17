"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    const id = setTimeout(() => reset(), 10000);
    return () => clearTimeout(id);
  }, [error, reset]);

  return (
    <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-6 text-sm text-neutral-300 space-y-3 max-w-xl mx-auto mt-12">
      <h2 className="text-amber-400 font-medium text-base">Waking up the server</h2>
      <p>
        This site runs on a free-tier backend that sleeps after 15 minutes idle. The API is
        starting up now &mdash; that usually takes 30&ndash;60 seconds.
      </p>
      <button
        onClick={() => reset()}
        className="text-xs px-3 py-1.5 rounded-full border border-amber-700 text-amber-400 hover:bg-amber-900/20 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
