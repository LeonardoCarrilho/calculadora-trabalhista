import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calcularDecimoTerceiro,
  calcularFerias,
  calcularFolha,
  calcularINSS,
  calcularIRRF,
  formatarBRL,
  formatarPercentual,
} from "../src/calc.js";

const perto = (atual, esperado, tolerancia = 0.011) =>
  assert.ok(
    Math.abs(atual - esperado) <= tolerancia,
    `esperado ${esperado}, recebido ${atual}`
  );

describe("calcularINSS", () => {
  it("aplica 7,5% sobre a primeira faixa", () => {
    const resultado = calcularINSS(1000);
    perto(resultado.valor, 75);
    assert.equal(resultado.detalhe.length, 1);
  });

  it("soma as faixas de forma progressiva", () => {
    const resultado = calcularINSS(3500);
    perto(resultado.valor, 313.41);
    assert.equal(resultado.detalhe.length, 3);
    perto(resultado.aliquotaEfetiva, 0.0895, 0.0005);
    assert.equal(resultado.teto, false);
  });

  it("respeita o teto do INSS", () => {
    const resultado = calcularINSS(10000);
    perto(resultado.valor, 951.63);
    assert.equal(resultado.teto, true);
    perto(calcularINSS(25000).valor, 951.63);
  });

  it("não cobra INSS de salário zero ou negativo", () => {
    assert.equal(calcularINSS(0).valor, 0);
    assert.equal(calcularINSS(-500).valor, 0);
    assert.equal(calcularINSS("texto").valor, 0);
  });
});

describe("calcularIRRF", () => {
  it("isenta salários abaixo da primeira faixa", () => {
    const resultado = calcularIRRF({ salarioBruto: 2000, inss: 157.23 });
    assert.equal(resultado.imposto, 0);
  });

  it("aplica 7,5% na segunda faixa com a dedução correta", () => {
    const resultado = calcularIRRF({
      salarioBruto: 2800,
      inss: 229.23,
      usarDescontoSimplificado: false,
    });
    perto(resultado.imposto, 23.37);
    assert.equal(resultado.regime, "legal");
  });

  it("escolhe automaticamente a base mais vantajosa", () => {
    const comSimplificado = calcularIRRF({ salarioBruto: 3500, inss: 313.41 });
    assert.equal(comSimplificado.regime, "simplificado");

    const comDependentes = calcularIRRF({
      salarioBruto: 3500,
      inss: 313.41,
      dependentes: 3,
    });
    assert.equal(comDependentes.regime, "legal");
    assert.ok(comDependentes.base < comSimplificado.base);
  });

  it("deduz dependentes e pensão da base legal", () => {
    const resultado = calcularIRRF({
      salarioBruto: 5000,
      inss: 501.51,
      dependentes: 2,
      pensao: 500,
      usarDescontoSimplificado: false,
    });

    perto(resultado.baseLegal, 5000 - 501.51 - 2 * 189.59 - 500);
    perto(resultado.deducaoDependentes, 379.18);
  });

  it("nunca retorna imposto negativo", () => {
    const resultado = calcularIRRF({
      salarioBruto: 2300,
      inss: 190,
      usarDescontoSimplificado: "auto",
    });
    assert.ok(resultado.imposto >= 0);
  });
});

