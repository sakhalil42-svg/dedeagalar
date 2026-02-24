export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`nav { display: none !important; } main { padding-bottom: 0 !important; }`}</style>
      {children}
    </>
  );
}
