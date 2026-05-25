// Sistema de Solicitações de Compra com Login e Controle de Acesso

// Função utilitária global para prevenir XSS ao renderizar dados do usuário no DOM
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag]));
}

// Dados da aplicação
let dadosAplicacao = {
    usuarios: [
        {
            id: 1, nome: "Administrador do Sistema", login: "admin", senha: "admin123",
            perfil: "administrador",
            permissoes: { novaSolicitacao: true, historico: true, compras: true, aprovacao: true, finalizacao: true, usuarios: true },
            dataCadastro: new Date().toISOString()
        },
        {
            id: 2, nome: "João Silva", login: "joao", senha: "joao123",
            perfil: "solicitante",
            permissoes: { novaSolicitacao: true, historico: true, compras: false, aprovacao: false, finalizacao: false, usuarios: false },
            dataCadastro: new Date().toISOString()
        },
        {
            id: 3, nome: "Maria Santos", login: "maria", senha: "maria123",
            perfil: "comprador",
            permissoes: { novaSolicitacao: false, historico: true, compras: true, aprovacao: false, finalizacao: true, usuarios: false },
            dataCadastro: new Date().toISOString()
        },
        {
            id: 4, nome: "Carlos Oliveira", login: "carlos", senha: "carlos123",
            perfil: "gestor",
            permissoes: { novaSolicitacao: false, historico: true, compras: false, aprovacao: true, finalizacao: false, usuarios: false },
            dataCadastro: new Date().toISOString()
        }
    ],
    solicitações: [],
    próximoId: 1,
    próximoProtocolo: 1000,
    usuárioAtual: null
};

const perfisPermissoes = {
    solicitante: { nome: "Solicitante" },
    comprador: { nome: "Comprador" },
    gestor: { nome: "Gestor" },
    administrador: { nome: "Administrador" }
};

