import { useLocation } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { AppLink } from "./ui/AppLink.tsx"
import { cx } from "./ui/cx.ts"
import { useAuth } from "../hooks/auth-context.ts"
import { integrationsActive, pluginActive } from "../lib/plugins.ts"
import { shellNavigation } from "../lib/shell-navigation.ts"

interface ShellProps {
  readonly unlocked: boolean
  readonly logoutPending?: boolean
  readonly onLogout?: () => void
  readonly children: ReactNode
}

// On a phone the sidebar is a bar over the page: the brand's words and the session line go.
const SIDEBAR = "sticky top-0 h-screen flex flex-col pt-[1.65rem] px-4 pb-4 text-invoice-sidebar-text"
  + " bg-[linear-gradient(180deg,var(--color-invoice-sidebar-start),var(--color-invoice-sidebar-end))]"
  + " narrow:static narrow:w-full narrow:h-auto narrow:flex-row narrow:items-center narrow:py-[.7rem]"

// A sidebar link's focus keeps the outline but drops the ring; the current link keeps its edge.
const NAV_LINK = "flex gap-3 items-center px-[.85rem] py-3 rounded-invoice-control text-invoice-sidebar-link no-underline"
  + " text-[.92rem] font-invoice-emphasis hover:text-invoice-on-primary hover:bg-invoice-sidebar-hover"
  + " aria-[current]:text-invoice-on-primary aria-[current]:bg-invoice-sidebar-hover"
  + " aria-[current]:shadow-[inset_3px_0_var(--color-invoice-sidebar-active)] not-aria-[current]:focus-visible:shadow-none narrow:p-[.6rem]"

/**
 * The frame every screen is rendered in. The navigation model is computed in
 * `lib/shell-navigation.ts`: this component only renders it, and the current
 * section comes from the router's own path rather than from a prop each view
 * would have to remember to pass. Its links are the router's, so moving between
 * sections keeps the page, the session and the cached data.
 */
export const Shell = ({ unlocked, logoutPending = false, onLogout, children }: ShellProps) => {
  const pathname = useLocation({ select: (location) => location.pathname })
  const auth = useAuth()
  const links = shellNavigation(pathname, unlocked, { integrations: integrationsActive(auth), received: pluginActive(auth, "efactura") })
  return <div className="grid grid-cols-[238px_minmax(0,1fr)] min-h-screen narrow:block">
    <a className="fixed z-20 top-4 left-4 px-4 py-[.7rem] rounded-invoice-control text-invoice-on-primary bg-invoice-primary -translate-y-[180%] focus:translate-y-0"
      href="#main-content">Sari la conținut</a>
    <aside className={cx(SIDEBAR, !unlocked && "narrow:hidden")}>
      <AppLink className="flex items-center gap-[.8rem] mx-[.45rem] mb-9 no-underline focus-visible:shadow-none narrow:ml-0 narrow:mr-auto narrow:mb-0"
        aria-label="RO Free Invoice" href={unlocked ? "/" : "/unlock"}>
        <span className="grid place-items-center size-[2.35rem] rounded-invoice-container text-invoice-sidebar-brand-ink bg-invoice-sidebar-brand-surface font-invoice-display text-[1.4rem] font-bold">R</span>
        <span className="narrow:hidden">
          <strong className="block tracking-[.1em]">RO Free</strong>
          <small className="block mt-[.05rem] text-invoice-sidebar-muted text-invoice-caption tracking-[.13em] uppercase">Invoice</small>
        </span>
      </AppLink>
      <nav className={cx("grid gap-[.35rem]", !unlocked && "invisible")} aria-label="Navigare principală">
        {links.map((link) => <AppLink key={link.section} className={NAV_LINK} href={link.href} aria-current={link.current ? "page" : undefined}>
          <span aria-hidden="true">{link.icon}</span>{link.label}
        </AppLink>)}
      </nav>
      {unlocked ? <SessionFoot logoutPending={logoutPending} onLogout={onLogout} /> : null}
    </aside>
    <main id="main-content"><div id="app">{children}</div></main>
  </div>
}

const SessionFoot = ({ logoutPending, onLogout }: { readonly logoutPending: boolean; readonly onLogout: (() => void) | undefined }) =>
  <div className="flex gap-[.6rem] items-center mt-auto p-[.8rem] text-invoice-sidebar-foot text-invoice-caption narrow:mt-0 narrow:ml-1 narrow:p-0">
    <span className="inline-block size-2 rounded-full bg-invoice-connected shadow-invoice-connected narrow:hidden" aria-hidden="true" />
    <span className="narrow:hidden">Sesiune activă</span>
    <button className="min-h-9 ml-auto p-[.4rem] cursor-pointer underline disabled:cursor-wait disabled:opacity-65 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-invoice-focus"
      type="button" disabled={logoutPending} onClick={onLogout}>{logoutPending ? "Se închide…" : "Ieșire"}</button>
  </div>
