const usernameInput = document.getElementById("username");
const connectionStatus = document.getElementById("connection");
const messagesBox = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const feedback = document.getElementById("quiz-feedback");
const participantsList = document.getElementById("participants");
const responseTotal = document.getElementById("response-total");
const pieChart = document.getElementById("results-pie");
const chartLegend = document.getElementById("chart-legend");
const resultsSection = document.getElementById("results-section");
const votersByOption = document.getElementById("voters-by-option");
const rankingList = document.getElementById("ranking-list");
const identityAvatar = document.getElementById("identity-avatar");
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const soundToggle = document.getElementById("sound-toggle");
const soundIcon = document.getElementById("sound-icon");
const chartTotal = document.getElementById("chart-total");
const chartColors = ["#ff946f", "#36cda1", "#8d83ff", "#f1c45d"];
const questionText = document.getElementById("question-text");
const questionProgress = document.getElementById("question-progress");
const nextQuestionButton = document.getElementById("next-question");
// O progresso da pergunta é apenas temporário: toda nova abertura começa na pergunta 1.
localStorage.removeItem("conectaquiz-question");
let questionIndex = 0;
const questionBank = [
  { question: "Qual atitude é mais importante ao compartilhar uma informação recebida nas redes sociais?", options: ["Compartilhar imediatamente para alertar todos.", "Verificar a fonte e confirmar a informação em fontes confiáveis.", "Confiar na informação quando ela tiver muitas curtidas.", "Repassar se a mensagem vier de um conhecido."], correct: 1 },
  { question: "Qual é a melhor prática para criar uma senha mais segura?", options: ["Usar a mesma senha em todos os sites.", "Escolher uma sequência simples, como 123456.", "Criar uma senha longa, única e difícil de adivinhar.", "Usar apenas o próprio nome e a data de nascimento."], correct: 2 },
  { question: "Ao receber um link suspeito por mensagem, o que você deve fazer?", options: ["Abrir o link para descobrir do que se trata.", "Encaminhar para todos os contatos.", "Informar seus dados para verificar a conta.", "Não clicar e confirmar a origem por um canal oficial."], correct: 3 },
  { question: "Ao usar uma rede Wi-Fi pública, qual atitude é mais segura?", options: ["Acessar qualquer site sem preocupação.", "Compartilhar senhas com quem estiver conectado.", "Evitar acessar informações sensíveis e utilizar conexões seguras.", "Desativar todas as proteções do celular."], correct: 2 },
  { question: "O que fazer ao receber uma mensagem solicitando seus dados pessoais com urgência?", options: ["Enviar os dados imediatamente.", "Confirmar a solicitação por um canal oficial antes de fornecer qualquer informação.", "Compartilhar a mensagem com todos os contatos.", "Ignorar os avisos de segurança."], correct: 1 }
];

let currentCorrectIndex = questionBank[questionIndex].correct;
const optionButtons = [...document.querySelectorAll(".answer")];
let socket;
let hasAnswered = false;
let quizFinished = false;
let advanceTimer = null;
let reconnectTimer;
let soundEnabled = localStorage.getItem("conectaquiz-sound") !== "off";

usernameInput.value = localStorage.getItem("conectaquiz-name") || "";
updateIdentityAvatar();
usernameInput.addEventListener("input", updateIdentityAvatar);
usernameInput.addEventListener("change", () => localStorage.setItem("conectaquiz-name", usernameInput.value.trim()));

function applyTheme(theme) {
  const light = theme === "light";
  document.body.classList.toggle("light-theme", light);
  themeIcon.textContent = light ? "☾" : "☼";
  themeToggle.querySelector(".toolbar-label").textContent = light ? "Tema escuro" : "Tema claro";
  themeToggle.setAttribute("aria-label", light ? "Ativar tema escuro" : "Ativar tema claro");
  document.querySelector('meta[name="theme-color"]').content = light ? "#f1f5fb" : "#080d1b";
}
applyTheme(localStorage.getItem("conectaquiz-theme") || "dark");
themeToggle.addEventListener("click", () => {
  const next = document.body.classList.contains("light-theme") ? "dark" : "light";
  localStorage.setItem("conectaquiz-theme", next);
  applyTheme(next);
  playTone("toggle");
});

