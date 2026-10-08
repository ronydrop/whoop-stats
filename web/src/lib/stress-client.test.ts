import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { StressClient } from "./stress-client.ts";

const fixture = { gauge: { gauge_score_display: "1.2" }, stress_graph: { graph: { plots: [{ plot: { segments: [{ points: [{ position_x: 1, data_scrubber_details: { primary_contextual_display: "11:59", value_display: "1.2" } }] }] } }] } }, stress_state: "RELAXED" };
const credentials = { AccessToken: "access-synthetic", RefreshToken: "refresh-synthetic", ExpiresIn: 3600 };

test("consultas complementares preservam query, arrays e cache criptografado", async t => {
  const { client, calls, options } = await setup(t, [{ AuthenticationResult: credentials }, { user: { id: 123 } }, { journal: { tracked_behaviors: [] } }, { month_time_segment: {} }]);
  await client.login("user@example.com", "senha-sintética");
  const journal = await client.readPrivate("/journal-service/v3/journals/drafts/mobile/2026-10-07");
  assert.equal(journal.connected, true);
  assert.deepEqual(journal.data, { journal: { tracked_behaviors: [] } });
  const path = "/progression-service/v3/trends/VO2_MAX?endDate=2026-10-08";
  const first = await client.readPrivate(path);
  assert.ok(calls.at(-1)!.url.endsWith("VO2_MAX?endDate=2026-10-08&apiVersion=7"));
  assert.deepEqual((await new StressClient(options).readPrivate(path)).data, first.data);
  const bytes = await readFile(options.file);
  assert.equal(bytes.includes(Buffer.from("month_time_segment")), false);
  assert.equal(calls.length, 4);
});

test("consultas complementares recusam escrita, hosts externos e caminhos desconhecidos", async t => {
  const { client, calls } = await setup(t, []);
  for (const path of ["https://example.com", "/auth-service/v3/whoop/", "/journal-service/v2/journals", "/health-tab-bff/v1/health-tab#fragment"]) {
    await assert.rejects(client.readPrivate(path), /não permitida/);
  }
  assert.equal(calls.length, 0);
});

test("consulta complementar renova a sessão uma vez após rejeição da WHOOP", async t => {
  const { client, calls } = await setup(t, [{ AuthenticationResult: credentials }, { user: { id: 123 } }, 401, { AuthenticationResult: credentials }, { show_live_hr: false }]);
  await client.login("user@example.com", "senha-sintética");
  const view = await client.readPrivate("/health-tab-bff/v1/health-tab");
  assert.equal(view.connected, true);
  assert.equal(view.message, "");
  assert.deepEqual(view.data, { show_live_hr: false });
  assert.equal(calls.length, 5);
  assert.match(String(calls[3].init?.body), /REFRESH_TOKEN_AUTH/);
  assert.equal(String(calls[3].init?.body).includes("senha-sintética"), false);
});

test("falha complementar mantém consulta salva, aplica espera compartilhada e não vaza a resposta", async t => {
  const { client, advance } = await setup(t, [{ AuthenticationResult: credentials }, { user: { id: 123 } }, { show_live_hr: false }, 429]);
  await client.login("user@example.com", "senha-sintética");
  await client.readPrivate("/health-tab-bff/v1/health-tab");
  advance();
  const view = await client.readPrivate("/health-tab-bff/v1/health-tab");
  assert.equal(view.stale, true);
  assert.deepEqual(view.data, { show_live_hr: false });
  assert.match(view.message, /cinco minutos/);
  assert.equal(view.message.includes("segredo"), false);
  assert.match((await client.read("2026-10-08")).message, /cinco minutos/);
});

async function setup(t: TestContext, responses: (object | number | Error)[]) {
  const base = join(homedir(), "Documents", "Codex", "whoop-stats", "testes-stress");
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(join(base, "run-"));
  t.after(async () => {
    assert.ok(resolve(dir).startsWith(resolve(base) + "/") || resolve(dir).startsWith(resolve(base) + "\\"));
    await rm(dir, { recursive: true, force: true });
  });
  const calls: { url: string; init?: RequestInit }[] = [];
  let time = Date.parse("2026-10-08T15:00:00Z");
  const mockFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    const response = responses.shift();
    assert.notEqual(response, undefined, "Requisição inesperada");
    if (response instanceof Error) throw response;
    return typeof response === "number" ? new Response("segredo remoto que não deve aparecer", { status: response }) : Response.json(response);
  };
  const options = { file: join(dir, "stress.enc"), secret: "test-secret", userId: "123", fetch: mockFetch, now: () => time };
  const client = new StressClient(options);
  return { client, calls, options, advance: () => { time += 120_000; } };
}

test("conexão ausente não chama a WHOOP nem inventa métricas", async t => {
  const { client, calls } = await setup(t, []);
  const view = await client.read("2026-10-08");
  assert.equal(view.connected, false);
  assert.equal(view.data, null);
  assert.equal(calls.length, 0);
});

