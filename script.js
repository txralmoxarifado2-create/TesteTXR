// ==========================================================================
// IMPORTAÇÕES DO FIREBASE (SDK Modular v10 via CDN)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Credenciais oficiais do projeto vinculadas ao projeto txr-banco
const firebaseConfig = {
  apiKey: "AIzaSyBJFdUEEBGSv96NDmfiCzN9KgUYgp0QK10",
  authDomain: "txr-banco.firebaseapp.com",
  projectId: "txr-banco",
  storageBucket: "txr-banco.firebasestorage.app",
  messagingSenderId: "246852170185",
  appId: "1:246852170185:web:96e70238aa6ce4d951b818",
  measurementId: "G-3H8K92SGS4"
};

// Inicializa instâncias do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================================================
// UTILITÁRIOS GERAIS
// ==========================================================================
function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[tag],
  );
}

async function simularUploadArquivo(file) {
  return new Promise((resolve) => {
    if (file.size > 500000) {
      resolve(`https://via.placeholder.com/150?text=${escapeHTML(file.name)}`);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    }
  });
}

// ==========================================================================
// CAMADA DE SERVIÇO DE DADOS (INTEGRADO AO CLOUD FIRESTORE)
// ==========================================================================
class DatabaseService {
  static async iniciarBancoFake() {
    const adminExistente = await this.getUsuarios();
    if (!adminExistente || adminExistente.length === 0) {
      const usuariosPadrao = [
        {
          id: 1,
          nome: "Administrador",
          login: "admin",
          senha: "admin123",
          perfil: "administrador",
          permissoes: {
            novaSolicitacao: true,
            historico: true,
            compras: true,
            aprovacao: true,
            finalizacao: true,
            usuarios: true,
          },
          dataCadastro: new Date().toISOString(),
        },
        {
          id: 2,
          nome: "João Solicitante",
          login: "joao",
          senha: "joao123",
          perfil: "solicitante",
          permissoes: {
            novaSolicitacao: true,
            historico: true,
            compras: false,
            aprovacao: false,
            finalizacao: false,
            usuarios: false,
          },
          dataCadastro: new Date().toISOString(),
        },
        {
          id: 3,
          nome: "Maria Compras",
          login: "maria",
          senha: "maria123",
          perfil: "comprador",
          permissoes: {
            novaSolicitacao: false,
            historico: true,
            compras: true,
            aprovacao: false,
            finalizacao: true,
            usuarios: false,
          },
          dataCadastro: new Date().toISOString(),
        },
        {
          id: 4,
          nome: "Carlos Gestor",
          login: "carlos",
          senha: "carlos123",
          perfil: "gestor",
          permissoes: {
            novaSolicitacao: false,
            historico: true,
            compras: false,
            aprovacao: true,
            finalizacao: false,
            usuarios: false,
          },
          dataCadastro: new Date().toISOString(),
        },
      ];
      await this.salvarUsuarios(usuariosPadrao);
    }
    
    // Força inicialização segura da lista de solicitações caso o documento não exista
    try {
      const docRef = doc(db, "sistema_compras", "solicitacoes");
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await this.salvarSolicitacoes([]);
      }
    } catch (e) {
      console.error("Erro ao inicializar nó de solicitações:", e);
    }
  }

  static async getUsuarios() {
    try {
      const docRef = doc(db, "sistema_compras", "usuarios");
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data().lista : [];
    } catch (error) {
      console.error("Erro ao buscar usuários do Firestore:", error);
      return [];
    }
  }

  static async salvarUsuarios(usuarios) {
    try {
      await setDoc(doc(db, "sistema_compras", "usuarios"), { lista: usuarios });
      return true;
    } catch (error) {
      console.error("Erro ao gravar usuários no Firestore:", error);
      throw new Error("Erro na gravação remota de usuários.");
    }
  }

  static async getSolicitacoes() {
    try {
      const docRef = doc(db, "sistema_compras", "solicitacoes");
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data().lista : [];
    } catch (error) {
      console.error("Erro ao buscar solicitações do Firestore:", error);
      return [];
    }
  }

  static async salvarSolicitacoes(solicitacoes) {
    try {
      await setDoc(doc(db, "sistema_compras", "solicitacoes"), { lista: solicitacoes });
      return true;
    } catch (error) {
      console.error("Erro ao atualizar solicitações no Firestore:", error);
      throw new Error("Falha ao sincronizar as solicitações com o servidor.");
    }
  }

  static async getSessaoAtiva() {
    return JSON.parse(localStorage.getItem("sys_sessao")) || null;
  }

  static async setSessaoAtiva(usuario) {
    localStorage.setItem("sys_sessao", JSON.stringify(usuario));
  }
}

