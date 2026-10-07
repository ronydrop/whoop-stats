# Privacidade — WHOOP em Português

Este fork do WHOOP Stats é destinado ao uso pessoal e local no computador do usuário.

O painel consulta a API oficial da WHOOP, após autorização do titular, para exibir ciclos, esforço, recuperação, sono, treinos, perfil e medidas corporais. A autorização inclui acesso contínuo para atualizar os dados em segundo plano enquanto o painel estiver iniciado.

Os registros ficam em um banco PostgreSQL local. Credenciais e tokens ficam em arquivos locais ignorados pelo Git e no banco com criptografia dos tokens. Esses arquivos e dados não devem ser publicados no GitHub.

O painel não envia os registros a um servidor de hospedagem deste projeto. Ele se comunica com a WHOOP para consultar dados e renovar a autorização. O uso do Codex para analisar os registros constitui uma integração separada, sujeita às configurações da conta do usuário.

A autorização pode ser revogada na conta WHOOP. Para interromper as atualizações locais, use `Parar WHOOP.cmd`. A exclusão do banco e dos arquivos de credenciais deve ser feita somente por solicitação do titular.
