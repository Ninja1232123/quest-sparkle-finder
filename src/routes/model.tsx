import { createFileRoute, redirect } from "@tanstack/react-router";
import { validateSourceSearch } from "@/lib/source-browser";

// The UCC moved to its own clean slug (/ucc). /model is kept only to 301 any
// old links / previously-indexed URLs there, preserving drill-down search
// params so a deep link still lands in the same place.
export const Route = createFileRoute("/model")({
  validateSearch: validateSourceSearch,
  loaderDeps: ({ search }) => search,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/ucc", search, statusCode: 301 });
  },
});