// ==========================================================================
// VARIÁVEIS DE ESTADO DA APLICAÇÃO FRONT-END
// ==========================================================================
const appState = {
  usuarios: [],
  solicitacoes: [],
  usuarioAtual: null,
  proximoProtocolo: 1000,
};

const perfisPermissoes = {
  solicitante: { nome: "Solicitante" },
  comprador: { nome: "Comprador" },
  gestor: { nome: "Gestor" },
  administrador: { nome: "Administrador" },
};

// ==========================================================================
// INICIALIZAÇÃO DA INTERFACE E EVENTOS
// ==========================================================================
document.addEventListener("DOMContentLoaded", async function () {
  await DatabaseService.iniciarBancoFake();
  await carregarDadosIniciais();

  configurarEventosGerais();
  verificarSessao();
});

async function carregarDadosIniciais() {
  appState.usuarios = await DatabaseService.getUsuarios();
  appState.solicitacoes = await DatabaseService.getSolicitacoes();
  appState.proximoProtocolo =
    appState.solicitacoes.length > 0
      ? Math.max(...appState.solicitacoes.map((s) => s.protocolo)) + 1
      : 1000;
}

function configurarEventosGerais() {
  // Auth
  document.getElementById("form-login").addEventListener("submit", fazerLogin);
  document.getElementById("btn-logout").addEventListener("click", fazerLogout);

  // Navegação
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      alternarTela(this.getAttribute("data-tela"));
    });
  });

  // Modais
  document
    .getElementById("btn-config")
    .addEventListener("click", mostrarModalConfig);
  document.querySelectorAll(".btn-fechar-modal").forEach((btn) => {
    btn.addEventListener("click", function () {
      this.closest(".modal").style.display = "none";
    });
  });
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) e.target.style.display = "none";
  });

  // Formulário Solicitação
  document
    .getElementById("form-solicitacao")
    .addEventListener("submit", enviarSolicitacao);
  document
    .getElementById("btn-adicionar-item")
    .addEventListener("click", adicionarItemInterface);

  // Filtros Histórico
  ["filtro-status", "filtro-setor", "filtro-solicitante"].forEach((id) => {
    document.getElementById(id).addEventListener("change", atualizarHistorico);
  });

  // Cotações
  document
    .getElementById("form-adicionar-orcamento")
    .addEventListener("submit", adicionarOrcamento);
  document
    .getElementById("btn-adicionar-anexos")
    .addEventListener("click", () =>
      document.getElementById("anexos-input").click(),
    );
  document
    .getElementById("anexos-input")
    .addEventListener("change", gerenciarAnexosOrcamento);

  // Usuários
  document
    .getElementById("form-cadastrar-usuario")
    .addEventListener("submit", salvarUsuario);
  document.getElementById("btn-novo-usuario").addEventListener("click", () => {
    document.getElementById("form-cadastrar-usuario").reset();
    document.getElementById("usuario-id").value = "";
  });
  document
    .getElementById("btn-cancelar-edicao")
    .addEventListener("click", () =>
      document.getElementById("form-cadastrar-usuario").reset(),
    );
  document
    .getElementById("usuario-perfil")
    .addEventListener("change", function () {
      atualizarPermissoesPorPerfil(this.value);
    });

  // Configurações e Senha
  document
    .getElementById("form-alterar-senha")
    .addEventListener("submit", alterarSenha);

  // Event Delegation para listas dinâmicas (Botoes de ação nos cards)
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("button, .btn-remover-item");
    if (!btn) return;

    const idStr = btn.getAttribute("data-id");
    const id = idStr ? parseInt(idStr) : null;

    if (btn.classList.contains("btn-ver-detalhes"))
      mostrarDetalhesSolicitacao(id);
    if (btn.classList.contains("btn-orcamento")) prepararFormOrcamento(id);
    if (btn.classList.contains("btn-aprovar")) prepararModalAprovacao(id);
    if (btn.classList.contains("btn-finalizar")) prepararModalFinalizacao(id);
    if (btn.classList.contains("btn-editar-usuario")) editarUsuario(id);
    if (btn.classList.contains("btn-excluir-usuario")) excluirUsuario(id);
    if (btn.classList.contains("btn-remover-item"))
      removerItemInterface(btn.getAttribute("data-item-id"));
    if (btn.classList.contains("btn-adicionar-fotos"))
      document
        .querySelector(
          `.fotos-input[data-item-id="${btn.getAttribute("data-item-id")}"]`,
        )
        .click();
  });

  // Delegate de arquivos para fotos do item
  document.addEventListener("change", async function (e) {
    if (e.target.classList.contains("fotos-input")) {
      const itemId = e.target.getAttribute("data-item-id");
      await processarFotosItem(itemId, e.target.files);
    }
  });

  // Ações de Aprovação
  document
    .getElementById("btn-rejeitar")
    ?.addEventListener("click", () => processarAprovacao("rejeitado"));
  document
    .getElementById("btn-aprovar-confirmar")
    ?.addEventListener("click", () => processarAprovacao("compra"));
}

