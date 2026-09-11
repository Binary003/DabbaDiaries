import { type ReactNode } from 'react';
import { WalletCards } from 'lucide-react';
import { type Role } from '@maas/core';

interface TopNavProps {
  role: Role;
  onHome: () => void;
  onWallet?: () => void;
  hasActivePlan?: boolean;
  rightSlot?: ReactNode;
  displayName?: string;
  onProfile?: () => void;
}

const roleLabels: Record<Role, string> = {
  customer: 'Customer',
  cook: 'Cook',
  admin: 'Admin',
};

export function TopNav({ role, onHome, onWallet, hasActivePlan = false, rightSlot, displayName, onProfile }: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-steel/15 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <button
          onClick={onHome}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-spice text-paper">
            <span className="font-display text-lg font-bold">T</span>
          </div>
          <span className="font-display text-lg font-semibold text-ink hidden sm:inline">
            DabbaDiaries
          </span>
        </button>

        <div className="flex items-center gap-3">
          {role === 'customer' && onWallet && (
            <button onClick={onWallet} className="flex items-center gap-1.5 rounded-md border border-steel/20 bg-paper-50 px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-marigold hover:text-ink sm:text-sm">
              <WalletCards size={15} className={hasActivePlan ? 'text-marigold' : ''} />
              <span className="hidden sm:inline">Plan balance</span>
            </button>
          )}
          {rightSlot}
          <button onClick={onProfile} className="flex min-h-11 items-center gap-2 rounded-md border border-steel/20 bg-paper-50 px-2.5 py-1.5 text-left">
            <span className="h-2 w-2 rounded-full bg-leaf" />
            <span className="text-xs font-medium text-ink sm:text-sm">{displayName ? `Hi, ${displayName.split(' ')[0]}` : `${roleLabels[role]} account`}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