// Elementos DOM
const elementos = {
    telaLogin: document.getElementById('tela-login'),
    sistemaPrincipal: document.getElementById('sistema-principal'),
    formLogin: document.getElementById('form-login'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    usuarioLogado: document.getElementById('usuario-logado'),
    perfilLogado: document.getElementById('perfil-logado'),
    btnLogout: document.getElementById('btn-logout'),
    btnConfig: document.getElementById('btn-config'),
    telas: document.querySelectorAll('.tela'),
    botoesNavegacao: document.querySelectorAll('.nav-btn'),
    btnUsuarios: document.getElementById('btn-usuarios'),
    formSolicitacao: document.getElementById('form-solicitacao'),
    solicitanteInput: document.getElementById('solicitante'),
    itensLista: document.getElementById('itens-lista'),
    btnAdicionarItem: document.getElementById('btn-adicionar-item'),
    btnEnviarSolicitacao: document.getElementById('btn-enviar-solicitacao'),
    solicitacoesLista: document.querySelector('.solicitacoes-lista'),
    filtroStatus: document.getElementById('filtro-status'),
    filtroSetor: document.getElementById('filtro-setor'),
    filtroSolicitante: document.getElementById('filtro-solicitante'),
    formAdicionarOrcamento: document.getElementById('form-adicionar-orcamento'),
    compradorInput: document.getElementById('comprador'),
    solicitacoesOrcamento: document.querySelector('.solicitacoes-orcamento'),
    anexosInput: document.getElementById('anexos-input'),
    btnAdicionarAnexos: document.getElementById('btn-adicionar-anexos'),
    previewAnexos: document.getElementById('preview-anexos'),
    solicitacoesAprovacao: document.querySelector('.solicitacoes-aprovacao'),
    solicitacoesFinalizacao: document.querySelector('.solicitacoes-finalizacao'),
    telaUsuarios: document.getElementById('usuarios'),
    usuariosGrid: document.querySelector('.usuarios-grid'),
    formCadastrarUsuario: document.getElementById('form-cadastrar-usuario'),
    btnNovoUsuario: document.getElementById('btn-novo-usuario'),
    btnCancelarEdicao: document.getElementById('btn-cancelar-edicao'),
    usuarioIdInput: document.getElementById('usuario-id'),
    usuarioNomeInput: document.getElementById('usuario-nome'),
    usuarioLoginInput: document.getElementById('usuario-login'),
    usuarioSenhaInput: document.getElementById('usuario-senha'),
    usuarioPerfilSelect: document.getElementById('usuario-perfil'),
    modalConfig: document.getElementById('modal-config'),
    formAlterarSenha: document.getElementById('form-alterar-senha'),
    modalDetalhes: document.getElementById('modal-detalhes'),
    modalAprovacao: document.getElementById('modal-aprovacao'),
    modalFinalizacao: document.getElementById('modal-finalizacao'),
    notificacoes: document.getElementById('notificacoes')
};

document.addEventListener('DOMContentLoaded', function() {
    inicializarAplicacao();
    carregarDadosLocalStorage();
    verificarLogin();
});

function inicializarAplicacao() {
    elementos.formLogin.addEventListener('submit', fazerLogin);
    elementos.btnLogout.addEventListener('click', fazerLogout);
    elementos.btnConfig.addEventListener('click', () => { mostrarModalConfig(); });
    
    elementos.botoesNavegacao.forEach(botao => {
        botao.addEventListener('click', function() {
            const telaAlvo = this.getAttribute('data-tela');
            alternarTela(telaAlvo);
        });
    });
    
    document.querySelectorAll('.btn-fechar-modal').forEach(botao => {
        botao.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
    
    elementos.formSolicitacao.addEventListener('submit', enviarSolicitacao);
    elementos.btnAdicionarItem.addEventListener('click', adicionarItem);
    
    elementos.filtroStatus.addEventListener('change', atualizarHistorico);
    elementos.filtroSetor.addEventListener('change', atualizarHistorico);
    elementos.filtroSolicitante.addEventListener('change', atualizarHistorico);
    
    elementos.formAdicionarOrcamento.addEventListener('submit', adicionarOrcamento);
    elementos.btnAdicionarAnexos.addEventListener('click', () => elementos.anexosInput.click());
    elementos.anexosInput.addEventListener('change', gerenciarAnexosOrcamento);
    
    elementos.formCadastrarUsuario.addEventListener('submit', salvarUsuario);
    elementos.btnNovoUsuario.addEventListener('click', () => {
        limparFormularioUsuario();
        elementos.formCadastrarUsuario.scrollIntoView({ behavior: 'smooth' });
    });
    elementos.btnCancelarEdicao.addEventListener('click', limparFormularioUsuario);
    elementos.formAlterarSenha.addEventListener('submit', alterarSenha);
    
    document.addEventListener('click', function(event) {
        if (event.target.closest('.btn-ver-detalhes')) {
            const id = parseInt(event.target.closest('.btn-ver-detalhes').getAttribute('data-id'));
            mostrarDetalhesSolicitacao(id);
        }
        if (event.target.closest('.btn-orcamento')) {
            const id = parseInt(event.target.closest('.btn-orcamento').getAttribute('data-id'));
            prepararFormOrcamento(id);
        }
        if (event.target.closest('.btn-aprovar')) {
            const id = parseInt(event.target.closest('.btn-aprovar').getAttribute('data-id'));
            prepararModalAprovacao(id);
        }
        if (event.target.closest('.btn-finalizar')) {
            const id = parseInt(event.target.closest('.btn-finalizar').getAttribute('data-id'));
            prepararModalFinalizacao(id);
        }
        if (event.target.closest('.btn-editar-usuario')) {
            const id = parseInt(event.target.closest('.btn-editar-usuario').getAttribute('data-id'));
            editarUsuario(id);
        }
        if (event.target.closest('.btn-excluir-usuario')) {
            const id = parseInt(event.target.closest('.btn-excluir-usuario').getAttribute('data-id'));
            excluirUsuario(id);
        }
    });
    
    elementos.itensLista.addEventListener('click', function(event) {
        if (event.target.closest('.btn-remover-item')) {
            const itemId = event.target.closest('.btn-remover-item').getAttribute('data-item-id');
            removerItem(itemId);
        }
        if (event.target.closest('.btn-adicionar-fotos')) {
            const itemId = event.target.closest('.btn-adicionar-fotos').getAttribute('data-item-id');
            document.querySelector(`.fotos-input[data-item-id="${itemId}"]`).click();
        }
    });
    
    document.addEventListener('change', function(event) {
        if (event.target.classList.contains('fotos-input')) {
            const itemId = event.target.getAttribute('data-item-id');
            adicionarFotosItem(itemId, event.target.files);
        }
    });
    
    elementos.usuarioPerfilSelect.addEventListener('change', function() {
        atualizarPermissoesPorPerfil(this.value);
    });
}

// Persistência de Dados com tratamento de erro
function carregarDadosLocalStorage() {
    try {
        const dadosSalvos = localStorage.getItem('sistemaCompras');
        if (dadosSalvos) {
            const dados = JSON.parse(dadosSalvos);
            dadosAplicacao.solicitações = dados.solicitações || [];
            dadosAplicacao.próximoId = dados.próximoId || 1;
            dadosAplicacao.próximoProtocolo = dados.próximoProtocolo || 1000;
            dadosAplicacao.usuárioAtual = dados.usuárioAtual || null;
        }
        const usuariosSalvos = localStorage.getItem('sistemaComprasUsuarios');
        if (usuariosSalvos) {
            dadosAplicacao.usuarios = JSON.parse(usuariosSalvos);
        }
    } catch(e) {
        console.error("Erro ao carregar dados do LocalStorage:", e);
        mostrarNotificacao("Erro interno ao ler dados salvos no navegador.", "erro");
    }
}

function salvarDadosLocalStorage() {
    try {
        const dadosParaSalvar = {
            solicitações: dadosAplicacao.solicitações,
            próximoId: dadosAplicacao.próximoId,
            próximoProtocolo: dadosAplicacao.próximoProtocolo,
            usuárioAtual: dadosAplicacao.usuárioAtual
        };
        localStorage.setItem('sistemaCompras', JSON.stringify(dadosParaSalvar));
        localStorage.setItem('sistemaComprasUsuarios', JSON.stringify(dadosAplicacao.usuarios));
    } catch(e) {
        console.error("Erro ao salvar dados no LocalStorage:", e);
        mostrarNotificacao("Seu navegador não permitiu salvar os dados localmente.", "aviso");
    }
}

function verificarLogin() {
    if (dadosAplicacao.usuárioAtual) {
        fazerLoginAutomatico(dadosAplicacao.usuárioAtual.login);
    } else {
        elementos.telaLogin.style.display = 'flex';
        elementos.sistemaPrincipal.style.display = 'none';
    }
}

function fazerLogin(event) {
    event.preventDefault();
    const username = elementos.loginUsername.value.trim();
    const password = elementos.loginPassword.value.trim();
    
    if (!username || !password) {
        mostrarNotificacao('Preencha usuário e senha', 'erro');
        return;
    }
    
    const usuario = dadosAplicacao.usuarios.find(u => u.login === username && u.senha === password);
    if (usuario) {
        dadosAplicacao.usuárioAtual = usuario;
        salvarDadosLocalStorage();
        fazerLoginComum(usuario);
        mostrarNotificacao(`Bem-vindo, ${usuario.nome}!`, 'sucesso');
    } else {
        mostrarNotificacao('Usuário ou senha incorretos', 'erro');
    }
}

function fazerLoginAutomatico(username) {
    const usuario = dadosAplicacao.usuarios.find(u => u.login === username);
    if (usuario) {
        dadosAplicacao.usuárioAtual = usuario;
        fazerLoginComum(usuario);
    }
}

function fazerLoginComum(usuario) {
    elementos.usuarioLogado.textContent = usuario.nome;
    elementos.perfilLogado.textContent = perfisPermissoes[usuario.perfil].nome;
    elementos.solicitanteInput.value = usuario.nome;
    elementos.compradorInput.value = usuario.nome;
    
    configurarPermissoesUsuario(usuario);
    
    elementos.telaLogin.style.display = 'none';
    elementos.sistemaPrincipal.style.display = 'block';
    
    const mapPermissoesTelas = {
        'novaSolicitacao': 'nova-solicitacao',
        'historico': 'historico',
        'compras': 'compras',
        'aprovacao': 'aprovacao',
        'finalizacao': 'finalizacao',
        'usuarios': 'usuarios'
    };
    
    let primeiraTela = 'historico';
    for (const [key, isAtivo] of Object.entries(usuario.permissoes)) {
        if (isAtivo && mapPermissoesTelas[key]) {
            primeiraTela = mapPermissoesTelas[key];
            break; 
        }
    }
    
    alternarTela(primeiraTela);
    atualizarFiltroSolicitantes();
    atualizarInterface();
}

function configurarPermissoesUsuario(usuario) {
    const mapTelasPermissoes = {
        'nova-solicitacao': 'novaSolicitacao',
        'historico': 'historico',
        'compras': 'compras',
        'aprovacao': 'aprovacao',
        'finalizacao': 'finalizacao',
        'usuarios': 'usuarios'
    };

    elementos.botoesNavegacao.forEach(botao => {
        const tela = botao.getAttribute('data-tela');
        const permissaoKey = mapTelasPermissoes[tela];
        
        if (permissaoKey && usuario.permissoes[permissaoKey]) {
            botao.style.display = 'flex';
        } else {
            botao.style.display = 'none';
        }
    });
}

function fazerLogout() {
    dadosAplicacao.usuárioAtual = null;
    salvarDadosLocalStorage();
    elementos.formLogin.reset();
    elementos.formSolicitacao.reset();
    elementos.itensLista.innerHTML = '';
    adicionarItem();
    elementos.telaLogin.style.display = 'flex';
    elementos.sistemaPrincipal.style.display = 'none';
    mostrarNotificacao('Logout realizado com sucesso', 'info');
}

function alternarTela(nomeTela) {
    if (!dadosAplicacao.usuárioAtual) return;
    
    const mapTelasPermissoes = {
        'nova-solicitacao': 'novaSolicitacao',
        'historico': 'historico',
        'compras': 'compras',
        'aprovacao': 'aprovacao',
        'finalizacao': 'finalizacao',
        'usuarios': 'usuarios'
    };
    
    const permissaoKey = mapTelasPermissoes[nomeTela];

    if (permissaoKey && !dadosAplicacao.usuárioAtual.permissoes[permissaoKey]) {
        mostrarNotificacao('Você não tem permissão para acessar esta tela', 'erro');
        return;
    }
    
    elementos.botoesNavegacao.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tela') === nomeTela) {
            btn.classList.add('active');
        }
    });

    elementos.telas.forEach(tela => {
        tela.classList.toggle('tela-ativa', tela.id === nomeTela);
    });
    
    if (nomeTela !== 'usuarios') {
        const steps = document.querySelectorAll('.status-step');
        steps.forEach(step => step.classList.remove('active'));
        if(nomeTela === 'nova-solicitacao') steps[0].classList.add('active');
        if(nomeTela === 'compras') steps[1].classList.add('active');
        if(nomeTela === 'aprovacao') steps[2].classList.add('active');
        if(nomeTela === 'finalizacao') steps[3].classList.add('active');
    }
    
    if (nomeTela === 'usuarios') { atualizarListaUsuarios(); } else { atualizarInterface(); }
}