// ==========================================================================
// LÓGICA DE AUTENTICAÇÃO E SESSÃO
// ==========================================================================
async function verificarSessao() {
  const sessao = await DatabaseService.getSessaoAtiva();
  if (sessao) {
    appState.usuarioAtual = sessao;
    aplicarLoginNaInterface(sessao);
  } else {
    document.getElementById("tela-login").style.display = "flex";
    document.getElementById("sistema-principal").style.display = "none";
  }
}

async function fazerLogin(e) {
  e.preventDefault();
  const user = document.getElementById("login-username").value.trim();
  const pass = document.getElementById("login-password").value.trim();

  const usuarioBanco = appState.usuarios.find(
    (u) => u.login === user && u.senha === pass,
  );

  if (usuarioBanco) {
    appState.usuarioAtual = usuarioBanco;
    await DatabaseService.setSessaoAtiva(usuarioBanco);
    aplicarLoginNaInterface(usuarioBanco);
    mostrarNotificacao(`Bem-vindo, ${usuarioBanco.nome}!`, "sucesso");
  } else {
    mostrarNotificacao("Usuário ou senha incorretos", "erro");
  }
}

function aplicarLoginNaInterface(usuario) {
  document.getElementById("usuario-logado").textContent = usuario.nome;
  document.getElementById("perfil-logado").textContent =
    perfisPermissoes[usuario.perfil].nome;
  document.getElementById("solicitante").value = usuario.nome;
  document.getElementById("comprador").value = usuario.nome;

  configurarMenuPermissoes(usuario);

  document.getElementById("tela-login").style.display = "none";
  document.getElementById("sistema-principal").style.display = "flex";

  const telasPrioridade = [
    "novaSolicitacao",
    "historico",
    "compras",
    "aprovacao",
    "finalizacao",
    "usuarios",
  ];
  let telaInicial = "historico";
  for (const key of telasPrioridade) {
    if (usuario.permissoes[key]) {
      telaInicial = key === "novaSolicitacao" ? "nova-solicitacao" : key;
      break;
    }
  }

  alternarTela(telaInicial);
  atualizarFiltroSolicitantes();
}

async function fazerLogout() {
  appState.usuarioAtual = null;
  await DatabaseService.setSessaoAtiva(null);
  document.getElementById("form-login").reset();
  document.getElementById("tela-login").style.display = "flex";
  document.getElementById("sistema-principal").style.display = "none";
}

function configurarMenuPermissoes(usuario) {
  const mapa = {
    "nova-solicitacao": "novaSolicitacao",
    historico: "historico",
    compras: "compras",
    aprovacao: "aprovacao",
    finalizacao: "finalizacao",
    usuarios: "usuarios",
  };

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const permissaoReq = mapa[btn.getAttribute("data-tela")];
    btn.style.display = usuario.permissoes[permissaoReq] ? "flex" : "none";
  });
}

function alternarTela(nomeTela) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tela") === nomeTela);
  });
  document.querySelectorAll(".tela").forEach((tela) => {
    tela.classList.toggle("tela-ativa", tela.id === nomeTela);
  });

  if (nomeTela !== "usuarios") {
    const steps = document.querySelectorAll(".status-step");
    steps.forEach((step) => step.classList.remove("active"));
    if (nomeTela === "nova-solicitacao") steps[0].classList.add("active");
    if (nomeTela === "compras") steps[1].classList.add("active");
    if (nomeTela === "aprovacao") steps[2].classList.add("active");
    if (nomeTela === "finalizacao") steps[3].classList.add("active");
  }

  if (nomeTela === "usuarios") atualizarInterfaceUsuarios();
  else atualizarInterfaceModulos();
}

