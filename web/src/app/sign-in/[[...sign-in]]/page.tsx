import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
    <h1 className="text-2xl font-semibold">WHOOP Metrics</h1>
    <p className="text-text-secondary">Entre para acessar seu painel pessoal.</p>
    <SignIn fallbackRedirectUrl="/" withSignUp={false} />
  </main>;
}
