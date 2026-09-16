export default function PrintLayout({ children }: LayoutProps<"/">) {
  return <div className="min-h-screen bg-neutral-100 print:bg-white">{children}</div>;
}