// ==========================================================================
// MÓDULO: NOVA SOLICITAÇÃO
// ==========================================================================
let idControleItens = 0;
function adicionarItemInterface() {
  idControleItens++;
  const html = `
        <div class="item-solicitacao" data-item-id="${idControleItens}">
            <div class="form-group">
                <label>Descrição do Produto/Serviço *</label>
                <input type="text" class="item-descricao" required placeholder="Ex: Monitor Dell 24 polegadas">
            </div>
            <div class="form-group">
                <label>Quantidade *</label>
                <input type="number" class="item-quantidade" min="1" required placeholder="1">
            </div>
            <button type="button" class="btn-remover-item" data-item-id="${idControleItens}" title="Remover"><i class="fas fa-trash-alt"></i></button>
            <div class="fotos-item-container">
                <input type="file" class="fotos-input" data-item-id="${idControleItens}" multiple accept="image/*" style="display:none;">
                <button type="button" class="btn-secundario btn-sm btn-adicionar-fotos" data-item-id="${idControleItens}">
                    <i class="fas fa-camera"></i> Anexar Imagens
                </button>
                <div class="fotos-preview" data-item-id="${idControleItens}"></div>
            </div>
        </div>
    `;
  document.getElementById("itens-lista").insertAdjacentHTML("beforeend", html);
}

function removerItemInterface(id) {
  const lista = document.getElementById("itens-lista");
  if (lista.children.length <= 1)
    return mostrarNotificacao("Adicione ao menos 1 item.", "aviso");
  lista.querySelector(`.item-solicitacao[data-item-id="${id}"]`).remove();
}

async function processarFotosItem(itemId, arquivos) {
  const previewBox = document.querySelector(
    `.fotos-preview[data-item-id="${itemId}"]`,
  );
  for (let arquivo of arquivos) {
    const urlSegura = await simularUploadArquivo(arquivo);
    previewBox.insertAdjacentHTML(
      "beforeend",
      `<div class="foto-item-wrapper"><img src="${urlSegura}" data-b64="true"></div>`,
    );
  }
}

async function enviarSolicitacao(e) {
  e.preventDefault();
  const btnSubmit = document.getElementById("btn-enviar-solicitacao");
  btnSubmit.disabled = true;

  try {
    const itensElements = document.querySelectorAll(".item-solicitacao");
    const itens = Array.from(itensElements).map((el) => {
      return {
        descricao: el.querySelector(".item-descricao").value.trim(),
        quantidade: parseInt(el.querySelector(".item-quantidade").value),
        fotos: Array.from(el.querySelectorAll(".fotos-preview img")).map(
          (img) => img.src,
        ),
      };
    });

    const nova = {
      id: Date.now(),
      protocolo: appState.proximoProtocolo++,
      solicitante: appState.usuarioAtual.nome,
      setor: document.getElementById("setor").value,
      justificativa: document.getElementById("justificativa").value.trim(),
      urgencia: document.getElementById("urgencia").value,
      itens,
      status: "solicitado",
      dataCriacao: new Date().toISOString(),
      orcamentos: [],
      historicoAcoes: [
        {
          acao: "Criação",
          usuario: appState.usuarioAtual.nome,
          data: new Date().toISOString(),
        },
      ],
    };

    appState.solicitacoes.push(nova);
    await DatabaseService.salvarSolicitacoes(appState.solicitacoes);

    mostrarNotificacao(
      `Solicitação #${nova.protocolo} criada com sucesso!`,
      "sucesso",
    );
    document.getElementById("form-solicitacao").reset();
    document.getElementById("itens-lista").innerHTML = "";
    adicionarItemInterface();
    alternarTela("historico");
  } catch (err) {
    mostrarNotificacao(err.message, "erro");
  } finally {
    btnSubmit.disabled = false;
  }
}

// ==========================================================================
// FUNÇÕES DE ATUALIZAÇÃO DE INTERFACE (WORKFLOWS)
// ==========================================================================
function atualizarInterfaceModulos() {
  atualizarHistorico();
  atualizarModuloCotações();
  atualizarModuloAprovacao();
  atualizarModuloFinalizacao();
}

function atualizarHistorico() {
  const container = document.querySelector(".solicitacoes-lista");
  if (!container) return;

  const [fStatus, fSetor, fSol] = [
    "filtro-status",
    "filtro-setor",
    "filtro-solicitante",
  ].map((id) => document.getElementById(id).value);

  let html = "";
  const filtrados = appState.solicitacoes
    .filter((s) => {
      return (
        (fStatus === "todos" || s.status === fStatus) &&
        (fSetor === "todos" || s.setor === fSetor) &&
        (fSol === "todos" || s.solicitante === fSol)
      );
    })
    .reverse();

  if (filtrados.length === 0) {
    container.innerHTML =
      '<p class="full-width text-center color-muted py-4">Nenhum registro encontrado.</p>';
    return;
  }

  filtrados.forEach((s) => {
    const prodNames = s.itens.map((i) => escapeHTML(i.descricao)).join(", ");
    html += `
        <div class="solicitacao-card">
            <div class="card-header-info">
                <span class="protocol-badge">#${s.protocolo}</span>
                <span class="status-badge ${s.status}">${s.status.toUpperCase()}</span>
            </div>
            <div class="card-body-details">
                <h4>Setor de ${escapeHTML(s.setor.toUpperCase())}</h4>
                <p class="meta-row"><strong>Solicitante:</strong> ${escapeHTML(s.solicitante)}</p>
                <p class="meta-row"><strong>Produto(s):</strong> <span class="destaque-produto">${prodNames}</span></p>
            </div>
            <div class="card-actions-wrapper">
                <button class="btn-secundario btn-sm btn-ver-detalhes w-100" data-id="${s.id}"><i class="fas fa-eye"></i> Detalhes do Pedido</button>
            </div>
        </div>`;
  });
  container.innerHTML = html;
}