let itemContador = 0;
function adicionarItem() {
    itemContador++;
    const idUnico = itemContador;
    
    const div = document.createElement('div');
    div.className = 'item-solicitacao';
    div.setAttribute('data-item-id', idUnico);
    div.innerHTML = `
        <div class="form-group">
            <label>Descrição do Item / Produto *</label>
            <input type="text" class="item-descricao" required placeholder="Ex: Monitor Dell 24 polegadas">
        </div>
        <div class="form-group">
            <label>Quantidade *</label>
            <input type="number" class="item-quantidade" min="1" required placeholder="1">
        </div>
        <div class="btn-remover-item" data-item-id="${idUnico}" title="Remover este item">
            <i class="fas fa-trash-alt"></i>
        </div>
        <div class="fotos-item-container">
            <input type="file" class="fotos-input" data-item-id="${idUnico}" multiple accept="image/*" style="display:none;">
            <button type="button" class="btn-secundario btn-sm btn-adicionar-fotos" data-item-id="${idUnico}">
                <i class="fas fa-camera"></i> Anexar Imagens
            </button>
            <div class="fotos-preview" data-item-id="${idUnico}"></div>
        </div>
    `;
    elementos.itensLista.appendChild(div);
}

function removerItem(id) {
    const itens = elementos.itensLista.querySelectorAll('.item-solicitacao');
    if (itens.length <= 1) {
        mostrarNotificacao('A solicitação deve conter pelo menos um item', 'aviso');
        return;
    }
    const item = elementos.itensLista.querySelector(`.item-solicitacao[data-item-id="${id}"]`);
    if (item) item.remove();
}