function updateSoundControl() {
  soundIcon.textContent = soundEnabled ? "♫" : "♪";
  soundToggle.querySelector(".toolbar-label").textContent = soundEnabled ? "Som ligado" : "Som desligado";
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundToggle.title = soundEnabled ? "Desativar efeitos sonoros" : "Ativar efeitos sonoros";
}
updateSoundControl();
soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("conectaquiz-sound", soundEnabled ? "on" : "off");
  updateSoundControl();
  if (soundEnabled) playTone("toggle");
});

function playTone(kind) {
  if (!soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const notes = kind === "success" ? [523.25, 659.25, 783.99] : kind === "message" ? [587.33] : [440];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.09;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.07, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });
    window.setTimeout(() => context.close().catch(() => {}), 600);
  } catch (error) {
    // Som é um recurso complementar; falhas de áudio não afetam o quiz.
  }
}

function initials(name) {
  const parts = String(name || "Anônimo").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || "?").slice(0, 2)).toUpperCase();
}
function avatar(name, extraClass = "") {
  const element = document.createElement("span");
  element.className = `avatar ${extraClass}`.trim();
  element.textContent = initials(name);
  element.setAttribute("aria-hidden", "true");
  return element;
}
function updateIdentityAvatar() {
  identityAvatar.textContent = initials(usernameInput.value || "?");
}

