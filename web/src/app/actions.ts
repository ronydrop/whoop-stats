"use server";
import { client } from "@/lib/api/client";
import { requireOwner } from "@/lib/auth-server";

export async function syncWhoopData() {
  await requireOwner();
  try {
    const { response } = await client.POST("/api/v1/sync");
    if (response.ok) return { ok: true, message: "" };
    const message = response.status === 429 ? "Aguarde cinco minutos entre sincronizações manuais."
      : response.status === 409 ? "Já existe uma atualização em andamento."
      : "Não foi possível iniciar a sincronização. Confira a conexão e tente novamente.";
    return { ok: false, message };
  } catch {
    return { ok: false, message: "Não foi possível conectar ao servidor. Tente novamente em alguns minutos." };
  }
}
export async function getSyncStatus() {
  const { data, response } = await client.GET("/api/v1/sync/status", { cache: "no-store" });
  if (!response.ok || !data) throw new Error("Não foi possível consultar a sincronização.");
  return data;
}
