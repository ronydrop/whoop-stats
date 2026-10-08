"use server";
import { headers } from "next/headers";
import { stressClient } from "@/lib/stress-server";
import type { StressAuthResult } from "@/lib/stress";
import { requireOwner } from "@/lib/auth-server";
import { isTrustedOrigin } from "@/lib/access-policy";

async function assertOwnerRequest() {
  await requireOwner();
  const request = await headers();
  const origin = request.get("origin");
  if (!isTrustedOrigin(origin, process.env.WHOOP_APP_ORIGIN ?? "")) {
    throw new Error("A origem desta solicitação não é permitida.");
  }
}

export async function connectStress(form: FormData): Promise<StressAuthResult> {
  await assertOwnerRequest();
  const challenge = form.get("challengeId");
  const client = await stressClient();
  if (typeof challenge === "string" && challenge) return client.verify(challenge, String(form.get("code") ?? "").trim());
  return client.login(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
}

export async function disconnectStress(): Promise<void> {
  await assertOwnerRequest();
  await (await stressClient()).disconnect();
}