function connect() {
  if (location.protocol === "file:") {
    connectionStatus.innerHTML = "<i></i> Abra pelo iniciar-local.bat";
    connectionStatus.classList.remove("connected");
    feedback.textContent = "Para usar o quiz, execute iniciar-local.bat e abra http://localhost:3000 no navegador. Não abra o arquivo index.html diretamente.";
    return;
  }
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}`);
  connectionStatus.innerHTML = "<i></i> Conectando...";
  socket.addEventListener("open", () => {
    connectionStatus.innerHTML = "<i></i> Conectado";
    connectionStatus.classList.add("connected");
    clearTimeout(reconnectTimer);
    if (quizFinished) socket.send(JSON.stringify({type:"get_quiz_results"}));
  });
  socket.addEventListener("close", () => {
    connectionStatus.innerHTML = "<i></i> Reconectando...";
    connectionStatus.classList.remove("connected");
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 2000);
  });
  socket.addEventListener("error", () => {
    connectionStatus.innerHTML = "<i></i> Falha na conexão";
    connectionStatus.classList.remove("connected");
    feedback.textContent = "Não foi possível conectar ao servidor. Confira se o iniciar-local.bat está aberto e se o endereço é http://localhost:3000.";
  });
  socket.addEventListener("message", (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === "initial") {
      messagesBox.replaceChildren();
      if (!data.messages.length) showEmpty();
      data.messages.forEach(renderMessage);
      renderQuestion();
      if (quizFinished) renderQuizResults(data.quiz);
    } else if (data.type === "message") {
      renderMessage(data.message);
      if (data.message.name !== (usernameInput.value.trim() || "Anônimo")) playTone("message");
    } else if (data.type === "quiz_update") {
      if (quizFinished) renderQuizResults(data.quiz);
    } else if (data.type === "error") {
      feedback.textContent = data.message || "Não foi possível concluir a ação.";
      feedback.className = "feedback error";
    }
  });
}
function showEmpty() {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = "Ainda não há comentários. Seja o primeiro!";
  messagesBox.replaceChildren(empty);
}
function renderMessage(message) {
  const empty = messagesBox.querySelector(".empty");
  if (empty) empty.remove();
  const item = document.createElement("article");
  item.className = "message";
  item.append(avatar(message.name));
  const content = document.createElement("div");
  content.className = "message-content";
  const heading = document.createElement("div");
  const author = document.createElement("strong");
  author.textContent = message.name;
  const time = document.createElement("time");
  time.textContent = new Date(message.time).toLocaleString("pt-BR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
  const body = document.createElement("p");
  body.textContent = message.text;
  heading.append(author, time);
  content.append(heading, body);
  item.append(content);
  messagesBox.append(item);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}
function drawPie(element, values, colors) {
  const total = values.reduce((sum, value) => sum + value, 0);
  let cumulative = 0;
  const segments = [];
  values.forEach((value, index) => {
    const percent = total ? value / total * 100 : 0;
    if (percent > 0) {
      segments.push(`${colors[index]} ${cumulative}% ${cumulative + percent}%`);
      cumulative += percent;
    }
  });
  element.style.background = total ? `conic-gradient(${segments.join(", ")})` : "#27334b";
}
function renderLegend(container, items, colors, total) {
  container.replaceChildren();
  items.forEach((item, index) => {
    const percent = total ? Math.round(item.count / total * 100) : 0;
    const line = document.createElement("div");
    line.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = colors[index];
    const label = document.createElement("span");
    label.textContent = `${item.label} — ${item.count} (${percent}%)`;
    line.append(swatch, label);
    container.append(line);
  });
}
function renderRanking(participants) {
  rankingList.replaceChildren();
  const sorted = [...participants].sort((a, b) => Number(b.score ?? b.isCorrect) - Number(a.score ?? a.isCorrect) || String(a.name).localeCompare(String(b.name), "pt-BR"));
  if (!sorted.length) {
    const empty = document.createElement("li");
    empty.className = "no-participants";
    empty.textContent = "O ranking aparecerá após as primeiras respostas.";
    rankingList.append(empty);
    return;
  }
  sorted.forEach((participant, index) => {
    const item = document.createElement("li");
    item.className = "ranking-item";
    const position = document.createElement("span");
    position.className = "rank-position";
    position.textContent = `#${index + 1}`;
    const nameAvatar = avatar(participant.name);
    const name = document.createElement("span");
    name.className = "rank-name";
    name.textContent = participant.name;
    const detail = document.createElement("small");
    detail.className = "rank-detail";
    detail.textContent = participant.score !== undefined ? `${participant.score} acerto(s) em ${participant.answered} pergunta(s)` : (participant.isCorrect ? "Resposta correta" : "Continue tentando");
    name.append(detail);
    const score = document.createElement("span");
    score.className = "rank-score";
    score.textContent = participant.score !== undefined ? `${participant.score * 100} pts` : (participant.isCorrect ? "100 pts" : "0 pts");
    item.append(position, nameAvatar, name, score);
    rankingList.append(item);
  });
}
function renderQuizResults(quiz) {
  resultsSection.hidden = !quizFinished;
  if (!quizFinished) return;
  const total = quiz.total || 0;
  const correct = quiz.correct || 0;
  const incorrect = quiz.incorrect || 0;
  const participants = quiz.participants || [];
  responseTotal.textContent = `${participants.length} ${participants.length === 1 ? "participante" : "participantes"}`;
  chartTotal.textContent = total;
  drawPie(pieChart, [correct, incorrect], ["#36cda1", "#ff718b"]);
  renderLegend(chartLegend, [{label:"Respostas corretas",count:correct},{label:"Respostas incorretas",count:incorrect}], ["#36cda1", "#ff718b"], total);
  renderRanking(quiz.ranking || quiz.participants || []);

  participantsList.replaceChildren();
  if (!participants.length) {
    const empty = document.createElement("li");
    empty.className = "no-participants";
    empty.textContent = "Ninguém respondeu ainda.";
    participantsList.append(empty);
  } else {
    participants.forEach((participant) => {
      const li = document.createElement("li");
      const info = document.createElement("div");
      info.className = "participant-info";
      const name = document.createElement("strong");
      name.textContent = participant.name;
      const answer = document.createElement("small");
      answer.textContent = `Respondeu ${participant.answered} de ${quiz.questionCount} perguntas`;
      const result = document.createElement("small");
      result.className = "answer-correct";
      result.textContent = `${participant.score} acerto(s) • ${participant.incorrect} erro(s)`;
      info.append(name, answer, result);
      li.append(avatar(participant.name), info);
      participantsList.append(li);
    });
  }
}
function renderQuestion() {
  const question = questionBank[questionIndex];
  currentCorrectIndex = question.correct;
  questionText.textContent = question.question;
  questionProgress.innerHTML = `<span class="meta-icon">◷</span> Pergunta ${questionIndex + 1} de ${questionBank.length}`;
  optionButtons.forEach((button, index) => {
    button.disabled = false;
    button.classList.remove("selected");
    button.querySelector("span:nth-child(2)").textContent = question.options[index];
  });
  hasAnswered = false;
  quizFinished = false;
  clearTimeout(advanceTimer);
  nextQuestionButton.hidden = true;
  feedback.textContent = "Escolha uma alternativa para registrar sua resposta.";
  feedback.className = "feedback";
  resultsSection.hidden = true;
}