test("login, cache por dia e persistência criptografada após reinício", async t => {
  const { client, calls, options } = await setup(t, [{ AuthenticationResult: credentials }, { user: { id: 123 } }, fixture]);
  assert.equal((await client.login("user@example.com", "senha-sintética")).ok, true);
  const view = await client.read("2026-10-08");
  assert.equal(view.data?.score, 1.2);
  const bytes = await readFile(options.file);
  for (const secret of ["senha-sintética", "access-synthetic", "refresh-synthetic", "user@example.com", "fetchedAt"]) assert.equal(bytes.includes(Buffer.from(secret)), false);
  const restored = await new StressClient(options).read("2026-10-08");
  assert.deepEqual(restored, view);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].init?.method, "GET");
  assert.ok(calls[2].url.endsWith("/health-service/v2/stress-bff/2026-10-08?apiVersion=7"));
});

test("não aceita uma conta diferente da integração oficial", async t => {
  const { client, options } = await setup(t, [{ AuthenticationResult: credentials }, { user: { id: 999 } }]);
  assert.match((await client.login("user@example.com", "password")).message, /mesma conta/);
  await assert.rejects(readFile(options.file), { code: "ENOENT" });
});

test("MFA fica no servidor e usa o campo correto para SMS, e-mail e autenticador", async t => {
  for (const [name, field] of [["SMS_MFA", "SMS_MFA_CODE"], ["EMAIL_OTP", "EMAIL_OTP_CODE"], ["SOFTWARE_TOKEN_MFA", "SOFTWARE_TOKEN_MFA_CODE"]]) {
    const { client, calls } = await setup(t, [{ ChallengeName: name, Session: "private-challenge-session" }, { AuthenticationResult: credentials }, { user: { id: 123 } }]);
    const result = await client.login("user@example.com", "password");
    assert.ok(result.challengeId);
    assert.equal(JSON.stringify(result).includes("private-challenge-session"), false);
    assert.equal((await client.verify(result.challengeId!, "123456")).ok, true);
    const payload = JSON.parse(String(calls[1].init?.body));
    assert.equal(payload.ChallengeResponses[field], "123456");
  }
});

test("renova uma sessão expirada uma única vez em consultas concorrentes", async t => {
  const { client, calls, advance } = await setup(t, [{ AuthenticationResult: { ...credentials, ExpiresIn: 65 } }, { user: { id: 123 } }, { AuthenticationResult: { AccessToken: "new-access", ExpiresIn: 3600 } }, fixture]);
  await client.login("user@example.com", "password");
  advance();
  const views = await Promise.all([client.read("2026-10-08"), client.read("2026-10-08")]);
  assert.equal(views[0].connected, true);
  assert.deepEqual(views[0], views[1]);
  assert.equal(calls.length, 4);
  assert.equal(JSON.parse(String(calls[2].init?.body)).AuthFlow, "REFRESH_TOKEN_AUTH");
  assert.equal(new Headers(calls[3].init?.headers).get("authorization"), "Bearer new-access");
});

test("falha preserva a última leitura e não expõe mensagens remotas", async t => {
  const { client, advance } = await setup(t, [{ AuthenticationResult: credentials }, { user: { id: 123 } }, fixture, 403]);
  await client.login("user@example.com", "password");
  await client.read("2026-10-08");
  advance();
  const view = await client.read("2026-10-08");
  assert.equal(view.data?.score, 1.2);
  assert.equal(view.stale, true);
  assert.match(view.message, /recusou/);
  assert.equal(view.message.includes("segredo"), false);
});

test("401 tenta renovar uma vez e sessão revogada pede login", async t => {
  const { client, calls } = await setup(t, [{ AuthenticationResult: credentials }, { user: { id: 123 } }, 401, 401]);
  await client.login("user@example.com", "password");
  assert.equal((await client.read("2026-10-08")).connected, false);
  await client.read("2026-10-08");
  assert.equal(calls.length, 4);
});

test("429 impõe espera entre consultas e não bloqueia dados de outras integrações", async t => {
  const { client, calls } = await setup(t, [{ AuthenticationResult: credentials }, { user: { id: 123 } }, 429]);
  await client.login("user@example.com", "password");
  assert.match((await client.read("2026-10-08")).message, /cinco minutos/);
  assert.match((await client.read("2026-10-07")).message, /cinco minutos/);
  assert.equal(calls.length, 3);
});

test("desconectar remove a sessão, preserva o histórico e não chama APIs de escrita", async t => {
  const { client, calls, options } = await setup(t, [{ AuthenticationResult: credentials }, { user: { id: 123 } }, fixture]);
  await client.login("user@example.com", "password");
  await client.read("2026-10-08");
  await client.disconnect();
  const view = await new StressClient(options).read("2026-10-08");
  assert.equal(view.connected, false);
  assert.equal(view.stale, true);
  assert.equal(view.data?.score, 1.2);
  assert.equal(calls.filter(call => call.init?.method === "POST").length, 1);
});

test("login inválido é limitado e nunca usa dados remotos como mensagem", async t => {
  const { client, calls } = await setup(t, [400, 400, 400, 400, 400]);
  for (let i = 0; i < 5; i++) assert.equal((await client.login("user@example.com", "password")).ok, false);
  assert.match((await client.login("user@example.com", "password")).message, /cinco minutos/);
  assert.equal(calls.length, 5);
});
