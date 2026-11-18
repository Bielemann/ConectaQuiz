const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocketServer, WebSocket } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;
// No Render, DATA_DIR deve apontar para o Mount Path de um Persistent Disk.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const ANSWERS_FILE = path.join(DATA_DIR, "quiz-answers.json");

app.use(express.static(path.join(__dirname, "public"), {
  etag: false,
  lastModified: false,
  setHeaders(res, filePath) {
    if (/\.(html|js|css)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
}));

function readJson(file, fallback = []) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
  } catch (error) {
    // Não iniciar com uma lista vazia quando um arquivo existente estiver corrompido:
    // isso evita sobrescrever silenciosamente dados que ainda podem ser recuperados.
    throw new Error(`Não foi possível ler ${path.basename(file)}: ${error.message}`);
  }
}
function saveJson(file, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporaryFile = `${file}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(temporaryFile, file);
}

let messages = readJson(MESSAGES_FILE);
let answers = readJson(ANSWERS_FILE).filter((answer) => Number.isInteger(answer.answerIndex) && answer.answerIndex >= 0 && answer.answerIndex < 4);

const quizQuestions = [
  {
    question: "Qual atitude é mais importante ao compartilhar uma informação recebida nas redes sociais?",
    options: ["Compartilhar imediatamente para alertar todos.", "Verificar a fonte e confirmar a informação em fontes confiáveis.", "Confiar na informação quando ela tiver muitas curtidas.", "Repassar se a mensagem vier de um conhecido."],
    correct: 1
  },
  {
    question: "Qual é a melhor prática para criar uma senha mais segura?",
    options: ["Usar a mesma senha em todos os sites.", "Escolher uma sequência simples, como 123456.", "Criar uma senha longa, única e difícil de adivinhar.", "Usar apenas o próprio nome e a data de nascimento."],
    correct: 2
  },
  {
    question: "Ao receber um link suspeito por mensagem, o que você deve fazer?",
    options: ["Abrir o link para descobrir do que se trata.", "Encaminhar para todos os contatos.", "Informar seus dados para verificar a conta.", "Não clicar e confirmar a origem por um canal oficial."],
    correct: 3
  },
  {
    question: "Ao usar uma rede Wi-Fi pública, qual atitude é mais segura?",
    options: ["Acessar qualquer site sem preocupação.", "Compartilhar senhas com quem estiver conectado.", "Evitar acessar informações sensíveis e utilizar conexões seguras.", "Desativar todas as proteções do celular."],
    correct: 2
  },
  {
    question: "O que fazer ao receber uma mensagem solicitando seus dados pessoais com urgência?",
    options: ["Enviar os dados imediatamente.", "Confirmar a solicitação por um canal oficial antes de fornecer qualquer informação.", "Compartilhar a mensagem com todos os contatos.", "Ignorar os avisos de segurança."],
    correct: 1
  }
];

function quizSummary() {
  const scores = new Map();
  answers.forEach((answer) => {
    const key = answer.name.toLocaleLowerCase("pt-BR");
    const item = scores.get(key) || { name: answer.name, score: 0, answered: 0, correct: 0, incorrect: 0 };
    item.answered += 1;
    if (answer.answerIndex === quizQuestions[answer.questionIndex || 0]?.correct) {
      item.score += 1;
      item.correct += 1;
    } else item.incorrect += 1;
    scores.set(key, item);
  });
  const participants = [...scores.values()].sort((a, b) => b.score - a.score || b.answered - a.answered || a.name.localeCompare(b.name, "pt-BR"));
  const correct = participants.reduce((sum, participant) => sum + participant.correct, 0);
  const incorrect = participants.reduce((sum, participant) => sum + participant.incorrect, 0);
  return {
    questionCount: quizQuestions.length,
    total: answers.length,
    correct,
    incorrect,
    counts: [{ option: "Respostas corretas", count: correct }, { option: "Respostas incorretas", count: incorrect }],
    participants,
    ranking: participants
  };
}
function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "initial", messages, quiz: quizSummary() }));

  socket.on("message", (raw) => {
    let input;
    try { input = JSON.parse(raw.toString()); }
    catch {
      socket.send(JSON.stringify({ type: "error", message: "Mensagem inválida." }));
      return;
    }

    const name = String(input.name || "Anônimo").trim().slice(0, 24) || "Anônimo";

    if (input.type === "get_quiz_results") {
      socket.send(JSON.stringify({ type: "quiz_update", quiz: quizSummary() }));
      return;
    }

    if (input.type === "chat") {
      const text = String(input.text || "").trim().slice(0, 500);
      if (!text) return;
      const message = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name, text, time: new Date().toISOString()
      };
      messages.push(message);
      messages = messages.slice(-500);
      saveJson(MESSAGES_FILE, messages);
      broadcast({ type: "message", message });
      return;
    }

    if (input.type === "quiz_answer") {
      const answerIndex = Number(input.answerIndex);
      const questionIndex = Number(input.questionIndex || 0);
      const question = quizQuestions[questionIndex];
      if (!question || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= question.options.length) {
        socket.send(JSON.stringify({ type: "error", message: "Alternativa inválida." }));
        return;
      }

      const record = { name, answerIndex, questionIndex, time: new Date().toISOString() };
      const existing = answers.findIndex((answer) => (answer.questionIndex || 0) === questionIndex && answer.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
      if (existing >= 0) answers[existing] = record;
      else answers.push(record);

      saveJson(ANSWERS_FILE, answers);
      broadcast({ type: "quiz_update", quiz: quizSummary() });
    }
  });
});

server.listen(PORT, () => console.log(`Servidor disponível na porta ${PORT}. Dados em: ${DATA_DIR}`));
