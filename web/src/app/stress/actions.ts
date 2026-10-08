"use server";
import { headers } from "next/headers";
import { stressClient } from "@/lib/stress-server";
import type { StressAuthResult } from "@/lib/stress";

async function assertLocalRequest() {
  const request = await headers();
  const host = request.get("host");
  const origin = request.get("origin");
  if (!host || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || origin !== `http://${host}`) {
    throw new Error("Abra a conexão pelo endereço local do painel.");
  }
}

export async function connectStress(form: FormData): Promise<StressAuthResult> {
  await assertLocalRequest();
  const challenge = form.get("challengeId");
  if (typeof challenge === "string" && challenge) return stressClient().verify(challenge, String(form.get("code") ?? "").trim());
  return stressClient().login(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
}

export async function disconnectStress(): Promise<void> {
  await assertLocalRequest();
  await stressClient().disconnect();
}
