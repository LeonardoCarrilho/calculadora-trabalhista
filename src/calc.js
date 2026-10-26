/**
 * Regras de cálculo trabalhista usadas pelo simulador.
 *
 * Todos os valores monetários são tratados em centavos (inteiros) para evitar
 * erros de arredondamento de ponto flutuante. As funções públicas recebem e
 * devolvem valores em reais.
 *
 * IMPORTANTE: as tabelas abaixo são uma referência de 2025 (INSS e IRRF).
 * Elas ficam isoladas neste arquivo justamente para serem atualizadas quando a
 * Receita Federal / Ministério da Previdência publicarem novos valores.
 */

export const TABELA_REFERENCIA = {
  ano: 2025,
  atualizadoEm: "2025-01-01",
  fonte: "Portaria Interministerial MPS/MF e tabela mensal de IRRF",
};

/** Faixas progressivas do INSS (valores em centavos). */
export const INSS_FAIXAS = [
  { ate: 151800, aliquota: 0.075 },
  { ate: 279388, aliquota: 0.09 },
  { ate: 419083, aliquota: 0.12 },
  { ate: 815741, aliquota: 0.14 },
];

/** Faixas mensais do IRRF (valores em centavos). */
export const IRRF_FAIXAS = [
  { ate: 225920, aliquota: 0, deducao: 0 },
  { ate: 282665, aliquota: 0.075, deducao: 16944 },
  { ate: 375105, aliquota: 0.15, deducao: 38144 },
  { ate: 466468, aliquota: 0.225, deducao: 66277 },
  { ate: Infinity, aliquota: 0.275, deducao: 89600 },
];

/** Dedução mensal por dependente (IRRF). */
export const DEDUCAO_DEPENDENTE = 18959;

/** Desconto simplificado mensal do IRRF. */
export const DESCONTO_SIMPLIFICADO = 56480;

export const ALIQUOTA_FGTS = 0.08;
export const ALIQUOTA_VALE_TRANSPORTE = 0.06;
export const DIAS_FERIAS = 30;
export const MAX_DIAS_ABONO = 10;

const centavos = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
};
const reais = (valorEmCentavos) => Math.round(valorEmCentavos) / 100;
const limitar = (valor, minimo, maximo) =>
  Math.min(Math.max(Number(valor) || 0, minimo), maximo);

/**
 * Calcula o INSS progressivo, faixa por faixa.
 * @param {number} salarioBruto salário de contribuição em reais
 * @returns {{valor:number, aliquotaEfetiva:number, teto:boolean, detalhe:Array}}
 */
export function calcularINSS(salarioBruto) {
  const bruto = Math.max(0, centavos(salarioBruto));
  let limiteAnterior = 0;
  let total = 0;
  const detalhe = [];

  for (const faixa of INSS_FAIXAS) {
    if (bruto <= limiteAnterior) break;

    const base = Math.min(bruto, faixa.ate) - limiteAnterior;
    const contribuicao = Math.round(base * faixa.aliquota);

    total += contribuicao;
    detalhe.push({
      faixaAte: reais(faixa.ate),
      aliquota: faixa.aliquota,
      base: reais(base),
      contribuicao: reais(contribuicao),
    });

    limiteAnterior = faixa.ate;
  }

  return {
    valor: reais(total),
    aliquotaEfetiva: bruto === 0 ? 0 : total / bruto,
    teto: bruto > INSS_FAIXAS.at(-1).ate,
    detalhe,
  };
}

/** Aplica a tabela mensal do IRRF sobre uma base já deduzida. */
function aplicarTabelaIRRF(baseEmCentavos) {
  const faixa = IRRF_FAIXAS.find((item) => baseEmCentavos <= item.ate);

  if (!faixa || baseEmCentavos <= 0) {
    return { base: 0, imposto: 0, aliquota: 0, deducao: 0 };
  }

  const imposto = Math.max(
    0,
    Math.round(baseEmCentavos * faixa.aliquota - faixa.deducao)
  );

  return {
    base: reais(baseEmCentavos),
    imposto: reais(imposto),
    aliquota: faixa.aliquota,
    deducao: reais(faixa.deducao),
  };
}