function atualizarModuloCotações() {
  const container = document.querySelector(".solicitacoes-orcamento");
  if (!container) return;

  const pendentes = appState.solicitacoes.filter((s) =>
    ["solicitado", "cotacao"].includes(s.status),
  );
  if (pendentes.length === 0) {
    container.innerHTML =
      '<p class="color-muted p-3 text-center">Nenhum processo aguardando cotação.</p>';
    return;
  }

  container.innerHTML = pendentes
    .map(
      (s) => `
        <div class="card-mini-workflow" data-id="${s.id}">
            <div class="flex justify-between font-mono font-bold color-muted mb-1">
                <span>#${s.protocolo}</span> <span>${s.orcamentos.length} Orc(s)</span>
            </div>
            <div class="destaque-produto-box"><i class="fas fa-box-open"></i> <span class="truncate">${escapeHTML(s.itens.map((i) => i.descricao).join(", "))}</span></div>
            <div style="font-size: 0.85rem; color: var(--text-muted)">${escapeHTML(s.justificativa).substring(0, 60)}...</div>
            <button class="btn-primario btn-sm btn-orcamento mt-2 w-100" style="margin-top: 12px" data-id="${s.id}"><i class="fas fa-plus"></i> Lançar Proposta</button>
        </div>
    `,
    )
    .join("");
}

function prepararFormOrcamento(id) {
  document.getElementById("orcamento-solicitacao-id").value = id;
  document
    .querySelectorAll(".card-mini-workflow")
    .forEach((c) => c.classList.remove("selected"));
  document
    .querySelector(`.card-mini-workflow[data-id="${id}"]`)
    ?.classList.add("selected");
  document.getElementById("fornecedor").focus();
  if (window.innerWidth < 768)
    document
      .getElementById("form-adicionar-orcamento")
      .scrollIntoView({ behavior: "smooth" });
}

function gerenciarAnexosOrcamento(e) {
  const box = document.getElementById("preview-anexos");
  box.innerHTML = Array.from(e.target.files)
    .map(
      (f) =>
        `<span class="anexo-item-tag"><i class="fas fa-paperclip"></i> ${escapeHTML(f.name)}</span>`,
    )
    .join("");
}

async function adicionarOrcamento(e) {
  e.preventDefault();
  const id = parseInt(
    document.getElementById("orcamento-solicitacao-id").value,
  );
  if (!id)
    return mostrarNotificacao("Selecione uma solicitação na lista", "aviso");

  const solicitacao = appState.solicitacoes.find((s) => s.id === id);
  solicitacao.orcamentos.push({
    id: Date.now(),
    fornecedor: document.getElementById("fornecedor").value.trim(),
    valor: parseFloat(document.getElementById("valor-orcamento").value),
    prazo: parseInt(document.getElementById("prazo-entrega").value),
    comprador: appState.usuarioAtual.nome,
    dataRegistro: new Date().toISOString(),
  });

  if (
    confirm(
      "Orçamento salvo! Deseja enviar para aprovação da Gestão agora?\n\n(Cancelar = Continuar lançando propostas)",
    )
  ) {
    solicitacao.status = "aprovacao";
    solicitacao.historicoAcoes.push({
      acao: "Enviado para Aprovação",
      usuario: appState.usuarioAtual.nome,
      data: new Date().toISOString(),
    });
  } else {
    solicitacao.status = "cotacao";
    solicitacao.historicoAcoes.push({
      acao: "Orçamento Adicionado",
      usuario: appState.usuarioAtual.nome,
      data: new Date().toISOString(),
    });
  }

  await DatabaseService.salvarSolicitacoes(appState.solicitacoes);
  mostrarNotificacao("Proposta registrada!", "sucesso");
  e.target.reset();
  document.getElementById("preview-anexos").innerHTML = "";
  document.getElementById("orcamento-solicitacao-id").value = "";
  atualizarInterfaceModulos();
}

