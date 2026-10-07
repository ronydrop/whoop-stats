import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-6 py-12 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-text-secondary">Este endereço não existe no painel.</p>
      <Link href="/" className="text-accent">Voltar à visão geral</Link>
    </div>
  );
}
