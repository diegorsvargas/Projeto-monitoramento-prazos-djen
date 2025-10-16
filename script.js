// --- 1. CONFIGURAÇÃO E INICIALIZAÇÃO ---
const SUPABASE_URL = 'https://yeqaooskuqkjmudrcoak.supabase.co'; // PREENCHA AQUI
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcWFvb3NrdXFram11ZHJjb2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDg1NzIsImV4cCI6MjA3NjAyNDU3Mn0.awiI3kenxasorQaaj7Ccfsx6H6mq8MziCbqlzgDjH4g'; // PREENCHA AQUI

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. SELETORES DE ELEMENTOS DO HTML ---
const abasLink = document.querySelectorAll('.aba-link');
const abasConteudo = document.querySelectorAll('.aba-conteudo');
const listaPendentesDiv = document.getElementById('lista-pendentes');
const btnMarcarSalvar = document.getElementById('btn-marcar-salvar');
const mapaPlaceholder = document.getElementById('mapa-placeholder');
const tribunaisContainer = document.getElementById('tribunais-container');
const inputUf = document.getElementById('pesquisa-uf');
const inputTribunalSelecionado = document.getElementById('pesquisa-tribunal-selecionado');
const btnPesquisarApi = document.getElementById('btn-pesquisar-api');
const resultadosPesquisaApiDiv = document.getElementById('resultados-pesquisa-api');
const btnPesquisarArquivo = document.getElementById('btn-pesquisar-arquivo');
const resultadosArquivoDiv = document.getElementById('resultados-arquivo');
const arquivoTermoBuscaInput = document.getElementById('arquivo-termo-busca');
const arquivoDataInicioInput = document.getElementById('arquivo-data-inicio');
const arquivoDataFimInput = document.getElementById('arquivo-data-fim');

// --- 3. VARIÁVEIS GLOBAIS ---
let intimacoesPendentesAtuais = [];
let dadosTribunais = null;

// --- 4. LÓGICA DO SISTEMA DE ABAS ---
function ativarAba(abaId) {
    abasConteudo.forEach(conteudo => conteudo.classList.remove('active'));
    abasLink.forEach(link => link.classList.remove('active'));
    document.getElementById(abaId).classList.add('active');
    document.querySelector(`.aba-link[data-aba="${abaId}"]`).classList.add('active');
}

// --- 5. FUNÇÕES DA DASHBOARD DE PENDENTES ---
function renderizarPendentes(intimacoes) {
    listaPendentesDiv.innerHTML = '';
    intimacoesPendentesAtuais = intimacoes;
    if (intimacoes.length === 0) {
        listaPendentesDiv.innerHTML = '<p>Nenhuma nova intimação pendente de análise.</p>';
        return;
    }
    intimacoes.forEach(intimacao => {
        const elemento = document.createElement('div');
        elemento.className = 'intimacao-pendente';
        elemento.innerHTML = `
            <input type="checkbox" class="checkbox-intimacao" data-id="${intimacao.id}">
            <div class="intimacao-pendente-dados">
                <h3>Processo: ${intimacao.numero_processo || 'Não informado'}</h3>
                <p><strong>Data de Disponibilização:</strong> ${new Date(intimacao.data_disponibilizacao + 'T03:00:00Z').toLocaleDateString('pt-BR')}</p>
                <p><strong>Tribunal:</strong> ${intimacao.sigla_tribunal || 'Não informado'} | <strong>Órgão Emissor:</strong> ${intimacao.orgao_emissor || 'Não informado'}</p>
                <pre>${intimacao.texto_puro || 'Sem conteúdo.'}</pre>
            </div>
        `;
        listaPendentesDiv.appendChild(elemento);
    });
}
async function carregarPendentes() {
    listaPendentesDiv.innerHTML = '<p>Carregando intimações pendentes...</p>';
    const { data, error } = await supabaseClient.from('Intimações').select('*').eq('foi_analisada', false).order('data_disponibilizacao', { ascending: true });
    if (error) {
        console.error('Erro ao carregar intimações pendentes:', error);
        listaPendentesDiv.innerHTML = '<p>Erro ao carregar os dados. Verifique o console (F12).</p>';
        return;
    }
    renderizarPendentes(data);
}
async function arquivarSelecionadas() {
    const checkboxes = document.querySelectorAll('.checkbox-intimacao:checked');
    if (checkboxes.length === 0) {
        alert('Por favor, selecione pelo menos uma intimação para arquivar.');
        return;
    }
    const idsParaSalvar = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
    const intimacoesParaSalvar = intimacoesPendentesAtuais.filter(intimacao => idsParaSalvar.includes(intimacao.id));
    if (!confirm(`Você tem certeza que deseja arquivar ${intimacoesParaSalvar.length} intimação(ões)?`)) {
        return;
    }
    const { data, error } = await supabaseClient.functions.invoke('salvar-intimacoes', { body: intimacoesParaSalvar });
    if (error) {
        alert('Ocorreu um erro ao arquivar as intimações: ' + error.message);
        return;
    }
    alert(data.message);
    carregarPendentes();
}

