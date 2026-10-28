import "./observability.js";
import {
  TABELA_REFERENCIA,
  calcularDecimoTerceiro,
  calcularFerias,
  calcularFolha,
  formatarBRL,
  formatarPercentual,
} from "./calc.js";

const CHAVE_HISTORICO = "calculadora-trabalhista:historico:v1";
const LIMITE_HISTORICO = 5;

const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/** Converte "3.500,00" (ou "3500") em centavos inteiros. */
function paraCentavos(texto) {
  const digitos = String(texto ?? "").replace(/\D/g, "");
  return digitos ? Number.parseInt(digitos, 10) : 0;
}

/** Formata centavos como "3.500,00" (sem o símbolo da moeda). */
function formatarNumero(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function lerNumero(input, { max = Infinity } = {}) {
  const valor = Number.parseFloat(String(input.value).replace(",", "."));
  if (!Number.isFinite(valor) || valor < 0) return 0;
  return Math.min(valor, max);
}

/* Máscara de moeda ------------------------------------------------------ */

function aplicarMascaraMoeda(input) {
  const formatar = () => {
    input.value = formatarNumero(paraCentavos(input.value));
  };

  input.addEventListener("input", formatar);
  input.addEventListener("blur", formatar);
  input.addEventListener("focus", () => input.select());
  formatar();
}

/* Histórico ------------------------------------------------------------- */

function carregarHistorico() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_HISTORICO) ?? "[]");
    return Array.isArray(dados) ? dados.filter((item) => item && item.bruto >= 0) : [];
  } catch {
    return [];
  }
}

function salvarHistorico(itens) {
  try {
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(itens));
  } catch {
    // Modo privado ou armazenamento cheio: o simulador continua funcionando.
  }
}

function registrarSimulacao(resultado) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    em: new Date().toISOString(),
    bruto: resultado.bruto,
    liquido: resultado.liquido,
    descontos: resultado.totalDescontos,
    dependentes: resultado.dependentes,
    valeTransporte: resultado.valeTransporte > 0,
    pensaoPercentual: Number.parseFloat($("#pensao").value.replace(",", ".")) || 0,
    outrosDescontos: resultado.outrosDescontos,
  };

  const historico = [item, ...carregarHistorico()].slice(0, LIMITE_HISTORICO);
  salvarHistorico(historico);
  renderizarHistorico(historico);
}

function renderizarHistorico(historico = carregarHistorico()) {
  const lista = $("#historico");
  const vazio = $("#historico-vazio");
  lista.replaceChildren();

  vazio.hidden = historico.length > 0;

  for (const item of historico) {
    const li = document.createElement("li");
    li.dataset.id = item.id;

    const tempo = document.createElement("time");
    tempo.dateTime = item.em;
    tempo.textContent = formatarDataHora(item.em);

    const valores = document.createElement("span");
    valores.className = "values";
    valores.innerHTML = `
      <span>Bruto <strong>${formatarBRL(item.bruto)}</strong></span>
      <span>Líquido <strong>${formatarBRL(item.liquido)}</strong></span>
    `;

    const usar = document.createElement("button");
    usar.type = "button";
    usar.className = "btn btn-small btn-ghost";
    usar.textContent = "Reutilizar";
    usar.setAttribute(
      "aria-label",
      `Reutilizar simulação de ${formatarBRL(item.bruto)} de ${formatarDataHora(item.em)}`
    );
    usar.addEventListener("click", () => {
      $("#salario").value = formatarNumero(Math.round(item.bruto * 100));
      $("#dependentes").value = item.dependentes;
      $("#pensao").value = item.pensaoPercentual;
      $("#vt").checked = item.valeTransporte;
      $("#outros").value = formatarNumero(Math.round(item.outrosDescontos * 100));
      calcularERenderizar({ salvar: false });
      $("#salario").focus();
    });

    li.append(tempo, valores, usar);
    lista.append(li);
  }
}

/* Renderização da folha mensal ------------------------------------------ */

function atualizarLinha(idLinha, idValor, valor) {
  $(idLinha).hidden = valor <= 0;
  $(idValor).textContent = formatarBRL(valor);
}