function atualizarModuloAprovacao() {
  const c = document.querySelector(".solicitacoes-aprovacao");
  if (!c) return;
  const items = appState.solicitacoes.filter((s) => s.status === "aprovacao");

  c.innerHTML =
    items.length === 0
      ? '<p class="full-width text-center color-muted py-4">Nenhuma pendência de gestão.</p>'
      : items
          .map(
            (s) => `
        <div class="solicitacao-card">
            <div class="card-header-info">
                <span class="protocol-badge">#${s.protocolo}</span> <span class="status-badge aprovacao">ANÁLISE</span>
            </div>
            <div class="card-body-details">
                <h4><span class="destaque-produto">${escapeHTML(s.itens.map((i) => i.descricao).join(", "))}</span></h4>
                <p class="meta-row"><strong>Urgência:</strong> ${s.urgencia.toUpperCase()} | <strong>Cotações:</strong> ${s.orcamentos.length}</p>
            </div>
            <div class="card-actions-wrapper">
                <button class="btn-primario btn-sm btn-aprovar w-100" data-id="${s.id}"><i class="fas fa-gavel"></i> Avaliar Processo</button>
            </div>
        </div>`,
          )
          .join("");
}

function prepararModalAprovacao(id) {
  const s = appState.solicitacoes.find((x) => x.id === id);
  document.getElementById("aprovacao-solicitacao-id").value = id;

  const tabela = s.orcamentos
    .map(
      (o) => `
        <div style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
            <span><strong>${escapeHTML(o.fornecedor)}</strong> (${o.prazo} dias)</span>
            <span style="color:var(--primary); font-weight:700">R$ ${o.valor.toFixed(2)}</span>
        </div>
    `,
    )
    .join("");

  document.getElementById("modal-aprovacao-corpo").innerHTML = `
        <p><strong>Justificativa:</strong> ${escapeHTML(s.justificativa)}</p>
        <div style="background:var(--bg-darkest); margin:10px 0; border-radius:6px;">${tabela}</div>
    `;
  document.getElementById("modal-aprovacao").style.display = "flex";
}

async function processarAprovacao(novoStatus) {
  const id = parseInt(
    document.getElementById("aprovacao-solicitacao-id").value,
  );
  const obs = document.getElementById("observacoes-aprovacao").value.trim();
  if (!obs)
    return mostrarNotificacao("Preencha as observações / parecer", "aviso");

  const s = appState.solicitacoes.find((x) => x.id === id);
  s.status = novoStatus;
  s.historicoAcoes.push({
    acao: novoStatus === "compra" ? "Aprovação" : "Reprovação",
    usuario: appState.usuarioAtual.nome,
    data: new Date().toISOString(),
    obs,
  });

  await DatabaseService.salvarSolicitacoes(appState.solicitacoes);
  mostrarNotificacao(
    `Processo ${novoStatus === "compra" ? "Aprovado" : "Rejeitado"}.`,
    "info",
  );
  document.getElementById("modal-aprovacao").style.display = "none";
  document.getElementById("form-acao-aprovacao").reset();
  atualizarInterfaceModulos();
}

function atualizarModuloFinalizacao() {
  const c = document.querySelector(".solicitacoes-finalizacao");
  if (!c) return;
  const items = appState.solicitacoes.filter((s) => s.status === "compra");

  c.innerHTML =
    items.length === 0
      ? '<p class="full-width text-center color-muted py-4">Nenhum pedido para fechar.</p>'
      : items
          .map(
            (s) => `
        <div class="solicitacao-card">
            <div class="card-header-info">
                <span class="protocol-badge">#${s.protocolo}</span> <span class="status-badge compra">FATURAR</span>
            </div>
            <div class="card-body-details">
                <h4><span class="destaque-produto">${escapeHTML(s.itens.map((i) => i.descricao).join(", "))}</span></h4>
            </div>
            <div class="card-actions-wrapper">
                <button class="btn-success btn-sm btn-finalizar w-100" data-id="${s.id}"><i class="fas fa-shopping-bag"></i> Concluir Pedido</button>
            </div>
        </div>`,
          )
          .join("");
}