// --- 6. FUNÇÕES DO MAPA E PESQUISA MANUAL ---
async function carregarMapa() {
    try {
        const response = await fetch('mapa-brasil.svg');
        if (!response.ok) throw new Error('Arquivo do mapa não encontrado.');
        const svgText = await response.text();
        mapaPlaceholder.innerHTML = svgText;
        inicializarEventosDoMapa();
    } catch (error) {
        console.error('Erro ao carregar o mapa:', error);
        mapaPlaceholder.innerHTML = '<p style="color:red;">Erro ao carregar o mapa.</p>';
    }
}
function inicializarEventosDoMapa() {
    const mapa = document.getElementById('mapa-brasil');
    if (mapa) {
        mapa.addEventListener('click', (evento) => {
            const estadoClicado = evento.target;
            if (estadoClicado.tagName === 'path') {
                mapa.querySelectorAll('path').forEach(p => p.classList.remove('estado-selecionado'));
                estadoClicado.classList.add('estado-selecionado');
                const uf = estadoClicado.id;
                inputUf.value = uf;
                renderizarCartasTribunais(uf);
            }
        });
    }
}
function renderizarCartasTribunais(uf) {
    tribunaisContainer.innerHTML = '';
    inputTribunalSelecionado.value = '';
    const dadosDoEstado = dadosTribunais.find(item => item.uf === uf);
    const instituicoes = dadosDoEstado ? dadosDoEstado.instituicoes : [];
    if (instituicoes.length === 0) {
        tribunaisContainer.innerHTML = '<p>Nenhum tribunal encontrado para esta seleção.</p>';
        return;
    }
    instituicoes.forEach(inst => {
        const carta = document.createElement('div');
        carta.className = 'carta-tribunal';
        carta.dataset.sigla = inst.sigla;
        carta.innerHTML = `
            <h4>${inst.sigla}</h4>
            <p>${inst.nome}</p>
            <p><strong>Última publicação:</strong> ${inst.dataUltimoEnvio}</p>
        `;
        carta.addEventListener('click', () => {
            document.querySelectorAll('.carta-tribunal').forEach(c => c.classList.remove('selecionado'));
            carta.classList.add('selecionado');
            inputTribunalSelecionado.value = inst.sigla;
        });
        tribunaisContainer.appendChild(carta);
    });
}
async function carregarDadosParaMapa() {
    try {
        const response = await fetch('https://comunicaapi.pje.jus.br/api/v1/comunicacao/tribunal');
        if (!response.ok) throw new Error('Não foi possível carregar os dados dos tribunais.');
        dadosTribunais = await response.json();
        renderizarCartasTribunais('');
    } catch (error) {
        console.error("Erro ao carregar dados para o mapa:", error);
        tribunaisContainer.innerHTML = '<p>Não foi possível carregar a lista de tribunais.</p>';
    }
}
async function pesquisarNaApi() {
    const payload = {
        oab: document.getElementById('pesquisa-oab').value,
        uf: inputUf.value,
        dataInicio: document.getElementById('pesquisa-data-inicio').value,
        dataFim: document.getElementById('pesquisa-data-fim').value,
        tribunal: inputTribunalSelecionado.value,
    };
    if (!payload.oab || !payload.uf || !payload.dataInicio || !payload.dataFim) {
        alert('Os campos OAB, UF, Data Início e Fim são obrigatórios.');
        return;
    }
    resultadosPesquisaApiDiv.innerHTML = '<p>Pesquisando, por favor aguarde...</p>';
    const { data, error } = await supabaseClient.functions.invoke('busca-manual-djen', {
        body: payload,
    });
    if (error) {
        alert('Ocorreu um erro na busca: ' + error.message);
        resultadosPesquisaApiDiv.innerHTML = `<p style="color:red;">Erro: ${error.message}</p>`;
        return;
    }
    renderizarResultadosPesquisaManual(data);
}

