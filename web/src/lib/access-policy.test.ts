import assert from "node:assert/strict";
import test from "node:test";
import { isOwner, isTrustedOrigin } from "./access-policy.ts";

const owner = { emailAddresses: [{ emailAddress: "rony@example.com", verification: { status: "verified" } }] };

test("somente o e-mail verificado do titular pode acessar os dados", () => {
  assert.equal(isOwner(owner, "rony@example.com"), true);
  assert.equal(isOwner(owner, "outro@example.com"), false);
  assert.equal(isOwner(owner, ""), false);
  assert.equal(isOwner(null, "rony@example.com"), false);
  assert.equal(isOwner({ emailAddresses: [{ emailAddress: "rony@example.com", verification: { status: "unverified" } }] }, "rony@example.com"), false);
  assert.equal(isOwner(owner, " RONY@EXAMPLE.COM "), true);
});

test("ações aceitam apenas a origem configurada e nunca um Host forjado", () => {
  const expected = "https://whoop.example.com";
  assert.equal(isTrustedOrigin(expected, expected), true);
  assert.equal(isTrustedOrigin("https://evil.example.com", expected), false);
  assert.equal(isTrustedOrigin("http://whoop.example.com", expected), false);
  assert.equal(isTrustedOrigin(null, expected), false);
  assert.equal(isTrustedOrigin(expected, ""), false);
});