function adicionarFotosItem(itemId, arquivos) {
    const previewContainer = elementos.itensLista.querySelector(`.fotos-preview[data-item-id="${itemId}"]`);
    if (!previewContainer) return;
    
    Array.from(arquivos).forEach(arquivo => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const wrap = document.createElement('div');
            wrap.className = 'foto-item-wrapper';
            wrap.innerHTML = `<img src="${e.target.result}" data-name="${escapeHTML(arquivo.name)}">`;
            previewContainer.appendChild(wrap);
        };
        reader.readAsDataURL(arquivo);
    });
}

function enviarSolicitacao(event) {
    event.preventDefault();
    const setor = document.getElementById('setor').value;
    const justificativa = document.getElementById('justificativa').value.trim();
    const urgencia = document.getElementById('urgencia').value;
    
    const elementosItens = elementos.itensLista.querySelectorAll('.item-solicitacao');
    const itens = [];
    
    elementosItens.forEach(el => {
        const desc = el.querySelector('.item-descricao').value.trim();
        const qtd = parseInt(el.querySelector('.item-quantidade').value);
        const fotosSrc = Array.from(el.querySelectorAll('.fotos-preview img')).map(img => img.src);
        itens.push({ descricao: desc, quantidade: qtd, fotos: fotosSrc });
    });
    
    const novaSolicitacao = {
        id: dadosAplicacao.próximoId++,
        protocolo: dadosAplicacao.próximoProtocolo++,
        solicitante: dadosAplicacao.usuárioAtual.nome,
        setor,
        justificativa,
        urgencia,
        itens,
        status: 'solicitado',
        dataCriacao: new Date().toISOString(),
        orcamentos: [],
        historicoAcoes: [{ acao: 'Criação', usuario: dadosAplicacao.usuárioAtual.nome, data: new Date().toISOString() }]
    };
    
    dadosAplicacao.solicitações.push(novaSolicitacao);
    salvarDadosLocalStorage();
    mostrarNotificacao(`Solicitação criada com sucesso! Protocolo #${novaSolicitacao.protocolo}`, 'sucesso');
    
    elementos.formSolicitacao.reset();
    elementos.itensLista.innerHTML = '';
    adicionarItem();
    alternarTela('historico');
}

function atualizarInterface() {
    atualizarHistorico();
    atualizarModuloCotações();
    atualizarModuloAprovação();
    atualizarModuloFinalização();
}

function atualizarHistorico() {
    if (!elementos.solicitacoesLista) return;
    
    const fStatus = elementos.filtroStatus.value;
    const fSetor = elementos.filtroSetor.value;
    const fSolicitante = elementos.filtroSolicitante.value;
    
    elementos.solicitacoesLista.innerHTML = '';
    
    const filtrados = dadosAplicacao.solicitações.filter(s => {
        if (fStatus !== 'todos' && s.status !== fStatus) return false;
        if (fSetor !== 'todos' && s.setor !== fSetor) return false;
        if (fSolicitante !== 'todos' && s.solicitante !== fSolicitante) return false;
        return true;
    });
    
    if(filtrados.length === 0) {
        elementos.solicitacoesLista.innerHTML = '<p class="full-width text-center color-muted py-4">Nenhuma solicitação encontrada para os filtros aplicados.</p>';
        return;
    }
    
    filtrados.reverse().forEach(s => {
        const nomesProdutos = s.itens.map(i => escapeHTML(i.descricao)).join(', ');
        const card = document.createElement('div');
        card.className = 'solicitacao-card';
        card.innerHTML = `
            <div class="card-header-info">
                <span class="protocol-badge">#${s.protocolo}</span>
                <span class="status-badge ${s.status}">${s.status.toUpperCase()}</span>
            </div>
            <div class="card-body-details">
                <h4>Setor de ${escapeHTML(s.setor.toUpperCase())}</h4>
                <p class="meta-row"><strong>Solicitante:</strong> ${escapeHTML(s.solicitante)}</p>
                <p class="meta-row"><strong>Urgência:</strong> ${escapeHTML(s.urgencia.toUpperCase())}</p>
                <p class="meta-row">
                    <strong>Produto(s):</strong> <span class="destaque-produto">${nomesProdutos}</span>
                </p>
                <p class="meta-row" style="font-size: 0.75rem">(${s.itens.length} item/itens na lista)</p>
            </div>
            <div class="card-actions-wrapper">
                <button class="btn-secundario btn-sm btn-ver-detalhes" data-id="${s.id}"><i class="fas fa-eye"></i> Detalhes</button>
            </div>
        `;
        elementos.solicitacoesLista.appendChild(card);
    });
}

function atualizarModuloCotações() {
    if (!elementos.solicitacoesOrcamento) return;
    elementos.solicitacoesOrcamento.innerHTML = '';
    
    const pendentes = dadosAplicacao.solicitações.filter(s => s.status === 'solicitado' || s.status === 'cotacao');
    if (pendentes.length === 0) {
        elementos.solicitacoesOrcamento.innerHTML = '<p class="color-muted p-3 text-center">Nenhum processo aguardando cotação comercial.</p>';
        return;
    }
    
    pendentes.forEach(s => {
        const nomesProdutos = s.itens.map(i => escapeHTML(i.descricao)).join(', ');
        
        const div = document.createElement('div');
        div.className = 'card-mini-workflow';
        div.setAttribute('data-id', s.id);
        div.innerHTML = `
            <div class="flex justify-between font-mono font-bold color-muted mb-1" style="display:flex; justify-content:space-between">
                <span>#${s.protocolo}</span> <span>${s.orcamentos.length} Orc(s)</span>
            </div>
            <div class="destaque-produto-box" title="${nomesProdutos}">
                <i class="fas fa-box-open"></i> 
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">
                    ${nomesProdutos}
                </span>
            </div>
            <div style="font-weight: 500; font-size: 0.85rem; color: var(--text-muted)">
                ${escapeHTML(s.justificativa).substring(0,60)}...
            </div>
            <button class="btn-primario btn-sm btn-orcamento mt-2 w-100" style="margin-top: 12px" data-id="${s.id}">
                <i class="fas fa-file-invoice-dollar"></i> Lançar Proposta
            </button>
        `;
        elementos.solicitacoesOrcamento.appendChild(div);
    });
}