function prepararModalFinalizacao(id) {
  const s = appState.solicitacoes.find((x) => x.id === id);
  document.getElementById("finalizacao-solicitacao-id").value = id;

  const sel = document.getElementById("orcamento-vencedor");
  sel.innerHTML =
    '<option value="">Selecione o vencedor...</option>' +
    s.orcamentos
      .map(
        (o) =>
          `<option value="${o.id}">${escapeHTML(o.fornecedor)} - R$ ${o.valor.toFixed(2)}</option>`,
      )
      .join("");

  sel.onchange = function () {
    const orc = s.orcamentos.find((x) => x.id == this.value);
    if (orc) document.getElementById("valor-final").value = orc.valor;
  };

  document.getElementById("form-acao-finalizacao").onsubmit = async (e) => {
    e.preventDefault();
    s.status = "concluido";
    s.historicoAcoes.push({
      acao: "Fechamento e Compra",
      usuario: appState.usuarioAtual.nome,
      data: new Date().toISOString(),
    });
    await DatabaseService.salvarSolicitacoes(appState.solicitacoes);
    mostrarNotificacao("Processo concluído com sucesso!", "sucesso");
    document.getElementById("modal-finalizacao").style.display = "none";
    atualizarInterfaceModulos();
  };

  document.getElementById("modal-finalizacao").style.display = "flex";
}

// ==========================================================================
// VISUALIZAÇÃO E UTILITÁRIOS (MODAIS E CONFIGS)
// ==========================================================================
function mostrarDetalhesSolicitacao(id) {
  const s = appState.solicitacoes.find((x) => x.id === id);
  const htmlItens = s.itens
    .map(
      (i) => `
        <div style="padding:10px; border-bottom:1px solid var(--border-color)">
            <strong>${escapeHTML(i.descricao)}</strong> (Qtd: ${i.quantidade})
            <div style="display:flex; gap:8px; margin-top:8px;">
                ${i.fotos.map((f) => `<img src="${f}" style="width:50px;height:50px;border-radius:4px;object-fit:cover;">`).join("")}
            </div>
        </div>
    `,
    )
    .join("");

  const htmlHist = s.historicoAcoes
    .map(
      (h) =>
        `<p style="font-size:0.8rem; margin-bottom:4px;">• <strong>${new Date(h.data).toLocaleString("pt-BR")}</strong> - ${escapeHTML(h.acao)} por ${escapeHTML(h.usuario)} ${h.obs ? `(${escapeHTML(h.obs)})` : ""}</p>`,
    )
    .join("");

  document.getElementById("modal-detalhes-corpo").innerHTML = `
        <div style="margin-bottom:16px;">
            <p><strong>Protocolo:</strong> #${s.protocolo} | <strong>Status:</strong> ${s.status.toUpperCase()}</p>
            <p><strong>Justificativa:</strong> ${escapeHTML(s.justificativa)}</p>
        </div>
        <div style="margin-bottom:16px; background:var(--bg-darkest); border-radius:6px;">${htmlItens}</div>
        <div style="padding:12px; background:rgba(0,0,0,0.2); border-radius:6px;">${htmlHist}</div>
    `;
  document.getElementById("modal-detalhes").style.display = "flex";
}