function renderizarResultadosPesquisaManual(resultados) {
    resultadosPesquisaApiDiv.innerHTML = '';
    if (resultados.length === 0) {
        resultadosPesquisaApiDiv.innerHTML = '<p>Nenhuma intimação encontrada com os critérios informados.</p>';
        return;
    }
    
    const cabecalhoResultados = document.createElement('div');
    cabecalhoResultados.className = 'cabecalho-secao';
    cabecalhoResultados.innerHTML = `
        <h3>Resultados da Pesquisa</h3>
        <button id="btn-salvar-pesquisa-manual" class="btn-salvar-manual" style="background-color: var(--cor-sucesso); color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; font-size: 1em; font-weight: 600;"><i class="fas fa-save"></i> Salvar Selecionadas no Arquivo</button>
    `;
    resultadosPesquisaApiDiv.appendChild(cabecalhoResultados);
    
    const listaResultados = document.createElement('div');
    resultadosPesquisaApiDiv.appendChild(listaResultados);

    resultados.forEach(intimacao => {
        const elemento = document.createElement('div');
        elemento.className = 'intimacao-pendente';
        if (intimacao.jaSalva) {
            elemento.style.borderLeftColor = '#f39c12';
        }
        elemento.innerHTML = `
            <input type="checkbox" class="checkbox-intimacao-manual" data-intimacao='${JSON.stringify(intimacao)}' ${intimacao.jaSalva ? 'disabled' : ''}>
            <div class="intimacao-pendente-dados">
                <h3>Processo: ${intimacao.numero_processo || 'Não informado'} ${intimacao.jaSalva ? '<span style="font-size: 0.8em; color: #f39c12; font-weight: bold;">(JÁ ARQUIVADA)</span>' : ''}</h3>
                <p><strong>Data de Disponibilização:</strong> ${new Date(intimacao.data_disponibilizacao + 'T03:00:00Z').toLocaleDateString('pt-BR')}</p>
                <p><strong>Tribunal:</strong> ${intimacao.siglaTribunal || 'Não informado'} | <strong>Órgão Emissor:</strong> ${intimacao.nomeOrgao || 'Não informado'}</p>
                <pre>${intimacao.texto_puro || 'Sem conteúdo.'}</pre> 
            </div>
        `;
        listaResultados.appendChild(elemento);
    });

    document.getElementById('btn-salvar-pesquisa-manual').addEventListener('click', salvarPesquisaManual);
}

async function salvarPesquisaManual() {
    const checkboxes = document.querySelectorAll('.checkbox-intimacao-manual:checked');
    if (checkboxes.length === 0) {
        alert('Por favor, selecione pelo menos uma intimação para salvar.');
        return;
    }

    const intimacoesParaSalvar = Array.from(checkboxes).map(cb => JSON.parse(cb.dataset.intimacao));

    if (!confirm(`Você tem certeza que deseja salvar ${intimacoesParaSalvar.length} intimação(ões) no seu arquivo?`)) {
        return;
    }

    const { data, error } = await supabaseClient.functions.invoke('salvar-intimacoes', {
        body: intimacoesParaSalvar,
    });

    if (error) {
        alert('Ocorreu um erro ao salvar as intimações: ' + error.message);
        return;
    }

    alert(data.message);
    pesquisarNaApi();
}