function prepararFormOrcamento(id) {
    document.getElementById('orcamento-solicitacao-id').value = id;
    document.querySelectorAll('.card-mini-workflow').forEach(c => c.classList.remove('selected'));
    const selecionado = elementos.solicitacoesOrcamento.querySelector(`.card-mini-workflow[data-id="${id}"]`);
    if(selecionado) selecionado.classList.add('selected');
    document.getElementById('fornecedor').focus();
}

function gerenciarAnexosOrcamento(e) {
    elementos.previewAnexos.innerHTML = '';
    Array.from(e.target.files).forEach(f => {
        const span = document.createElement('span');
        span.className = 'anexo-item-tag';
        span.innerHTML = `<i class="fas fa-paperclip"></i> ${escapeHTML(f.name)}`;
        elementos.previewAnexos.appendChild(span);
    });
}

function adicionarOrcamento(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('orcamento-solicitacao-id').value);
    if (!id) { mostrarNotificacao('Selecione uma solicitação pendente ao lado', 'aviso'); return; }
    
    const fornecedor = document.getElementById('fornecedor').value.trim();
    const valor = parseFloat(document.getElementById('valor-orcamento').value);
    const prazo = parseInt(document.getElementById('prazo-entrega').value);
    
    const solicitacao = dadosAplicacao.solicitações.find(s => s.id === id);
    if(solicitacao) {
        solicitacao.orcamentos.push({
            id: solicitacao.orcamentos.length + 1,
            fornecedor, valor, prazo,
            comprador: dadosAplicacao.usuárioAtual.nome,
            dataRegistro: new Date().toISOString()
        });
        
        // BUG CORRIGIDO AQUI: Fluxo ajustado para dar controle ao comprador
        const desejaAprovar = confirm("Orçamento salvo! Deseja enviar esta solicitação para a aprovação do Gestor agora? \n\n(Se deseja adicionar mais propostas, clique em Cancelar).");
        
        if (desejaAprovar) {
            solicitacao.status = 'aprovacao';
            solicitacao.historicoAcoes.push({ acao: 'Enviado para Aprovação', usuario: dadosAplicacao.usuárioAtual.nome, data: new Date().toISOString() });
        } else {
            solicitacao.status = 'cotacao';
            solicitacao.historicoAcoes.push({ acao: 'Orçamento Adicionado', usuario: dadosAplicacao.usuárioAtual.nome, data: new Date().toISOString() });
        }
        
        salvarDadosLocalStorage();
        mostrarNotificacao(`Proposta registrada com sucesso!`, 'sucesso');
        elementos.formAdicionarOrcamento.reset();
        elementos.previewAnexos.innerHTML = '';
        document.getElementById('orcamento-solicitacao-id').value = '';
        atualizarInterface();
    }
}

function atualizarModuloAprovação() {
    if (!elementos.solicitacoesAprovacao) return;
    elementos.solicitacoesAprovacao.innerHTML = '';
    
    const analises = dadosAplicacao.solicitações.filter(s => s.status === 'aprovacao');
    if(analises.length === 0) {
        elementos.solicitacoesAprovacao.innerHTML = '<p class="full-width text-center color-muted py-4">Nenhuma demanda aguardando avaliação da gestão.</p>';
        return;
    }
    
    analises.forEach(s => {
        const nomesProdutos = s.itens.map(i => escapeHTML(i.descricao)).join(', ');
        const card = document.createElement('div');
        card.className = 'solicitacao-card';
        card.innerHTML = `
            <div class="card-header-info">
                <span class="protocol-badge">#${s.protocolo}</span>
                <span class="status-badge aprovacao">ANÁLISE</span>
            </div>
            <div class="card-body-details">
                <h4><span class="destaque-produto">${nomesProdutos}</span></h4>
                <p class="meta-row"><strong>Justificativa:</strong> ${escapeHTML(s.justificativa).substring(0, 45)}...</p>
                <p class="meta-row"><strong>Solicitante:</strong> ${escapeHTML(s.solicitante)}</p>
                <p class="meta-row"><strong>Cotações:</strong> ${s.orcamentos.length} propostas prontas</p>
            </div>
            <div class="card-actions-wrapper">
                <button class="btn-primario btn-sm btn-aprovar" data-id="${s.id}"><i class="fas fa-gavel"></i> Avaliar</button>
            </div>
        `;
        elementos.solicitacoesAprovacao.appendChild(card);
    });
}

