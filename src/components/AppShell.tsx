import type { ReactNode } from 'react';

interface AppShellProps { children: ReactNode; }

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-[100dvh] w-full bg-fog lg:py-5">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[540px] flex-col overflow-hidden bg-paper shadow-soft lg:min-h-[calc(100dvh-2.5rem)] lg:rounded-lg">
        {children}
      </div>
    </div>
  );
}
