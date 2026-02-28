export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`nav, header { display: none !important; } main { padding-bottom: 0 !important; }`}</style>
      {children}
    </>
  );
}
