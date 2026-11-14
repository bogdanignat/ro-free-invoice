import { QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

import { useAppQueryClient } from "../hooks/use-app-query-client.ts"
import { ConfirmContext } from "../hooks/use-confirm.ts"
import { createConfirmController } from "../lib/confirm-controller.ts"
import { AuthProvider } from "./AuthProvider.tsx"
import { ConfirmDialog } from "./ui/ConfirmDialog.tsx"

export const AppProviders = ({ children }: { readonly children: ReactNode }) => {
  const queryClient = useAppQueryClient()
  const [confirm] = useState(createConfirmController)
  return <QueryClientProvider client={queryClient}><AuthProvider>
    <ConfirmContext value={confirm}>{children}<ConfirmDialog controller={confirm} /></ConfirmContext>
  </AuthProvider></QueryClientProvider>
}