function prepararModalAprovacao(id) {
    const s = dadosAplicacao.solicitações.find(x => x.id === id);
    if(!s) return;
    
    document.getElementById('aprovacao-solicitacao-id').value = id;
    const corpo = document.getElementById('modal-aprovacao-corpo');
    
    let tabelaPropostas = s.orcamentos.map(o => `
        <div style="padding: 10px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <span><strong>${escapeHTML(o.fornecedor)}</strong> (Prazo: ${o.prazo} dias)</span>
            <span style="color: var(--primary); font-weight: 700; font-size: 1.1rem;">R$ ${o.valor.toFixed(2)}</span>
        </div>
    `).join('');
    
    corpo.innerHTML = `
        <div style="margin-bottom: 16px;">
            <p style="margin-bottom: 6px;"><strong>Justificativa original:</strong> ${escapeHTML(s.justificativa)}</p>
            <p style="font-size: 0.85rem; color: var(--text-muted)">Setor: ${escapeHTML(s.setor.toUpperCase())} | Urgência: ${escapeHTML(s.urgencia.toUpperCase())}</p>
        </div>
        <div style="margin-bottom: 8px;"><strong>Tabela Comparativa de Preços:</strong></div>
        <div style="background-color: var(--bg-darkest); border-radius: var(--radius-sm); margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.05)">
            ${tabelaPropostas || '<p style="padding: 12px; color: var(--text-muted)">Sem cotações registradas.</p>'}
        </div>
    `;
    
    document.getElementById('modal-aprovacao').style.display = 'flex';
}

document.getElementById('btn-rejeitar')?.addEventListener('click', function() {
    const id = parseInt(document.getElementById('aprovacao-solicitacao-id').value);
    const obs = document.getElementById('observacoes-aprovacao').value.trim();
    if(!obs) { mostrarNotificacao('Insira uma justificativa para a reprovação do pedido', 'aviso'); return; }
    
    const s = dadosAplicacao.solicitações.find(x => x.id === id);
    if(s) {
        s.status = 'rejeitado';
        s.historicoAcoes.push({ acao: 'Reprovação', usuario: dadosAplicacao.usuárioAtual.nome, data: new Date().toISOString(), obs });
        salvarDadosLocalStorage();
        mostrarNotificacao('A solicitação foi indeferida e arquivada.', 'info');
        document.getElementById('modal-aprovacao').style.display = 'none';
        document.getElementById('form-acao-aprovacao').reset();
        atualizarInterface();
    }
});

document.getElementById('btn-aprovar-confirmar')?.addEventListener('click', function() {
    const id = parseInt(document.getElementById('aprovacao-solicitacao-id').value);
    const obs = document.getElementById('observacoes-aprovacao').value.trim();
    
    const s = dadosAplicacao.solicitações.find(x => x.id === id);
    if(s) {
        s.status = 'compra';
        s.historicoAcoes.push({ acao: 'Aprovação', usuario: dadosAplicacao.usuárioAtual.nome, data: new Date().toISOString(), obs });
        salvarDadosLocalStorage();
        mostrarNotificacao('Solicitação aprovada com sucesso! Direcionada para fechamento.', 'sucesso');
        document.getElementById('modal-aprovacao').style.display = 'none';
        document.getElementById('form-acao-aprovacao').reset();
        atualizarInterface();
    }
});

function atualizarModuloFinalização() {
    if (!elementos.solicitacoesFinalizacao) return;
    elementos.solicitacoesFinalizacao.innerHTML = '';
    
    const compras = dadosAplicacao.solicitações.filter(s => s.status === 'compra');
    if (compras.length === 0) {
        elementos.solicitacoesFinalizacao.innerHTML = '<p class="full-width text-center color-muted py-4">Nenhum pedido aguardando emissão de ordem de compra.</p>';
        return;
    }
    
    compras.forEach(s => {
        const nomesProdutos = s.itens.map(i => escapeHTML(i.descricao)).join(', ');
        const card = document.createElement('div');
        card.className = 'solicitacao-card';
        card.innerHTML = `
            <div class="card-header-info">
                <span class="protocol-badge">#${s.protocolo}</span>
                <span class="status-badge compra">FATURAR</span>
            </div>
            <div class="card-body-details">
                <h4><span class="destaque-produto">${nomesProdutos}</span></h4>
                <p class="meta-row"><strong>Aprovado por:</strong> ${escapeHTML(s.historicoAcoes.find(a => a.acao === 'Aprovação')?.usuario || 'Gestor')}</p>
                <p class="meta-row"><strong>Itens:</strong> ${s.itens.length} itens inclusos</p>
            </div>
            <div class="card-actions-wrapper">
                <button class="btn-success btn-sm btn-finalizar" data-id="${s.id}"><i class="fas fa-shopping-bag"></i> Concluir</button>
            </div>
        `;
        elementos.solicitacoesFinalizacao.appendChild(card);
    });
}

function prepararModalFinalizacao(id) {
    const s = dadosAplicacao.solicitações.find(x => x.id === id);
    if (!s) return;
    
    document.getElementById('finalizacao-solicitacao-id').value = id;
    const select = document.getElementById('orcamento-vencedor');
    select.innerHTML = '<option value="">Escolha uma proposta...</option>';
    
    s.orcamentos.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = `${escapeHTML(o.fornecedor)} - R$ ${o.valor.toFixed(2)}`;
        select.appendChild(opt);
    });
    
    document.getElementById('modal-finalizacao-corpo').innerHTML = `
        <p style="font-size: 0.9rem"><strong>Protocolo:</strong> #${s.protocolo} | <strong>Justificativa:</strong> ${escapeHTML(s.justificativa)}</p>
    `;
    
    document.getElementById('orcamento-vencedor').onchange = function() {
        const oId = parseInt(this.value);
        const oMatch = s.orcamentos.find(x => x.id === oId);
        if(oMatch) document.getElementById('valor-final').value = oMatch.valor;
    };
    
    document.getElementById('form-acao-finalizacao').onsubmit = function(e) {
        e.preventDefault();
        const vId = parseInt(document.getElementById('orcamento-vencedor').value);
        const finalVal = parseFloat(document.getElementById('valor-final').value);
        
        if(!vId) { mostrarNotificacao('Selecione a proposta comercial vencedora', 'erro'); return; }
        
        s.status = 'concluido';
        s.orcamentoVencedor = s.orcamentos.find(x => x.id === vId);
        s.valorFinalHomologado = finalVal;
        s.historicoAcoes.push({ acao: 'Fechamento', usuario: dadosAplicacao.usuárioAtual.nome, data: new Date().toISOString() });
        
        salvarDadosLocalStorage();
        mostrarNotificacao(`Processo de compras finalizado com sucesso!`, 'sucesso');
        document.getElementById('modal-finalizacao').style.display = 'none';
        atualizarInterface();
    };
    
    document.getElementById('modal-finalizacao').style.display = 'flex';
}

