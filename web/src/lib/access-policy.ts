type Identity = { emailAddresses: { emailAddress: string; verification: { status: string } | null }[] };

export function isOwner(user: Identity | null, ownerEmail: string): boolean {
  const expected = ownerEmail.trim().toLowerCase();
  return Boolean(expected && user?.emailAddresses.some(email =>
    email.verification?.status === "verified" && email.emailAddress.toLowerCase() === expected
  ));
}

export function isTrustedOrigin(origin: string | null, appOrigin: string): boolean {
  return Boolean(appOrigin && origin === appOrigin);
}