// --- ADICIONE ESTAS DUAS NOVAS FUNÇÕES ---

/**
 * Renderiza os resultados da busca no arquivo.
 * @param {Array} intimacoes - A lista de intimações salvas.
 */
function renderizarResultadosArquivo(intimacoes) {
    resultadosArquivoDiv.innerHTML = '';

    if (!intimacoes || intimacoes.length === 0) {
        resultadosArquivoDiv.innerHTML = '<p>Nenhum resultado encontrado no seu arquivo com os critérios informados.</p>';
        return;
    }

    intimacoes.forEach(intimacao => {
        const elemento = document.createElement('div');
        // Reutilizamos o mesmo estilo, mas com uma cor de borda diferente (verde)
        elemento.className = 'intimacao-pendente';
        elemento.style.borderLeftColor = 'var(--cor-sucesso)';

        elemento.innerHTML = `
            <div class="intimacao-pendente-dados" style="width:100%;">
                <h3>Processo: ${intimacao.numero_processo || 'Não informado'}</h3>
                <p><strong>Data de Disponibilização:</strong> ${new Date(intimacao.data_disponibilizacao + 'T03:00:00Z').toLocaleDateString('pt-BR')}</p>
                <p><strong>Tribunal:</strong> ${intimacao.sigla_tribunal || 'Não informado'} | <strong>Órgão Emissor:</strong> ${intimacao.orgao_emissor || 'Não informado'}</p>
                <pre>${intimacao.texto_puro || 'Sem conteúdo.'}</pre>
            </div>
        `;
        resultadosArquivoDiv.appendChild(elemento);
    });
}

/**
 * Executa a busca na tabela de intimações salvas (no arquivo).
 */
async function pesquisarNoArquivo() {
    resultadosArquivoDiv.innerHTML = '<p>Buscando no seu arquivo...</p>';

    let query = supabaseClient
        .from('Intimações')
        .select('*')
        .eq('foi_analisada', true); // AQUI ESTÁ A LÓGICA: busca apenas as JÁ ANALISADAS

    // Filtros opcionais
    const termoBusca = arquivoTermoBuscaInput.value;
    if (termoBusca) {
        // O 'or' permite buscar o termo em várias colunas
        query = query.or(`numero_processo.ilike.%${termoBusca}%,orgao_emissor.ilike.%${termoBusca}%,texto_puro.ilike.%${termoBusca}%`);
    }
    const dataInicio = arquivoDataInicioInput.value;
    if (dataInicio) {
        query = query.gte('data_disponibilizacao', dataInicio);
    }
    const dataFim = arquivoDataFimInput.value;
    if (dataFim) {
        query = query.lte('data_disponibilizacao', dataFim);
    }

    // Ordena pela data mais recente
    query = query.order('data_disponibilizacao', { ascending: false });

    const { data, error } = await query;

    if (error) {
        console.error('Erro ao pesquisar no arquivo:', error);
        resultadosArquivoDiv.innerHTML = '<p style="color:red;">Ocorreu um erro ao realizar a busca.</p>';
        return;
    }

    renderizarResultadosArquivo(data);
}

// --- 7. INICIALIZAÇÃO E EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    abasLink.forEach(link => {
        link.addEventListener('click', () => ativarAba(link.dataset.aba));
    });
    carregarPendentes();
    carregarDadosParaMapa();
    carregarMapa();
    btnMarcarSalvar.addEventListener('click', arquivarSelecionadas);
    btnPesquisarApi.addEventListener('click', pesquisarNaApi);
    btnPesquisarArquivo.addEventListener('click', pesquisarNoArquivo); // Linha adicionada
});