/**
 * Calcula o IRRF mensal comparando o desconto legal com o simplificado.
 *
 * @param {object} params
 * @param {number} params.salarioBruto
 * @param {number} params.inss valor do INSS já calculado
 * @param {number} [params.dependentes]
 * @param {number} [params.pensao] pensão alimentícia descontada na base
 * @param {boolean|"auto"} [params.usarDescontoSimplificado] "auto" escolhe o mais vantajoso
 */
export function calcularIRRF({
  salarioBruto,
  inss = 0,
  dependentes = 0,
  pensao = 0,
  usarDescontoSimplificado = "auto",
}) {
  const bruto = Math.max(0, centavos(salarioBruto));
  const deducoesLegais =
    centavos(inss) +
    limitar(dependentes, 0, 20) * DEDUCAO_DEPENDENTE +
    Math.max(0, centavos(pensao));

  const baseLegal = Math.max(0, bruto - deducoesLegais);
  const baseSimplificada = Math.max(0, bruto - DESCONTO_SIMPLIFICADO);

  // O contribuinte pode optar pelo simplificado quando ele reduz a base.
  const usarSimplificado =
    usarDescontoSimplificado === true ||
    (usarDescontoSimplificado === "auto" && baseSimplificada < baseLegal);

  const base = usarSimplificado ? baseSimplificada : baseLegal;
  const resultado = aplicarTabelaIRRF(base);

  return {
    ...resultado,
    regime: usarSimplificado ? "simplificado" : "legal",
    baseLegal: reais(baseLegal),
    baseSimplificada: reais(baseSimplificada),
    deducaoDependentes: reais(limitar(dependentes, 0, 20) * DEDUCAO_DEPENDENTE),
  };
}

/**
 * Simula a folha mensal completa: descontos, FGTS e custo do empregador.
 * @param {object} params
 * @param {number} params.salarioBruto
 * @param {number} [params.dependentes]
 * @param {boolean} [params.valeTransporte]
 * @param {number} [params.pensaoPercentual] percentual do bruto (0 a 100)
 * @param {number} [params.outrosDescontos]
 */
export function calcularFolha({
  salarioBruto,
  dependentes = 0,
  valeTransporte = false,
  pensaoPercentual = 0,
  outrosDescontos = 0,
}) {
  const bruto = Math.max(0, centavos(salarioBruto));
  const inss = calcularINSS(bruto / 100);
  const pensao = Math.round(
    bruto * (limitar(pensaoPercentual, 0, 100) / 100)
  );
  const vt = valeTransporte
    ? Math.round(bruto * ALIQUOTA_VALE_TRANSPORTE)
    : 0;
  const irrf = calcularIRRF({
    salarioBruto: bruto / 100,
    inss: inss.valor,
    dependentes,
    pensao: pensao / 100,
  });
  const outros = Math.max(0, centavos(outrosDescontos));

  const totalDescontos =
    centavos(inss.valor) + centavos(irrf.imposto) + pensao + vt + outros;
  const liquido = Math.max(0, bruto - totalDescontos);

  const fgts = Math.round(bruto * ALIQUOTA_FGTS);
  const provisaoDecimoTerceiro = Math.round(bruto / 12);
  const provisaoFerias = Math.round((bruto / 12) * (4 / 3));
  const fgtsProvisoes = Math.round(
    (provisaoDecimoTerceiro + provisaoFerias) * ALIQUOTA_FGTS
  );
  const custoEmpregador =
    bruto + fgts + provisaoDecimoTerceiro + provisaoFerias + fgtsProvisoes;

  return {
    bruto: reais(bruto),
    inss: inss.valor,
    aliquotaINSS: inss.aliquotaEfetiva,
    irrf: irrf.imposto,
    aliquotaIRRF: irrf.aliquota,
    baseIRRF: irrf.base,
    regimeIRRF: irrf.regime,
    dependentes: limitar(dependentes, 0, 20),
    pensao: reais(pensao),
    valeTransporte: reais(vt),
    outrosDescontos: reais(outros),
    totalDescontos: reais(totalDescontos),
    liquido: reais(liquido),
    fgts: reais(fgts),
    provisaoDecimoTerceiro: reais(provisaoDecimoTerceiro),
    provisaoFerias: reais(provisaoFerias),
    custoEmpregador: reais(custoEmpregador),
    percentualDesconto: bruto === 0 ? 0 : totalDescontos / bruto,
    detalheINSS: inss.detalhe,
    irrfDetalhe: {
      baseLegal: irrf.baseLegal,
      baseSimplificada: irrf.baseSimplificada,
      deducaoDependentes: irrf.deducaoDependentes,
    },
  };
}