function renderizarFolha(resultado) {
  $("#res-liquido").textContent = formatarBRL(resultado.liquido);
  $("#res-bruto").textContent = formatarBRL(resultado.bruto);
  $("#res-inss").textContent = `- ${formatarBRL(resultado.inss)}`;
  $("#res-irrf").textContent = `- ${formatarBRL(resultado.irrf)}`;
  $("#res-descontos").textContent = `- ${formatarBRL(resultado.totalDescontos)}`;
  $("#res-fgts").textContent = formatarBRL(resultado.fgts);
  $("#res-custo").textContent = formatarBRL(resultado.custoEmpregador);
  $("#res-percentual").textContent = `${formatarPercentual(resultado.percentualDesconto, 1)} de desconto`;

  $("#res-inss-aliquota").textContent = resultado.bruto
    ? `(${formatarPercentual(resultado.aliquotaINSS, 2)})`
    : "";
  $("#res-irrf-aliquota").textContent = resultado.bruto
    ? `(${formatarPercentual(resultado.aliquotaIRRF, 2)})`
    : "";

  $("#res-regime").textContent = resultado.bruto
    ? resultado.regimeIRRF === "simplificado"
      ? "IRRF pelo desconto simplificado"
      : "IRRF com deduções legais"
    : "Informe o salário para calcular";

  atualizarLinha("#linha-pensao", "#res-pensao", resultado.pensao);
  atualizarLinha("#linha-vt", "#res-vt", resultado.valeTransporte);
  atualizarLinha("#linha-outros", "#res-outros", resultado.outrosDescontos);

  $("#aviso-teto").hidden = !(resultado.bruto > 8157.41);

  const corpo = $("#memoria-inss");
  corpo.replaceChildren();

  if (!resultado.detalheINSS.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "empty";
    td.textContent = "Informe um salário para ver o detalhe.";
    tr.append(td);
    corpo.append(tr);
  } else {
    for (const faixa of resultado.detalheINSS) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatarBRL(faixa.faixaAte)}</td>
        <td>${formatarPercentual(faixa.aliquota, 1)}</td>
        <td>${formatarBRL(faixa.base)}</td>
        <td>${formatarBRL(faixa.contribuicao)}</td>
      `;
      corpo.append(tr);
    }
  }

  $("#memoria-base-legal").textContent = formatarBRL(resultado.irrfDetalhe.baseLegal);
  $("#memoria-base-simplificada").textContent = formatarBRL(
    resultado.irrfDetalhe.baseSimplificada
  );
  $("#memoria-dependentes").textContent = formatarBRL(
    resultado.irrfDetalhe.deducaoDependentes
  );
}

function calcularERenderizar({ salvar = false } = {}) {
  const resultado = calcularFolha({
    salarioBruto: paraCentavos($("#salario").value) / 100,
    dependentes: Math.round(lerNumero($("#dependentes"), { max: 20 })),
    valeTransporte: $("#vt").checked,
    pensaoPercentual: lerNumero($("#pensao"), { max: 100 }),
    outrosDescontos: paraCentavos($("#outros").value) / 100,
  });

  renderizarFolha(resultado);

  if (salvar && resultado.bruto > 0) {
    registrarSimulacao(resultado);
    const anuncio = $("#anuncio");
    anuncio.textContent = `Salário líquido de ${formatarBRL(resultado.liquido)} com ${formatarPercentual(resultado.percentualDesconto, 1)} de descontos.`;
  }

  return resultado;
}

/* Extras: 13º e férias -------------------------------------------------- */

function renderizarDecimoTerceiro() {
  const resultado = calcularDecimoTerceiro({
    salarioBruto: paraCentavos($("#salario-13").value) / 100,
    mesesTrabalhados: Math.round(lerNumero($("#meses-13"), { max: 12 })),
    dependentes: Math.round(lerNumero($("#dependentes"), { max: 20 })),
  });

  $("#res-13-bruto").textContent = formatarBRL(resultado.bruto);
  $("#res-13-inss").textContent = `- ${formatarBRL(resultado.inss)}`;
  $("#res-13-irrf").textContent = `- ${formatarBRL(resultado.irrf)}`;
  $("#res-13-liquido").textContent = formatarBRL(resultado.liquido);
  $("#res-13-fgts").textContent = formatarBRL(resultado.fgts);
}

function renderizarFerias() {
  const resultado = calcularFerias({
    salarioBruto: paraCentavos($("#salario-ferias").value) / 100,
    diasAbono: Math.round(lerNumero($("#dias-abono"), { max: 10 })),
    dependentes: Math.round(lerNumero($("#dependentes"), { max: 20 })),
  });

  $("#res-ferias-base").textContent = formatarBRL(resultado.tributavel);
  $("#res-ferias-abono").textContent = formatarBRL(
    resultado.abono + resultado.tercoAbono
  );
  $("#res-ferias-descontos").textContent = `- ${formatarBRL(
    resultado.inss + resultado.irrf
  )}`;
  $("#res-ferias-liquido").textContent = formatarBRL(resultado.liquido);
}

/* Ações ----------------------------------------------------------------- */

function resumoEmTexto(resultado) {
  return [
    `Simulação — ${new Date().toLocaleDateString("pt-BR")}`,
    `Salário bruto: ${formatarBRL(resultado.bruto)}`,
    `INSS: ${formatarBRL(resultado.inss)}`,
    `IRRF: ${formatarBRL(resultado.irrf)}`,
    resultado.pensao ? `Pensão: ${formatarBRL(resultado.pensao)}` : null,
    resultado.valeTransporte
      ? `Vale-transporte: ${formatarBRL(resultado.valeTransporte)}`
      : null,
    `Total de descontos: ${formatarBRL(resultado.totalDescontos)}`,
    `Salário líquido: ${formatarBRL(resultado.liquido)}`,
    `FGTS do mês: ${formatarBRL(resultado.fgts)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function copiarResumo() {
  const resultado = calcularERenderizar();
  const texto = resumoEmTexto(resultado);
  const botao = $("#btn-copiar");

  try {
    await navigator.clipboard.writeText(texto);
    botao.textContent = "Copiado!";
    $("#anuncio").textContent = "Resumo copiado para a área de transferência.";
  } catch {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copiou = document.execCommand?.("copy");
    area.remove();
    botao.textContent = copiou ? "Copiado!" : "Não foi possível copiar";
  }

  window.setTimeout(() => {
    botao.textContent = "Copiar resumo";
  }, 2200);
}

/* Inicialização --------------------------------------------------------- */

function iniciar() {
  $$(".money-input input, .inline-money input").forEach(aplicarMascaraMoeda);

  $("#form-folha").addEventListener("submit", (evento) => {
    evento.preventDefault();
    calcularERenderizar({ salvar: true });
  });

  ["#salario", "#dependentes", "#pensao", "#vt", "#outros"].forEach((seletor) => {
    $(seletor).addEventListener("input", () => {
      calcularERenderizar();
      renderizarDecimoTerceiro();
      renderizarFerias();
    });
  });

  ["#salario-13", "#meses-13"].forEach((seletor) => {
    $(seletor).addEventListener("input", renderizarDecimoTerceiro);
  });

  ["#salario-ferias", "#dias-abono"].forEach((seletor) => {
    $(seletor).addEventListener("input", renderizarFerias);
  });

  $("#btn-limpar").addEventListener("click", () => {
    $("#form-folha").reset();
    $("#salario").value = "3.500,00";
    $("#outros").value = "0,00";
    $("#dependentes").value = "0";
    $("#pensao").value = "0";
    $("#vt").checked = false;
    calcularERenderizar();
    $("#salario").focus();
  });

  $("#btn-copiar").addEventListener("click", copiarResumo);
  $("#btn-imprimir").addEventListener("click", () => window.print());

  $("#btn-limpar-historico").addEventListener("click", () => {
    salvarHistorico([]);
    renderizarHistorico([]);
    $("#anuncio").textContent = "Histórico limpo.";
  });

  $$("[data-ano-tabela]").forEach((elemento) => {
    elemento.textContent = elemento.textContent.replace("2025", TABELA_REFERENCIA.ano);
  });

  renderizarHistorico();
  calcularERenderizar();
  renderizarDecimoTerceiro();
  renderizarFerias();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
}
