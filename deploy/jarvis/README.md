# Operação na VPS Jarvis

Endereço: `https://whoop.botjarvis.com.br`. Acesso administrativo: `ssh jarvis`.

O Nginx encaminha somente para o Next.js em `127.0.0.1:3032`. A API Go escuta em `127.0.0.1:8085`, exige JWT e usa a base exclusiva `whoop_stats` no PostgreSQL. O frontend exige uma sessão Clerk e o e-mail verificado de `WHOOP_OWNER_EMAIL` antes de consultar dados ou executar ações. A restrição é aplicada no servidor e independe da lista de cadastros do plano Clerk.

O cadastro público está desativado no Clerk (`auth_access_control.sign_up_mode=restricted`). O login não oferece registro e o aplicativo não mantém uma página de cadastro. O usuário do titular é criado pela administração do Clerk. A senha pode ser alterada no menu da conta, em Segurança.

## Deploy automático

O workflow `.github/workflows/ci.yml` executa os testes do Go com PostgreSQL isolado e os testes, lint e compilação do frontend. Pushes na `main` e execuções manuais nessa branch publicam somente após ambos os jobs passarem. Pull requests executam as verificações e não acessam a chave de deploy.

A publicação de imagens Docker do upstream fica restrita às tags `v*`; pushes na `main` usam o deploy na VPS.

Cada execução envia o binário Linux e o Next.js já compilado. A VPS não instala dependências nem compila. O recebedor extrai como `whoop-deploy`, mantém os arquivos da versão sob propriedade do administrador, troca `current` e reinicia somente os dois serviços deste painel. O aplicativo pode escrever somente em seu cache e no armazenamento compartilhado. Banco, arquivo de estresse, configuração e tokens continuam em `shared`. Migrações do banco exigem operação administrativa com backup e não são executadas pelo workflow.

A validação exige saúde do banco/API, login acessível, redirecionamento de visitas sem sessão e `401` nas APIs sem autenticação. Em caso de falha após a ativação, o recebedor restaura a versão anterior e reinicia os serviços. Os deploys usam trava na VPS e concorrência única no Actions, sem cancelar uma publicação em andamento. Versões antigas são preservadas.

### Configuração no GitHub

Em um fork, abra a aba Actions e confirme a opção de habilitar os workflows. O estado `active` na API e uma execução manual não comprovam que os gatilhos automáticos estão liberados. Valide com uma execução iniciada por push na `main`.

Secrets do repositório:

- `WHOOP_DEPLOY_SSH_KEY`: chave exclusiva do usuário `whoop-deploy`.
- `WHOOP_DEPLOY_KNOWN_HOSTS`: chave de host conferida pelo acesso administrativo `ssh jarvis`.

Variables do repositório:

- `WHOOP_DEPLOY_HOST`, `WHOOP_DEPLOY_PORT`, `WHOOP_DEPLOY_USER`: destino SSH.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: chave pública de produção para a compilação. As chaves privadas Clerk e WHOOP permanecem exclusivamente na VPS.

O usuário de deploy aceita somente `deploy <SHA de 40 caracteres>` por uma chave com comando forçado. Não oferece shell, encaminhamento de portas ou acesso administrativo geral. Os scripts `deploy.sh`, `receive.sh` e `extract.py` são instalados como arquivos do administrador em `/usr/local/sbin` e `/usr/local/libexec`; uma alteração nesses scripts exige reinstalação administrativa, preservando a restrição da chave.

Para uma nova tentativa da mesma versão, reexecute o workflow no GitHub. A identificação em `REVISION` registra o commit enviado. O estado final deve ser conferido na execução do Actions e no endereço público; a presença do YAML local não confirma que o deploy automático está ativo.

## Arquivos e serviços

- `/var/www/whoop-stats/current`: versão ativa, apontando para uma pasta em `releases`.
- `/var/www/whoop-stats/shared/runtime.env`: configuração e chaves, acessível somente ao administrador e ao grupo do serviço.
- `/var/www/whoop-stats/shared/data/stress.enc`: sessão e cache criptografados. Preserve `WHOOP_STATS_ENCRYPTION_KEY` ao atualizar.
- `whoop-stats-backend.service`: API e sincronização automática com a WHOOP.
- `whoop-stats-frontend.service`: interface Next.js.
- `/etc/nginx/sites-available/whoop.botjarvis.com.br`: domínio e HTTPS.

As chaves de produção do Clerk ficam no arquivo de ambiente. `WHOOP_APP_ORIGIN` deve ser `https://whoop.botjarvis.com.br`. Não copie configurações, dados ou tokens para o Git. Faça backup do banco e do arquivo criptografado antes de alterações de dados.

## Verificação

Execute na VPS:

```bash
systemctl is-active whoop-stats-backend whoop-stats-frontend
curl --fail http://127.0.0.1:8085/healthz
curl --head https://whoop.botjarvis.com.br
nginx -t
```

Uma visita sem sessão deve abrir a autenticação; consultas à API do frontend devem retornar `401`. Um usuário diferente do titular deve receber acesso negado. A confirmação funcional das métricas exige login do titular no painel.

Para interromper as atualizações, use `systemctl stop whoop-stats-backend`. Reiniciar os serviços não apaga o banco ou as credenciais. O Certbot renova o certificado do painel; os certificados dos subdomínios de autenticação são administrados pelo Clerk.

## Clerk no Codex

O MCP oficial usa `https://mcp.clerk.com/mcp` e fornece exemplos de SDK. Ele funciona sem o login administrativo do CLI. No Codex atual, configure globalmente com `codex mcp add clerk --url https://mcp.clerk.com/mcp`; reinicie o cliente para carregar as ferramentas. Não é necessário habilitar a antiga opção `beta.rmcp`.

O CLI instalado é `clerk`. Use `clerk whoami` para conferir a conta, `clerk link` para vincular este aplicativo e `clerk deploy status` para conferir DNS e certificados. Login administrativo do CLI e sessão do usuário no painel são acessos distintos.
