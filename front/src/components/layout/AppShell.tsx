import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: Readonly<AppShellProps>) {
  return (
    <div className="flex flex-col w-full h-full bg-background overflow-hidden">
      <Header />
      <div className="flex w-full grow min-h-[0] overflow-hidden">
        <Sidebar />
        <main className="h-full grow min-w-[0] overflow-hidden bg-card dark:bg-[oklch(0.17_0_0)]">{children}</main>
      </div>
    </div>
  );
}
