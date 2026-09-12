import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Menu, ReceiptText, UserRound, WalletCards, X } from 'lucide-react';
import { type Role } from '@maas/core';

interface TopNavProps {
  role: Role;
  onHome: () => void;
  onWallet?: () => void;
  onOrders?: () => void;
  hasActivePlan?: boolean;
  activePlanLabel?: string;
  rightSlot?: ReactNode;
  displayName?: string;
  onProfile?: () => void;
}

const roleLabels: Record<Role, string> = {
  customer: 'Customer',
  cook: 'Cook',
  admin: 'Admin',
};

export function TopNav({ role, onHome, onWallet, onOrders, hasActivePlan = false, activePlanLabel, rightSlot, displayName, onProfile }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRendered, setMenuRendered] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const openMenu = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    setMenuRendered(true);
    requestAnimationFrame(() => setMenuOpen(true));
  };

  const closeMenu = () => {
    triggerRef.current?.focus();
    setMenuOpen(false);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setMenuRendered(false);
    }, 240);
  };

  useEffect(() => {
    if (!menuRendered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusPanel = () => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    };
    if (menuOpen) focusPanel();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuRendered, menuOpen]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const mobileMenu = menuRendered && typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 sm:hidden">
      <button type="button" aria-label="Close menu" onClick={closeMenu} className={`absolute inset-0 h-full w-full cursor-default bg-ink/35 backdrop-blur-[2px] transition-opacity duration-200 ease-out ${menuOpen ? 'opacity-100' : 'opacity-0'}`} />
      <aside
        id="mobile-navigation-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
        className={`absolute right-0 top-0 flex h-full w-[min(88vw,22rem)] flex-col border-l border-steel/15 bg-paper-50 shadow-[-12px_0_32px_rgba(36,33,28,0.16)] transition-transform duration-200 ease-out ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-steel/15 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">Your account</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">{displayName || `${roleLabels[role]} account`}</p>
            {hasActivePlan && <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-leaf-dark"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-leaf" />Active plan{activePlanLabel ? ` · ${activePlanLabel}` : ''}</p>}
          </div>
          <button type="button" aria-label="Close menu" onClick={closeMenu} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-paper-200/70 hover:text-ink">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">Navigate</p>
          {role === 'customer' && onOrders && (
            <button type="button" onClick={() => { closeMenu(); onOrders(); }} className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-marigold-50 focus-visible:bg-marigold-50">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-md bg-marigold-50 text-marigold-dark"><ReceiptText size={17} /></span>
              My Orders
            </button>
          )}
          {role === 'customer' && onWallet && (
            <button type="button" onClick={() => { closeMenu(); onWallet(); }} className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-marigold-50 focus-visible:bg-marigold-50">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-md bg-spice-50 text-spice"><WalletCards size={17} /></span>
              Payment statement
            </button>
          )}
          {onProfile && (
            <button type="button" onClick={() => { closeMenu(); onProfile(); }} className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-marigold-50 focus-visible:bg-marigold-50">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-md bg-leaf-50 text-leaf-dark"><UserRound size={17} /></span>
              Customer account
            </button>
          )}
        </nav>

        <div className="border-t border-steel/15 px-3 py-3 [&>button]:flex [&>button]:min-h-12 [&>button]:w-full [&>button]:items-center [&>button]:rounded-md [&>button]:px-3 [&>button]:text-left [&>button]:text-sm [&>button]:font-medium [&>button]:text-rust-dark [&>button]:transition-colors [&>button]:hover:bg-rust-50 [&>button]:focus-visible:bg-rust-50">
          {rightSlot}
        </div>
      </aside>
    </div>,
    document.body,
  ) : null;

  return (
    <>
    <header className="sticky top-0 z-30 border-b border-steel/15 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <button
          onClick={onHome}
          aria-label="Go to home"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-spice text-paper">
            <span className="font-display text-lg font-bold">T</span>
          </div>
          <span className="font-display text-lg font-semibold text-ink hidden sm:inline">
            DabbaDiaries
          </span>
        </button>

        <div className="hidden items-center gap-3 sm:flex">
          {role === 'customer' && onOrders && (
            <button onClick={onOrders} className="min-h-11 rounded-md border border-steel/20 bg-paper-50 px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-marigold hover:text-ink sm:text-sm">
              My Orders
            </button>
          )}
          {role === 'customer' && onWallet && (
            <button onClick={onWallet} className="flex items-center gap-1.5 rounded-md border border-steel/20 bg-paper-50 px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-marigold hover:text-ink sm:text-sm">
              <WalletCards size={15} className={hasActivePlan ? 'text-marigold' : ''} />
              <span className="hidden sm:inline">Plan balance</span>
            </button>
          )}
          <div className="flex items-center">{rightSlot}</div>
          <button onClick={onProfile} className="flex min-h-11 items-center gap-2 rounded-md border border-steel/20 bg-paper-50 px-2.5 py-1.5 text-left">
            <span className="h-2 w-2 rounded-full bg-leaf" />
            <span className="text-xs font-medium text-ink sm:text-sm">{displayName ? `Hi, ${displayName.split(' ')[0]}` : `${roleLabels[role]} account`}</span>
          </button>
        </div>

        <button
          type="button"
          ref={triggerRef}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation-panel"
          onClick={() => (menuOpen ? closeMenu() : openMenu())}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-steel/20 bg-paper-50 text-ink sm:hidden"
        >
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

    </header>
    {mobileMenu}
    </>
  );
}
