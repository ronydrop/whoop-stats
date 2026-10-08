import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { object, parseStress, validStressDate, type StressAuthResult, type StressDay, type StressView } from "./stress.ts";

const BASE = "https://api.prod.whoop.com";
const AUTH_AGENT = "aws-sdk-swift/1.5.86 ua/2.1 api/cognito_identity_provider#1.5.86 os/ios#26.3.1 lang/swift#5.10 m/D,N,Z,b";
type Session = { access: string; refresh: string; expiresAt: number };
export type PrivateView = { connected: boolean; stale: boolean; data: unknown; fetchedAt: string | null; message: string };
type Store = { userId: string; session: Session | null; days: Record<string, StressDay>; resources?: Record<string, { data: unknown; fetchedAt: string }> };
type Challenge = { email: string; session: string; name: string; expiresAt: number };
type Options = { file: string; secret: string; userId: string; fetch?: typeof fetch; now?: () => number; windowEnd?: (date: string, raw: unknown, fetchedAt: string) => Promise<string> };

class StressError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

export class StressClient {
  private options: Options;
  private request: typeof fetch;
  private now: () => number;
  private queue: Promise<unknown> = Promise.resolve();
  private challenges = new Map<string, Challenge>();
  private attempts: number[] = [];
  private nextRead = 0;

  constructor(options: Options) {
    this.options = options;
    this.request = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
    if (!options.secret || !options.userId) throw new Error("A configuração local da WHOOP está incompleta.");
  }

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private key(): Buffer {
    return createHash("sha256").update(`whoop-stress:${this.options.secret}`).digest();
  }