describe("calcularFolha", () => {
  it("calcula o líquido de um salário de R$ 3.500", () => {
    const resultado = calcularFolha({ salarioBruto: 3500 });

    perto(resultado.bruto, 3500);
    perto(resultado.inss, 313.41);
    perto(resultado.irrf, 58.84);
    perto(resultado.totalDescontos, 372.25);
    perto(resultado.liquido, 3127.75);
    perto(resultado.fgts, 280);
    perto(resultado.percentualDesconto, 0.1064, 0.0005);
  });

  it("desconta vale-transporte limitado a 6%", () => {
    const resultado = calcularFolha({ salarioBruto: 2000, valeTransporte: true });
    perto(resultado.valeTransporte, 120);
    perto(resultado.liquido, 1722.77);
  });

  it("desconta pensão e recalcula o IRRF", () => {
    const resultado = calcularFolha({
      salarioBruto: 3500,
      pensaoPercentual: 10,
    });

    perto(resultado.pensao, 350);
    perto(resultado.irrf, 44.05);
    perto(resultado.liquido, 2792.54);
  });

  it("inclui outros descontos sem deixar o líquido negativo", () => {
    const resultado = calcularFolha({
      salarioBruto: 1500,
      outrosDescontos: 5000,
    });

    assert.equal(resultado.liquido, 0);
    assert.ok(resultado.totalDescontos > resultado.bruto);
  });

  it("estima o custo do empregador com FGTS e provisões", () => {
    const resultado = calcularFolha({ salarioBruto: 3500 });

    perto(resultado.provisaoDecimoTerceiro, 291.67);
    perto(resultado.provisaoFerias, 388.89);
    perto(resultado.custoEmpregador, 3500 + 280 + 291.67 + 388.89 + 54.44);
  });

  it("trata entradas ausentes ou inválidas", () => {
    const resultado = calcularFolha({});
    assert.equal(resultado.bruto, 0);
    assert.equal(resultado.liquido, 0);
    assert.equal(resultado.inss, 0);
  });
});

describe("calcularDecimoTerceiro", () => {
  it("calcula 13º integral com INSS e IRRF exclusivos", () => {
    const resultado = calcularDecimoTerceiro({ salarioBruto: 3500 });

    perto(resultado.bruto, 3500);
    perto(resultado.inss, 313.41);
    perto(resultado.irrf, 96.55);
    perto(resultado.liquido, 3090.04);
    perto(resultado.fgts, 280);
  });

  it("calcula 13º proporcional por meses trabalhados", () => {
    const resultado = calcularDecimoTerceiro({
      salarioBruto: 3500,
      mesesTrabalhados: 6,
    });

    perto(resultado.bruto, 1750);
    perto(resultado.inss, 134.73);
    assert.equal(resultado.irrf, 0);
    perto(resultado.liquido, 1615.27);
  });

  it("limita os meses entre 1 e 12", () => {
    assert.equal(calcularDecimoTerceiro({ salarioBruto: 3000, mesesTrabalhados: 30 }).meses, 12);
    assert.equal(calcularDecimoTerceiro({ salarioBruto: 3000, mesesTrabalhados: 0 }).meses, 0);
  });
});

describe("calcularFerias", () => {
  it("calcula 30 dias com terço constitucional", () => {
    const resultado = calcularFerias({ salarioBruto: 3500 });

    perto(resultado.valorDias, 3500);
    perto(resultado.tercoConstitucional, 1166.67);
    perto(resultado.tributavel, 4666.67);
    perto(resultado.inss, 462.93);
    perto(resultado.irrf, 283.07);
    perto(resultado.liquido, 3920.67);
    assert.equal(resultado.abono, 0);
  });

  it("isenta o abono de 10 dias de INSS e IRRF", () => {
    const resultado = calcularFerias({ salarioBruto: 3500, diasAbono: 10 });

    assert.equal(resultado.diasGozados, 20);
    perto(resultado.abono, 1166.67);
    perto(resultado.tercoAbono, 388.89);
    perto(resultado.liquido, 4354.71);
  });

  it("limita o abono a 10 dias", () => {
    const resultado = calcularFerias({ salarioBruto: 3000, diasAbono: 25 });
    assert.equal(resultado.diasAbono, 10);
    assert.equal(resultado.diasGozados, 20);
  });
});

describe("formatadores", () => {
  it("formata valores em reais no padrão brasileiro", () => {
    assert.match(formatarBRL(3127.75), /3\.127,75/);
    assert.match(formatarBRL(0), /0,00/);
  });

  it("formata percentuais", () => {
    assert.match(formatarPercentual(0.075, 1), /7,5%/);
  });
});
