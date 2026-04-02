export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-col flex-1 items-center justify-center bg-muted p-6 md:p-10">
      {children}
    </main>
  )
}
