import type { APIRoute } from "astro";

const headers = { "Content-Type": "application/json" };

/** @deprecated Instant swaps replaced by trade approval flow. */
export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      error: "Direct swaps are disabled. Send a trade request for partner approval instead.",
    }),
    { status: 410, headers },
  );
};