function mostrarDetalhesSolicitacao(id) {
    const s = dadosAplicacao.solicitações.find(x => x.id === id);
    if (!s) return;
    
    const corpo = document.getElementById('modal-detalhes-corpo');
    let listaItensHtml = s.itens.map(i => `
        <div style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem;">
            <div><strong class="destaque-produto" style="font-size:1rem">${escapeHTML(i.descricao)}</strong> - Qtd: ${i.quantidade}</div>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
                ${(i.fotos || []).map(f => `<img src="${escapeHTML(f)}" style="width:54px;height:54px;object-fit:cover;border-radius:6px; border: 1px solid var(--border-color)">`).join('')}
            </div>
        </div>
    `).join('');
    
    let listHistHtml = s.historicoAcoes.map(h => `
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px;">• <strong style="color:var(--text-main)">${h.data.substring(0,10)} ${h.data.substring(11,16)}</strong>: ${escapeHTML(h.acao)} por ${escapeHTML(h.usuario)} ${h.obs ? `(<em>${escapeHTML(h.obs)}</em>)` : ''}</p>
    `).join('');
    
    corpo.innerHTML = `
        <div style="margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <p><strong>Protocolo:</strong> #${s.protocolo} | <strong>Status:</strong> <span class="status-badge ${s.status}">${s.status.toUpperCase()}</span></p>
            <p><strong>Setor:</strong> ${escapeHTML(s.setor.toUpperCase())} | <strong>Urgência:</strong> ${escapeHTML(s.urgencia.toUpperCase())}</p>
            <p style="margin-top: 8px;"><strong>Justificativa:</strong> ${escapeHTML(s.justificativa)}</p>
        </div>
        <div style="margin-bottom: 20px;">
            <h5 style="margin-bottom: 8px; font-weight: 600;">Produtos Requisitados:</h5>
            <div style="background-color: var(--bg-darkest); border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.05)">
                ${listaItensHtml}
            </div>
        </div>
        <div>
            <h5 style="margin-bottom: 8px; font-weight: 600;">Histórico de Movimentações:</h5>
            <div style="background-color: rgba(0,0,0,0.2); border-radius: var(--radius-sm); padding: 12px; border: 1px solid rgba(255,255,255,0.02)">
                ${listHistHtml}
            </div>
        </div>
    `;
    document.getElementById('modal-detalhes').style.display = 'flex';
}

function atualizarFiltroSolicitantes() {
    if (!elementos.filtroSolicitante) return;
    const lista = Array.from(new Set(dadosAplicacao.solicitações.map(s => s.solicitante)));
    elementos.filtroSolicitante.innerHTML = '<option value="todos">Todos os Solicitantes</option>';
    lista.forEach(nome => {
        const opt = document.createElement('option');
        opt.value = escapeHTML(nome);
        opt.textContent = escapeHTML(nome);
        elementos.filtroSolicitante.appendChild(opt);
    });
}