function atualizarFiltroSolicitantes() {
  const sel = document.getElementById("filtro-solicitante");
  if (!sel) return;
  const nomes = [...new Set(appState.solicitacoes.map((s) => s.solicitante))];
  sel.innerHTML =
    '<option value="todos">Todos</option>' +
    nomes
      .map((n) => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`)
      .join("");
}

// ==========================================================================
// MÓDULO DE USUÁRIOS E CONFIGURAÇÃO DE ACESSO
// ==========================================================================
function atualizarInterfaceUsuarios() {
  const grid = document.querySelector(".usuarios-grid");
  if (!grid) return;
  grid.innerHTML = appState.usuarios
    .map(
      (u) => `
        <div class="usuario-card-item">
            <div class="user-meta-box">
                <h5>${escapeHTML(u.nome)}</h5>
                <p>${escapeHTML(u.login)} | ${escapeHTML(u.perfil.toUpperCase())}</p>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-secundario btn-sm btn-editar-usuario" data-id="${u.id}"><i class="fas fa-edit"></i></button>
                <button class="btn-danger btn-sm btn-excluir-usuario" data-id="${u.id}" ${u.id === 1 ? "disabled" : ""}><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `,
    )
    .join("");
}

async function salvarUsuario(e) {
  e.preventDefault();
  const id = document.getElementById("usuario-id").value;
  const novoUsu = {
    nome: document.getElementById("usuario-nome").value.trim(),
    login: document.getElementById("usuario-login").value.trim(),
    senha: document.getElementById("usuario-senha").value,
    perfil: document.getElementById("usuario-perfil").value,
    permissoes: {
      novaSolicitacao: document.getElementById("permissao-nova").checked,
      historico: true,
      compras: document.getElementById("permissao-compras").checked,
      aprovacao: document.getElementById("permissao-aprovacao").checked,
      finalizacao: document.getElementById("permissao-finalizacao").checked,
      usuarios: document.getElementById("permissao-usuarios").checked,
    },
  };

  if (id) {
    const idx = appState.usuarios.findIndex((u) => u.id == id);
    appState.usuarios[idx] = { ...appState.usuarios[idx], ...novoUsu };
  } else {
    if (appState.usuarios.some((u) => u.login === novoUsu.login))
      return mostrarNotificacao("Login indisponível", "erro");
    novoUsu.id = Date.now();
    novoUsu.dataCadastro = new Date().toISOString();
    appState.usuarios.push(novoUsu);
  }
  await DatabaseService.salvarUsuarios(appState.usuarios);
  mostrarNotificacao("Usuário salvo!", "sucesso");
  document.getElementById("form-cadastrar-usuario").reset();
  document.getElementById("usuario-id").value = "";
  atualizarInterfaceUsuarios();
}

function editarUsuario(id) {
  const u = appState.usuarios.find((x) => x.id === id);
  document.getElementById("usuario-id").value = u.id;
  document.getElementById("usuario-nome").value = u.nome;
  document.getElementById("usuario-login").value = u.login;
  document.getElementById("usuario-senha").value = u.senha;
  document.getElementById("usuario-perfil").value = u.perfil;

  ["nova", "compras", "aprovacao", "finalizacao", "usuarios"].forEach((p) => {
    document.getElementById(`permissao-${p}`).checked =
      u.permissoes[p === "nova" ? "novaSolicitacao" : p];
  });
  if (window.innerWidth < 768)
    document
      .getElementById("form-cadastrar-usuario")
      .scrollIntoView({ behavior: "smooth" });
}

async function excluirUsuario(id) {
  if (id === 1)
    return mostrarNotificacao("Admin principal não pode ser excluído", "erro");
  if (confirm("Revogar acesso deste usuário?")) {
    appState.usuarios = appState.usuarios.filter((u) => u.id !== id);
    await DatabaseService.salvarUsuarios(appState.usuarios);
    atualizarInterfaceUsuarios();
  }
}

function atualizarPermissoesPorPerfil(p) {
  document.getElementById("permissao-nova").checked = [
    "solicitante",
    "administrador",
  ].includes(p);
  document.getElementById("permissao-compras").checked = [
    "comprador",
    "administrador",
  ].includes(p);
  document.getElementById("permissao-aprovacao").checked = [
    "gestor",
    "administrador",
  ].includes(p);
  document.getElementById("permissao-finalizacao").checked = [
    "comprador",
    "administrador",
  ].includes(p);
  document.getElementById("permissao-usuarios").checked = p === "administrador";
}

function mostrarModalConfig() {
  const u = appState.usuarioAtual;
  document.getElementById("config-usuario").textContent = escapeHTML(u.nome);
  document.getElementById("config-perfil").textContent = escapeHTML(u.perfil);

  const icons = Object.entries(u.permissoes)
    .map(
      ([k, v]) =>
        `<div class="permissao-config"><i class="fas ${v ? "fa-check-circle text-success" : "fa-times-circle"}"></i> ${k}</div>`,
    )
    .join("");
  document.getElementById("config-permissoes").innerHTML = icons;
  document.getElementById("modal-config").style.display = "flex";
}

async function alterarSenha(e) {
  e.preventDefault();
  const atual = document.getElementById("senha-atual").value;
  const nova = document.getElementById("nova-senha").value;
  if (atual !== appState.usuarioAtual.senha)
    return mostrarNotificacao("Senha atual inválida", "erro");
  if (nova !== document.getElementById("confirmar-senha").value)
    return mostrarNotificacao("Senhas não coincidem", "erro");

  appState.usuarioAtual.senha = nova;
  const idx = appState.usuarios.findIndex(
    (u) => u.id === appState.usuarioAtual.id,
  );
  appState.usuarios[idx].senha = nova;

  await DatabaseService.salvarUsuarios(appState.usuarios);
  await DatabaseService.setSessaoAtiva(appState.usuarioAtual);

  mostrarNotificacao("Senha altereda com sucesso!", "sucesso");
  document.getElementById("modal-config").style.display = "none";
  e.target.reset();
}

function mostrarNotificacao(msg, tipo = "info") {
  const icone = {
    sucesso: "fa-check-circle",
    erro: "fa-exclamation-circle",
    aviso: "fa-exclamation-triangle",
    info: "fa-info-circle",
  }[tipo];
  const n = document.createElement("div");
  n.className = `notificacao ${tipo}`;
  n.innerHTML = `<i class="fas ${icone}"></i><span>${escapeHTML(msg)}</span>`;
  document.getElementById("notificacoes").appendChild(n);
  setTimeout(() => n.remove(), 4000);
}

adicionarItemInterface();