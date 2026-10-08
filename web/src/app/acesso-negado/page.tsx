import { UserButton } from "@clerk/nextjs";

export default function AccessDeniedPage() {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
    <h1 className="text-2xl font-semibold">Acesso restrito</h1>
    <p className="text-text-secondary">Este painel está disponível somente para a conta autorizada.</p>
    <UserButton />
  </main>;
}