function atualizarListaUsuarios() {
    if (!elementos.usuariosGrid) return;
    elementos.usuariosGrid.innerHTML = '';
    
    dadosAplicacao.usuarios.forEach(u => {
        const div = document.createElement('div');
        div.className = 'usuario-card-item';
        div.innerHTML = `
            <div class="user-meta-box">
                <h5>${escapeHTML(u.nome)}</h5>
                <p>Login: ${escapeHTML(u.login)} | Perfil: ${escapeHTML(u.perfil.toUpperCase())}</p>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn-secundario btn-sm btn-editar-usuario" data-id="${u.id}"><i class="fas fa-edit"></i></button>
                <button class="btn-danger btn-sm btn-excluir-usuario" data-id="${u.id}" ${u.id===1?'disabled':''}><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        elementos.usuariosGrid.appendChild(div);
    });
}

function salvarUsuario(e) {
    e.preventDefault();
    const id = elementos.usuarioIdInput.value;
    const nome = elementos.usuarioNomeInput.value.trim();
    const login = elementos.usuarioLoginInput.value.trim();
    const senha = elementos.usuarioSenhaInput.value;
    const perfil = elementos.usuarioPerfilSelect.value;
    
    if (senha.length < 6) { mostrarNotificacao('A senha deve possuir pelo menos 6 dígitos.', 'erro'); return; }
    
    const permissoes = {
        novaSolicitacao: document.getElementById('permissao-nova').checked,
        historico: true,
        compras: document.getElementById('permissao-compras').checked,
        aprovacao: document.getElementById('permissao-aprovacao').checked,
        finalizacao: document.getElementById('permissao-finalizacao').checked,
        usuarios: document.getElementById('permissao-usuarios').checked
    };
    
    if (id) {
        const idx = dadosAplicacao.usuarios.findIndex(u => u.id === parseInt(id));
        if (idx !== -1) {
            dadosAplicacao.usuarios[idx] = { ...dadosAplicacao.usuarios[idx], nome, login, senha, perfil, permissoes };
            mostrarNotificacao('Colaborador atualizado com sucesso.', 'sucesso');
        }
    } else {
        if(dadosAplicacao.usuarios.some(u => u.login === login)) { mostrarNotificacao('Este apelido/login já está em uso.', 'erro'); return; }
        dadosAplicacao.usuarios.push({
            id: Date.now(), nome, login, senha, perfil, permissoes, dataCadastro: new Date().toISOString()
        });
        mostrarNotificacao('Colaborador registrado com sucesso.', 'sucesso');
    }
    salvarDadosLocalStorage();
    limparFormularioUsuario();
    atualizarListaUsuarios();
}

function editarUsuario(id) {
    const u = dadosAplicacao.usuarios.find(x => x.id === id);
    if(!u) return;
    
    elementos.usuarioIdInput.value = u.id;
    elementos.usuarioNomeInput.value = u.nome;
    elementos.usuarioLoginInput.value = u.login;
    elementos.usuarioSenhaInput.value = u.senha;
    elementos.usuarioPerfilSelect.value = u.perfil;
    
    document.getElementById('permissao-nova').checked = u.permissoes.novaSolicitacao;
    document.getElementById('permissao-compras').checked = u.permissoes.compras;
    document.getElementById('permissao-aprovacao').checked = u.permissoes.aprovacao;
    document.getElementById('permissao-finalizacao').checked = u.permissoes.finalizacao;
    document.getElementById('permissao-usuarios').checked = u.permissoes.usuarios;
}

function excluirUsuario(id) {
    if(id === 1) { mostrarNotificacao('O administrador nativo do sistema não pode ser removido.', 'erro'); return; }
    if(confirm('Deseja realmente revogar e excluir permanentemente este usuário?')) {
        dadosAplicacao.usuarios = dadosAplicacao.usuarios.filter(u => u.id !== id);
        salvarDadosLocalStorage();
        mostrarNotificacao('Usuário deletado do banco.', 'info');
        atualizarListaUsuarios();
    }
}

function atualizarPermissoesPorPerfil(p) {
    if (!p) return;
    document.getElementById('permissao-nova').checked = (p === 'solicitante' || p === 'administrador');
    document.getElementById('permissao-compras').checked = (p === 'comprador' || p === 'administrador');
    document.getElementById('permissao-aprovacao').checked = (p === 'gestor' || p === 'administrador');
    document.getElementById('permissao-finalizacao').checked = (p === 'comprador' || p === 'administrador');
    document.getElementById('permissao-usuarios').checked = (p === 'administrador');
}

function limparFormularioUsuario() {
    elementos.formCadastrarUsuario.reset();
    elementos.usuarioIdInput.value = '';
}

function mostrarModalConfig() {
    if (!dadosAplicacao.usuárioAtual) return;
    const u = dadosAplicacao.usuárioAtual;
    
    document.getElementById('config-usuario').textContent = escapeHTML(u.nome);
    document.getElementById('config-perfil').textContent = escapeHTML(u.perfil.toUpperCase());
    document.getElementById('config-ultimo-acesso').textContent = new Date().toLocaleString('pt-BR');
    
    const pBox = document.getElementById('config-permissoes');
    pBox.innerHTML = `
        <div class="permissao-config"><i class="fas ${u.permissoes.novaSolicitacao?'fa-check-circle':'fa-times-circle'}"></i> Nova Solicitação</div>
        <div class="permissao-config"><i class="fas fa-check-circle"></i> Histórico</div>
        <div class="permissao-config"><i class="fas ${u.permissoes.compras?'fa-check-circle':'fa-times-circle'}"></i> Compras</div>
        <div class="permissao-config"><i class="fas ${u.permissoes.aprovacao?'fa-check-circle':'fa-times-circle'}"></i> Aprovação</div>
        <div class="permissao-config"><i class="fas ${u.permissoes.finalizacao?'fa-check-circle':'fa-times-circle'}"></i> Finalização</div>
        <div class="permissao-config"><i class="fas ${u.permissoes.usuarios?'fa-check-circle':'fa-times-circle'}"></i> Usuários</div>
    `;
    elementos.modalConfig.style.display = 'flex';
}

function alterarSenha(e) {
    e.preventDefault();
    const atual = document.getElementById('senha-atual').value;
    const nova = document.getElementById('nova-senha').value;
    const conf = document.getElementById('confirmar-senha').value;
    
    if(atual !== dadosAplicacao.usuárioAtual.senha) { mostrarNotificacao('Senha atual informada incorreta.', 'erro'); return; }
    if(nova.length < 6) { mostrarNotificacao('A nova senha deve ter pelo menos 6 caracteres.', 'erro'); return; }
    if(nova !== conf) { mostrarNotificacao('A confirmação de senha não coincide.', 'erro'); return; }
    
    const idx = dadosAplicacao.usuarios.findIndex(u => u.id === dadosAplicacao.usuárioAtual.id);
    if(idx !== -1) {
        dadosAplicacao.usuarios[idx].senha = nova;
        dadosAplicacao.usuárioAtual.senha = nova;
        salvarDadosLocalStorage();
        mostrarNotificacao('Sua senha de acesso foi modificada!', 'sucesso');
        elementos.modalConfig.style.display = 'none';
        elementos.formAlterarSenha.reset();
    }
}

function mostrarNotificacao(mensagem, tipo = 'info') {
    const n = document.createElement('div');
    n.className = `notificacao ${tipo}`;
    const icone = { 'sucesso': 'fa-check-circle', 'erro': 'fa-exclamation-circle', 'aviso': 'fa-exclamation-triangle', 'info': 'fa-info-circle' }[tipo] || 'fa-info-circle';
    
    n.innerHTML = `<i class="fas ${icone}"></i><span>${escapeHTML(mensagem)}</span>`;
    elementos.notificacoes.appendChild(n);
    setTimeout(() => { n.remove(); }, 4000);
}