function restartQuiz() {
  // Reinicia o fluxo local sem apagar respostas já registradas no servidor.
  questionIndex = 0;
  hasAnswered = false;
  quizFinished = false;
  localStorage.removeItem("conectaquiz-question");
  nextQuestionButton.textContent = "Próxima pergunta →";
  renderQuestion();
  playTone("toggle");
  document.querySelector(".quiz-panel").scrollIntoView({behavior:"smooth",block:"start"});
}

nextQuestionButton.addEventListener("click", () => {
  if (!hasAnswered) return;

  // Depois da última resposta, primeiro mostra os resultados.
  // Só depois disso o botão permite reiniciar o questionário.
  if (quizFinished) {
    restartQuiz();
    return;
  }
  if (questionIndex >= questionBank.length - 1) {
    quizFinished = true;
    nextQuestionButton.textContent = "Voltar à primeira pergunta →";
    resultsSection.hidden = false;
    feedback.textContent = "Questionário concluído! Veja abaixo o resultado geral.";
    resultsSection.setAttribute("aria-live", "polite");
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "get_quiz_results" }));
    }
    document.querySelector(".results").scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  advanceToNextQuestion();
});

function advanceToNextQuestion() {
  if (questionIndex >= questionBank.length - 1) {
    restartQuiz();
    return;
  }

  questionIndex += 1;
  localStorage.removeItem("conectaquiz-question");
  renderQuestion();
  playTone("toggle");
  document.querySelector(".quiz-panel").scrollIntoView({behavior:"smooth",block:"start"});
}

function sendAnswer(index) {
  if (hasAnswered || quizFinished) return;
  const name = usernameInput.value.trim();
  if (!name) {
    feedback.textContent = "Digite seu nome antes de responder.";
    feedback.className = "feedback error";
    usernameInput.focus();
    return;
  }
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    feedback.textContent = "Aguarde a conexão com o servidor.";
    feedback.className = "feedback error";
    return;
  }
  localStorage.setItem("conectaquiz-name", name);
  socket.send(JSON.stringify({type:"quiz_answer",name,answerIndex:index,questionIndex}));
  hasAnswered = true;
  optionButtons.forEach((button, i) => {
    button.disabled = true;
    if (i === index) button.classList.add("selected");
  });
  resultsSection.hidden = true;
  feedback.textContent = index === currentCorrectIndex ? "Muito bem! Resposta correta. Sua participação foi registrada." : "Resposta registrada! Confira o resultado e continue aprendendo.";
  feedback.className = `feedback ${index === currentCorrectIndex ? "success" : ""}`;
  nextQuestionButton.textContent = questionIndex === questionBank.length - 1 ? "Ver resultado →" : "Próxima pergunta →";
  nextQuestionButton.hidden = false;
  playTone(index === currentCorrectIndex ? "success" : "toggle");
  feedback.textContent = questionIndex === questionBank.length - 1
    ? "Última resposta registrada! Clique em Ver resultado para conferir o resultado geral."
    : "Resposta registrada! Clique em Próxima pergunta para continuar.";
}
optionButtons.forEach((button,index)=>button.addEventListener("click",()=>{if(!hasAnswered)sendAnswer(index);}));
chatForm.addEventListener("submit",(event)=>{
  event.preventDefault();
  const text = messageInput.value.trim();
  const name = usernameInput.value.trim() || "Anônimo";
  if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({type:"chat",name,text}));
  messageInput.value = "";
  messageInput.focus();
  playTone("message");
});
renderQuestion();
connect();