  private async load(): Promise<Store> {
    let bytes: Buffer;
    try { bytes = await readFile(this.options.file); }
    catch (error) {
      if (object(error).code === "ENOENT") return { userId: this.options.userId, session: null, days: {} };
      throw new StressError("Não foi possível ler a conexão local de estresse.");
    }
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key(), bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const store: Store = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
      if (store.userId !== this.options.userId) throw new Error("Conta diferente");
      return store;
    } catch { throw new StressError("Não foi possível abrir os dados de estresse. Confira a chave e a conta configuradas no servidor."); }
  }

  private async save(store: Store): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(store), "utf8"), cipher.final()]);
    await mkdir(dirname(this.options.file), { recursive: true });
    await writeFile(`${this.options.file}.tmp`, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 });
    await rename(`${this.options.file}.tmp`, this.options.file);
  }

  private async json(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.request(`${BASE}${path}`, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) });
    } catch { throw new StressError("A WHOOP não respondeu. Tente novamente em alguns minutos."); }
    if (!response.ok) {
      const status = response.status;
      if (status === 429) this.nextRead = this.now() + 5 * 60_000;
      let type = "";
      if (path.startsWith("/auth-service/")) {
        try { const body = object(await response.json()); type = String(body.__type ?? ""); } catch { /* Respostas não JSON também são sanitizadas. */ }
      }
      const message = type.includes("CodeMismatch") ? "O código de verificação está incorreto."
        : type.includes("ExpiredCode") ? "O código expirou. Inicie o login novamente."
        : type.includes("NotAuthorized") || type.includes("UserNotFound") ? "A WHOOP não aceitou o acesso. Confira os dados e conecte novamente."
        : status === 401 ? "A sessão de estresse expirou. Conecte novamente."
        : status === 403 ? "A WHOOP recusou o acesso pela integração não oficial."
        : status === 429 ? "Limite da WHOOP atingido. Aguarde cinco minutos."
        : status === 404 ? "A WHOOP não disponibilizou estes dados para sua conta ou para o período selecionado."
        : "Não foi possível consultar a WHOOP. Tente novamente mais tarde.";
      throw new StressError(message, type.includes("NotAuthorized") ? 401 : status);
    }
    try { return await response.json(); }
    catch { throw new StressError("A WHOOP retornou uma resposta inválida."); }
  }

  private async auth(operation: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return object(await this.json("/auth-service/v3/whoop/", {
      method: "POST", headers: {
        "content-type": "application/x-amz-json-1.1", "x-amz-target": `AWSCognitoIdentityProviderService.${operation}`,
        "user-agent": AUTH_AGENT, "amz-sdk-request": "attempt=1; max=1", "amz-sdk-invocation-id": randomUUID(),
      }, body: JSON.stringify({ ClientId: "", ...body }),
    }));
  }

  private async get(path: string, access: string): Promise<Record<string, unknown>> {
    return object(await this.getRaw(path, access));
  }

  private getRaw(path: string, access: string): Promise<unknown> {
    return this.json(`${path}${path.includes("?") ? "&" : "?"}apiVersion=7`, { method: "GET", headers: {
      authorization: `Bearer ${access}`, accept: "application/json", "accept-language": "en",
      "x-whoop-time-zone": "America/Sao_Paulo", "x-whoop-clock-format": "TWENTY_FOUR_HOUR", locale: "en_US",
    } });
  }

  private tokens(result: unknown, previous?: Session): Session {
    const auth = object(result);
    const refresh = typeof auth.RefreshToken === "string" ? auth.RefreshToken : previous?.refresh;
    if (typeof auth.AccessToken !== "string" || !auth.AccessToken || !refresh || typeof auth.ExpiresIn !== "number" || auth.ExpiresIn <= 0) {
      throw new StressError("A WHOOP não retornou uma sessão válida.");
    }
    return { access: auth.AccessToken, refresh, expiresAt: this.now() + auth.ExpiresIn * 1000 };
  }

  private async connect(result: unknown): Promise<StressAuthResult> {
    const session = this.tokens(result);
    const profile = await this.get("/users-service/v2/bootstrap", session.access);
    if (String(object(profile.user).id) !== this.options.userId) throw new StressError("Entre na mesma conta WHOOP já utilizada neste painel.");
    const store = await this.load();
    store.session = session;
    await this.save(store);
    this.nextRead = 0;
    this.challenges.clear();
    return { ok: true, message: "Estresse conectado." };
  }

  private throttleAuth(): void {
    this.attempts = this.attempts.filter(time => time > this.now() - 5 * 60_000);
    if (this.attempts.length >= 5) throw new StressError("Aguarde cinco minutos antes de tentar conectar novamente.");
    this.attempts.push(this.now());
    for (const [id, challenge] of this.challenges) if (challenge.expiresAt <= this.now()) this.challenges.delete(id);
  }

  login(email: string, password: string): Promise<StressAuthResult> {
    return this.serial(async () => {
      try {
        if (!email.includes("@") || email.length > 254 || !password || password.length > 1024) throw new StressError("Informe seu e-mail e sua senha WHOOP.");
        this.throttleAuth();
        const result = await this.auth("InitiateAuth", { AuthFlow: "USER_PASSWORD_AUTH", AuthParameters: { USERNAME: email.trim(), PASSWORD: password } });
        if (result.AuthenticationResult) return await this.connect(result.AuthenticationResult);
        const name = String(result.ChallengeName);
        const labels: Record<string, string> = { SMS_MFA: "Código recebido por SMS", SOFTWARE_TOKEN_MFA: "Código do autenticador", EMAIL_OTP: "Código recebido por e-mail" };
        if (!labels[name] || typeof result.Session !== "string") throw new StressError("Este método de login não é suportado. Confira o acesso pelo aplicativo WHOOP.");
        const id = randomUUID();
        this.challenges.set(id, { email: email.trim(), name, session: result.Session, expiresAt: this.now() + 5 * 60_000 });
        return { ok: false, message: "Confirme o código para concluir a conexão.", challengeId: id, challengeLabel: labels[name] };
      } catch (error) { return { ok: false, message: this.message(error) }; }
    });
  }

  verify(id: string, code: string): Promise<StressAuthResult> {
    return this.serial(async () => {
      try {
        this.throttleAuth();
        const challenge = this.challenges.get(id);
        if (!challenge || challenge.expiresAt <= this.now()) throw new StressError("A verificação expirou. Inicie o login novamente.");
        if (!/^\d{6}$/.test(code)) throw new StressError("Informe o código de seis dígitos.");
        const field = challenge.name === "SMS_MFA" ? "SMS_MFA_CODE" : challenge.name === "EMAIL_OTP" ? "EMAIL_OTP_CODE" : "SOFTWARE_TOKEN_MFA_CODE";
        const result = await this.auth("RespondToAuthChallenge", { ChallengeName: challenge.name, Session: challenge.session, ChallengeResponses: { USERNAME: challenge.email, [field]: code } });
        return await this.connect(result.AuthenticationResult);
      } catch (error) { return { ok: false, message: this.message(error) }; }
    });
  }

  disconnect(): Promise<void> {
    return this.serial(async () => {
      const store = await this.load();
      store.session = null;
      await this.save(store);
      this.challenges.clear();
    });
  }

  readPrivate(path: string, ttl = 60_000): Promise<PrivateView> {
    return this.serial(async () => {
      const allowed = /^\/(?:journal-service\/v3\/journals\/drafts\/mobile\/\d{4}-\d{2}-\d{2}|behavior-impact-service\/v1\/impact|behavior-impact-service\/v2\/impact\/details\/[a-f0-9-]{36}|progression-service\/v3\/trends\/(?:VO2_MAX|STRESS|STRESS_DURING_SLEEP|STRESS_DURING_NON_STRAIN)|home-service\/v1\/deep-dive\/sleep\/last-night|coaching-service\/v2\/sleepneed|health-tab-bff\/v1\/health-tab|core-details-bff\/v1\/cardio-details|weightlifting-service\/v3\/exercise\/[A-Za-z0-9_-]+\/exercise_history)(?:\?[^#\s]*)?$/;
      if (!allowed.test(path)) throw new Error("Consulta complementar não permitida.");
      let store: Store;
      try { store = await this.load(); }
      catch (error) { return { connected: false, stale: false, data: null, fetchedAt: null, message: this.message(error) }; }
      const cached = store.resources?.[path];
      const fallback = (message: string): PrivateView => ({ connected: Boolean(store.session), stale: Boolean(cached), data: cached?.data ?? null, fetchedAt: cached?.fetchedAt ?? null, message });
      if (!store.session) return fallback("Conecte sua conta WHOOP na tela de Estresse para consultar estes dados.");
      if (cached && this.now() - Date.parse(cached.fetchedAt) < ttl) return { connected: true, stale: false, ...cached, message: "" };
      try {
        if (this.now() < this.nextRead) throw new StressError("Limite da WHOOP atingido. Aguarde cinco minutos.");
        const refresh = async () => {
          const result = await this.auth("InitiateAuth", { AuthFlow: "REFRESH_TOKEN_AUTH", AuthParameters: { REFRESH_TOKEN: store.session!.refresh } });
          store.session = this.tokens(result.AuthenticationResult, store.session!);
          await this.save(store);
        };
        let refreshed = false;
        if (store.session.expiresAt <= this.now() + 60_000) { await refresh(); refreshed = true; }
        let data: unknown;
        try { data = await this.getRaw(path, store.session.access); }
        catch (error) {
          if (!(error instanceof StressError) || error.status !== 401 || refreshed) throw error;
          await refresh();
          data = await this.getRaw(path, store.session!.access);
        }
        const fetchedAt = new Date(this.now()).toISOString();
        store.resources ??= {};
        store.resources[path] = { data, fetchedAt };
        const oldest = Object.keys(store.resources).sort((a, b) => Date.parse(store.resources![a].fetchedAt) - Date.parse(store.resources![b].fetchedAt));
        for (const key of oldest.slice(0, Math.max(0, oldest.length - 40))) delete store.resources[key];
        await this.save(store);
        return { connected: true, stale: false, data, fetchedAt, message: "" };
      } catch (error) {
        if (error instanceof StressError && error.status === 401) {
          store.session = null;
          await this.save(store);
        }
        return fallback(this.message(error));
      }
    });
  }

  read(date: string): Promise<StressView> {
    return this.serial(async () => {
      if (!validStressDate(date) || date > new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(this.now())) {
        return { connected: false, stale: false, data: null, message: "Selecione uma data válida até hoje." };
      }
      let store: Store;
      try { store = await this.load(); }
      catch (error) { return { connected: false, stale: false, data: null, message: this.message(error) }; }
      const cached = store.days[date]?.version === 2 ? store.days[date] : null;
      if (!store.session) return { connected: false, stale: Boolean(cached), data: cached, message: "Conecte sua conta para consultar o estresse." };
      if (cached && this.now() - Date.parse(cached.fetchedAt) < 60_000) return { connected: true, stale: false, data: cached, message: "" };
      try {
        if (this.now() < this.nextRead) throw new StressError("Limite da WHOOP atingido. Aguarde cinco minutos.");
        const refresh = async () => {
          const result = await this.auth("InitiateAuth", { AuthFlow: "REFRESH_TOKEN_AUTH", AuthParameters: { REFRESH_TOKEN: store.session!.refresh } });
          store.session = this.tokens(result.AuthenticationResult, store.session!);
          await this.save(store);
        };
        let refreshed = false;
        if (store.session.expiresAt <= this.now() + 60_000) { await refresh(); refreshed = true; }
        let raw: Record<string, unknown>;
        try { raw = await this.get(`/health-service/v2/stress-bff/${date}`, store.session.access); }
        catch (error) {
          if (!(error instanceof StressError) || error.status !== 401 || refreshed) throw error;
          await refresh();
          raw = await this.get(`/health-service/v2/stress-bff/${date}`, store.session!.access);
        }
        const fetchedAt = new Date(this.now()).toISOString();
        const windowEnd = this.options.windowEnd ? await this.options.windowEnd(date, raw, fetchedAt) : fetchedAt;
        const data = parseStress(raw, date, fetchedAt, windowEnd);
        store.days[date] = data;
        await this.save(store);
        return { connected: true, stale: false, data, message: "" };
      } catch (error) {
        if (error instanceof StressError && error.status === 401) {
          store.session = null;
          try { await this.save(store); } catch { /* A falha da conexão continua visível. */ }
        }
        return { connected: Boolean(store.session), stale: Boolean(cached), data: cached, message: this.message(error) };
      }
    });
  }

  private message(error: unknown): string {
    return error instanceof StressError ? error.message : error instanceof Error && (error.message.startsWith("O formato do estresse") || error.message.startsWith("Não foi possível confirmar as datas"))
      ? error.message : "Não foi possível concluir a operação de estresse. Confira o armazenamento local e tente novamente.";
  }
}
