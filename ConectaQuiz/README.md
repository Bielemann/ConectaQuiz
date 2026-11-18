# ConectaQuiz — armazenamento persistente no Render

Esta versão salva comentários e respostas em arquivos JSON dentro de um **Render Persistent Disk**. Assim, os registros continuam disponíveis após reinicializações e novos deploys, desde que o mesmo disco seja mantido anexado ao serviço.

## Atenção ao plano do Render

O `render.yaml` configura o serviço no plano `starter` e cria um Persistent Disk de 1 GB montado em `/var/data`. Persistent Disk exige um serviço pago compatível. O plano gratuito do Web Service não oferece esse disco; portanto, não publique esta configuração esperando persistência gratuita. Confira os preços e condições atuais no painel do Render antes de confirmar.

## Publicar pela primeira vez (recomendado)

1. Extraia este ZIP no computador.
2. Envie **o conteúdo da pasta `quizfix`** para um repositório GitHub. Os arquivos `server.js`, `package.json` e `render.yaml` devem ficar na raiz do repositório.
3. No Render, abra `https://dashboard.render.com/`.
4. Clique em **New + → Blueprint**.
5. Conecte o GitHub, escolha o repositório e confirme a criação.
6. Confira o plano e o custo do serviço e do disco antes de confirmar.
7. Aguarde o deploy e abra o endereço do ConectaQuiz.
8. Envie um comentário e responda ao quiz. Depois, reinicie o serviço pelo painel e confira se os dados continuam aparecendo.

## Se o serviço já existe no Render

1. Envie os arquivos atualizados para o GitHub e faça commit/push.
2. Abra o serviço no Render e verifique **Settings → Build & Deploy**:
   - Build Command: `npm install`
   - Start Command: `npm start`
3. Em **Environment**, configure `DATA_DIR` com o valor `/var/data`.
4. Em **Disks**, adicione um disco com:
   - Name: `conectaquiz-data`
   - Mount Path: `/var/data`
   - Size: `1 GB`
5. Use um plano compatível com Persistent Disk.
6. Faça **Manual Deploy → Deploy latest commit**.

**Importante:** se já houver um disco com dados, mantenha o mesmo disco. Não o exclua nem crie outro por cima sem antes fazer backup. O Mount Path precisa ser exatamente `/var/data`.

## O que fica salvo

- Comentários: `messages.json` (o aplicativo mantém as 500 mensagens mais recentes).
- Respostas: `quiz-answers.json` (para cada nome e pergunta, uma nova resposta substitui a anterior).
- O nome digitado pelo participante identifica suas respostas; não há login/autenticação.

Os arquivos de dados incluídos neste ZIP estão vazios. Portanto, este pacote não recupera comentários ou respostas que já tenham desaparecido. A persistência passa a valer depois que o serviço estiver usando o disco. Faça backups periódicos.

## Executar no computador

Requer Node.js 18 ou superior. Na pasta do projeto, execute:

```bash
npm install
npm start
```

Acesse `http://localhost:3000`. Sem `DATA_DIR`, os dados locais ficam na pasta `data`.
