export default function HRDeadlinesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-m-4 md:-m-6 min-h-[calc(100vh-6rem)]">
      {children}
    </div>
  );
}
