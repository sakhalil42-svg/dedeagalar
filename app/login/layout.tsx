export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Login page without bottom tab bar — handled by parent layout,
  // but we hide the tab bar via CSS from this layout
  return (
    <>
      <style>{`nav { display: none !important; } main { padding-bottom: 0 !important; }`}</style>
      {children}
    </>
  );
}
