import { cn } from "@/lib/utils";

export function PageTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "bg-gradient-to-r from-sky-600 via-fuchsia-600 to-emerald-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-sky-400 dark:via-fuchsia-400 dark:to-emerald-400",
        className,
      )}
    >
      {children}
    </h1>
  );
}
