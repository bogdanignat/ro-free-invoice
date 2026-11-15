import { createFileRoute, redirect } from "@tanstack/react-router"

/** `/clients` is the Romanian-minded alias of the customer list. */
export const Route = createFileRoute("/clients")({
  beforeLoad: () => { redirect({ to: "/customers", replace: true, throw: true }) },
})
