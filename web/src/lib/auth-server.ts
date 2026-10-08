import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isOwner } from "./access-policy";

export const requireOwner = cache(async () => {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();
  const user = await currentUser();
  if (!isOwner(user, process.env.WHOOP_OWNER_EMAIL ?? "")) redirect("/acesso-negado");
  return session.userId;
});
