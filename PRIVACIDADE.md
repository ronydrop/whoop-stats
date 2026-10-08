# Privacidade — WHOOP Metrics

Este fork do WHOOP Stats é destinado ao uso pessoal do titular dos dados. A instalação remota usa a VPS particular autorizada pelo usuário.

O painel consulta a API oficial da WHOOP, após autorização do titular, para exibir ciclos, esforço, recuperação, sono, treinos, perfil e medidas corporais. A autorização inclui acesso contínuo para atualizar os dados em segundo plano enquanto o painel estiver iniciado.

Os registros ficam em um banco PostgreSQL privado na instalação escolhida. Credenciais e tokens ficam em arquivos protegidos ignorados pelo Git e no banco com criptografia dos tokens. Esses arquivos e dados não devem ser publicados no GitHub.

Na instalação remota, o histórico autorizado fica armazenado na VPS do usuário. O painel se comunica com a WHOOP para consultar dados e renovar a autorização. O Clerk autentica a conta de acesso; as métricas de saúde não são enviadas ao Clerk. O servidor exige o e-mail verificado do titular configurado para liberar os dados, inclusive nas consultas e ações internas. O banco e a API não são publicados pelo Nginx. O uso do Codex para analisar os registros constitui uma integração separada, sujeita às configurações da conta do usuário.

A autorização pode ser revogada na conta WHOOP. Para interromper as atualizações locais, use `Parar WHOOP.cmd`; na VPS, interrompa `whoop-stats-backend.service`. A exclusão do banco e dos arquivos de credenciais deve ser feita somente por solicitação do titular.