/**
 * Calcula o 13º salário proporcional, com INSS e IRRF exclusivos.
 * @param {object} params
 * @param {number} params.salarioBruto
 * @param {number} [params.mesesTrabalhados] de 1 a 12
 * @param {number} [params.dependentes]
 */
export function calcularDecimoTerceiro({
  salarioBruto,
  mesesTrabalhados = 12,
  dependentes = 0,
}) {
  const bruto = Math.max(0, centavos(salarioBruto));
  const meses = Math.round(limitar(mesesTrabalhados, 0, 12));
  const valor = Math.round((bruto * meses) / 12);

  const inss = calcularINSS(valor / 100);
  // O desconto simplificado não se aplica ao 13º: usa-se a dedução legal.
  const irrf = calcularIRRF({
    salarioBruto: valor / 100,
    inss: inss.valor,
    dependentes,
    usarDescontoSimplificado: false,
  });

  return {
    meses,
    bruto: reais(valor),
    inss: inss.valor,
    irrf: irrf.imposto,
    liquido: reais(Math.max(0, valor - centavos(inss.valor) - centavos(irrf.imposto))),
    fgts: reais(Math.round(valor * ALIQUOTA_FGTS)),
  };
}

/**
 * Calcula férias com o terço constitucional e, opcionalmente, o abono
 * pecuniário (venda de até 10 dias), que é isento de INSS e IRRF.
 * @param {object} params
 * @param {number} params.salarioBruto
 * @param {number} [params.diasGozados] dias efetivamente descansados (20 a 30)
 * @param {number} [params.diasAbono] dias vendidos (0 a 10)
 * @param {number} [params.dependentes]
 */
export function calcularFerias({
  salarioBruto,
  diasGozados,
  diasAbono = 0,
  dependentes = 0,
}) {
  const bruto = Math.max(0, centavos(salarioBruto));
  const abonoDias = Math.round(limitar(diasAbono, 0, MAX_DIAS_ABONO));
  // Quem vende dias não pode gozar 30: o padrão passa a ser o saldo restante.
  const maximoGozados = DIAS_FERIAS - abonoDias;
  const gozados = Math.round(
    limitar(
      diasGozados ?? maximoGozados,
      DIAS_FERIAS - MAX_DIAS_ABONO,
      maximoGozados
    )
  );

  const valorDias = Math.round((bruto * gozados) / DIAS_FERIAS);
  const terco = Math.round(valorDias / 3);
  const tributavel = valorDias + terco;

  const abonoValor = Math.round((bruto * abonoDias) / DIAS_FERIAS);
  const abonoTerco = Math.round(abonoValor / 3);

  const inss = calcularINSS(tributavel / 100);
  const irrf = calcularIRRF({
    salarioBruto: tributavel / 100,
    inss: inss.valor,
    dependentes,
    usarDescontoSimplificado: false,
  });

  const liquido =
    tributavel -
    centavos(inss.valor) -
    centavos(irrf.imposto) +
    abonoValor +
    abonoTerco;

  return {
    diasGozados: gozados,
    diasAbono: abonoDias,
    valorDias: reais(valorDias),
    tercoConstitucional: reais(terco),
    tributavel: reais(tributavel),
    abono: reais(abonoValor),
    tercoAbono: reais(abonoTerco),
    inss: inss.valor,
    irrf: irrf.imposto,
    liquido: reais(Math.max(0, liquido)),
    totalBruto: reais(tributavel + abonoValor + abonoTerco),
  };
}

/** Formata um número em reais no padrão pt-BR. */
export function formatarBRL(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor) || 0);
}

/** Formata uma alíquota (0.075) como percentual pt-BR (7,5%). */
export function formatarPercentual(valor, casas = 2) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number(valor) || 0);
}
