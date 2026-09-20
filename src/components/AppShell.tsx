import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

/**
 * Container mobile-first: centraliza o conteúdo em uma coluna estreita
 * (ótima em ~390px) e mantém boa aparência no desktop.
 */
export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen w-full bg-bone">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-bone shadow-soft sm:my-0">
        {children}
      </div>
    </div>
  );
}
