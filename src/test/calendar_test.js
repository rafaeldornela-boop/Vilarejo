"use strict";

const assert = require("node:assert/strict");
const Dashboard = require("../ui/dashboard.js");
const VilarejoCore = require("../core/vilarejo_core.js");

const {
  isLeapYear,
  getDaysInGregorianMonth,
  civilDateToSimulationDay,
  simulationDayToCivilDate,
  MONTH_NAMES,
  WEEKDAY_NAMES,
  WEEKDAY_ABBR,
  navigateCalendarMonth,
  returnCalendarToToday,
  getCalendarViewState
} = Dashboard;

let passed = 0;
const failures = [];

function test(name, callback) {
  try {
    callback();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`  ✗ ${name}: ${error.stack || error}`);
  }
}

console.log("\n=== TESTES DE CALENDÁRIO CIVIL E ECONÔMICO ===");

// 1. Dia 1
test("Dia 1 da simulação: 1º de Janeiro de 2026, Quinta-feira, Ano Econômico 1, Mês 1, Dia 1", () => {
  const info = simulationDayToCivilDate(1);
  assert.equal(info.simDay, 1);
  assert.equal(info.civilYear, 2026);
  assert.equal(info.civilMonth, 1);
  assert.equal(info.civilDay, 1);
  assert.equal(info.weekdayName, "Quinta-feira");
  assert.equal(info.weekdayAbbr, "QUI");
  assert.equal(info.monthName, "Janeiro");
  assert.equal(info.daysInMonth, 31);
  assert.equal(info.economicYear, 1);
  assert.equal(info.economicMonth, 1);
  assert.equal(info.economicDay, 1);
  assert.equal(info.isCloseDay, false);
  assert.equal(info.isHarvest, false);
  assert.equal(civilDateToSimulationDay(2026, 1, 1), 1);
});

// 2. Dia 149 (Referência canônica de início do jogo)
test("Dia 149 da simulação (calibração base): 29 de Maio de 2026, Sexta-feira, Mês Econômico 5, Dia 29", () => {
  const info = simulationDayToCivilDate(149);
  assert.equal(info.simDay, 149);
  assert.equal(info.civilYear, 2026);
  assert.equal(info.civilMonth, 5);
  assert.equal(info.civilDay, 29);
  assert.equal(info.weekdayName, "Sexta-feira");
  assert.equal(info.weekdayAbbr, "SEX");
  assert.equal(info.monthName, "Maio");
  assert.equal(info.daysInMonth, 31);
  assert.equal(info.economicYear, 1);
  assert.equal(info.economicMonth, 5);
  assert.equal(info.economicDay, 29);
  assert.equal(info.isCloseDay, false);
  assert.equal(info.isHarvest, false);
  assert.equal(info.daysToClose, 1);
  assert.equal(civilDateToSimulationDay(2026, 5, 29), 149);
});

// 3. Dia 150 (Fechamento mensal e início da safra)
test("Dia 150 da simulação: 30 de Maio de 2026, Sábado, Mês Econômico 5, Dia 30 (Fechamento e Safra)", () => {
  const info = simulationDayToCivilDate(150);
  assert.equal(info.simDay, 150);
  assert.equal(info.civilYear, 2026);
  assert.equal(info.civilMonth, 5);
  assert.equal(info.civilDay, 30);
  assert.equal(info.weekdayName, "Sábado");
  assert.equal(info.economicYear, 1);
  assert.equal(info.economicMonth, 5);
  assert.equal(info.economicDay, 30);
  assert.equal(info.isCloseDay, true, "Dia 150 deve ser dia de fechamento mensal econômico");
  assert.equal(info.isHarvest, true, "Dia 150 deve ser início do período de safra");
  assert.equal(info.daysToClose, 0);
  assert.equal(civilDateToSimulationDay(2026, 5, 30), 150);
});

// 4. Dia 360 (Fechamento do primeiro ano econômico)
test("Dia 360 da simulação: 26 de Dezembro de 2026, Sábado, Ano Econômico 1, Mês 12, Dia 30 (Fechamento)", () => {
  const info = simulationDayToCivilDate(360);
  assert.equal(info.simDay, 360);
  assert.equal(info.civilYear, 2026);
  assert.equal(info.civilMonth, 12);
  assert.equal(info.civilDay, 26);
  assert.equal(info.weekdayName, "Sábado");
  assert.equal(info.economicYear, 1);
  assert.equal(info.economicMonth, 12);
  assert.equal(info.economicDay, 30);
  assert.equal(info.isCloseDay, true, "Dia 360 fecha o ano econômico");
  assert.equal(info.isHarvest, false);
  assert.equal(civilDateToSimulationDay(2026, 12, 26), 360);
});

// 5. Dia 361 (Início do segundo ano econômico)
test("Dia 361 da simulação: 27 de Dezembro de 2026, Domingo, Ano Econômico 2, Mês 1, Dia 1", () => {
  const info = simulationDayToCivilDate(361);
  assert.equal(info.simDay, 361);
  assert.equal(info.civilYear, 2026);
  assert.equal(info.civilMonth, 12);
  assert.equal(info.civilDay, 27);
  assert.equal(info.weekdayName, "Domingo");
  assert.equal(info.economicYear, 2);
  assert.equal(info.economicMonth, 1);
  assert.equal(info.economicDay, 1);
  assert.equal(info.isCloseDay, false);
  assert.equal(civilDateToSimulationDay(2026, 12, 27), 361);
});

// 6. Viradas de mês civil
test("Virada de mês civil de Janeiro (31 dias) para Fevereiro de 2026", () => {
  const jan31 = simulationDayToCivilDate(31);
  assert.equal(jan31.civilYear, 2026);
  assert.equal(jan31.civilMonth, 1);
  assert.equal(jan31.civilDay, 31);
  assert.equal(jan31.weekdayName, "Sábado");

  const feb1 = simulationDayToCivilDate(32);
  assert.equal(feb1.civilYear, 2026);
  assert.equal(feb1.civilMonth, 2);
  assert.equal(feb1.civilDay, 1);
  assert.equal(feb1.weekdayName, "Domingo");
});

test("Virada de mês civil de Maio (31 dias) para Junho de 2026", () => {
  const may31 = simulationDayToCivilDate(151);
  assert.equal(may31.civilYear, 2026);
  assert.equal(may31.civilMonth, 5);
  assert.equal(may31.civilDay, 31);
  assert.equal(may31.weekdayName, "Domingo");

  const jun1 = simulationDayToCivilDate(152);
  assert.equal(jun1.civilYear, 2026);
  assert.equal(jun1.civilMonth, 6);
  assert.equal(jun1.civilDay, 1);
  assert.equal(jun1.weekdayName, "Segunda-feira");
});

// 7. Virada de ano civil (2026 para 2027)
test("Virada de ano civil: 31 de Dezembro de 2026 (Dia 365) para 1º de Janeiro de 2027 (Dia 366)", () => {
  const dec31 = simulationDayToCivilDate(365);
  assert.equal(dec31.civilYear, 2026);
  assert.equal(dec31.civilMonth, 12);
  assert.equal(dec31.civilDay, 31);
  assert.equal(dec31.weekdayName, "Quinta-feira");

  const jan1_2027 = simulationDayToCivilDate(366);
  assert.equal(jan1_2027.civilYear, 2027);
  assert.equal(jan1_2027.civilMonth, 1);
  assert.equal(jan1_2027.civilDay, 1);
  assert.equal(jan1_2027.weekdayName, "Sexta-feira");
  assert.equal(civilDateToSimulationDay(2027, 1, 1), 366);
});

// 8. Anos bissextos e Fevereiro de 2028
test("Detecção e tratamento de ano bissexto (2028)", () => {
  assert.equal(isLeapYear(2026), false);
  assert.equal(isLeapYear(2027), false);
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(1900), false, "1900 não foi bissexto");
  assert.equal(isLeapYear(2000), true, "2000 foi bissexto");

  assert.equal(getDaysInGregorianMonth(2026, 2), 28);
  assert.equal(getDaysInGregorianMonth(2028, 2), 29);

  // 2026 (365) + 2027 (365) = 730 dias
  // Jan 2028 = 31 dias -> 730 + 31 = 761
  // Feb 2028 = 29 dias -> 761 + 29 = 790 (29 de Fevereiro de 2028)
  const feb29 = simulationDayToCivilDate(790);
  assert.equal(feb29.civilYear, 2028);
  assert.equal(feb29.civilMonth, 2);
  assert.equal(feb29.civilDay, 29);
  assert.equal(feb29.isLeapYear, true);
  assert.equal(feb29.weekdayName, "Terça-feira");
  assert.equal(civilDateToSimulationDay(2028, 2, 29), 790);

  const mar1 = simulationDayToCivilDate(791);
  assert.equal(mar1.civilYear, 2028);
  assert.equal(mar1.civilMonth, 3);
  assert.equal(mar1.civilDay, 1);
  assert.equal(mar1.weekdayName, "Quarta-feira");
  assert.equal(civilDateToSimulationDay(2028, 3, 1), 791);
});

// 9. Reversibilidade e consistência determinística para 1000 dias
test("Reversibilidade determinística bidirecional em 1000 dias", () => {
  for (let d = 1; d <= 1000; d += 1) {
    const c = simulationDayToCivilDate(d);
    const rev = civilDateToSimulationDay(c.civilYear, c.civilMonth, c.civilDay);
    assert.equal(rev, d, `Dia ${d} falhou na reversibilidade: gerou ${c.civilYear}-${c.civilMonth}-${c.civilDay} que reverteu para ${rev}`);
  }
});

// 10. Fechamentos econômicos ocorrem exatamente a cada 30 dias
test("Fechamentos econômicos ocorrem estritamente a cada 30 dias de simulação", () => {
  for (let d = 1; d <= 720; d += 1) {
    const info = simulationDayToCivilDate(d);
    if (d % 30 === 0) {
      assert.equal(info.isCloseDay, true, `Dia ${d} deveria ser dia de fechamento`);
      assert.equal(info.economicDay, 30);
    } else {
      assert.equal(info.isCloseDay, false, `Dia ${d} não deveria ser fechamento`);
      assert.notEqual(info.economicDay, 30);
    }
  }
});

// 11. Período de safra cobre dias 150 a 209 de cada ano de 360 dias
test("Período de safra cobre rigorosamente os dias 150 a 209 do ciclo econômico", () => {
  for (let d = 1; d <= 720; d += 1) {
    const info = simulationDayToCivilDate(d);
    const dayInYear = ((d - 1) % 360) + 1;
    const shouldBeHarvest = dayInYear >= 150 && dayInYear <= 209;
    assert.equal(info.isHarvest, shouldBeHarvest, `Dia ${d} (dia ${dayInYear} do ano econômico) erro de safra`);
  }
});

test("Meses e dias econômicos do calendário visual coincidem com o relógio canônico por 720 dias", () => {
  const clock = VilarejoCore.createRuntime().clock;
  for (let d = 1; d <= 720; d += 1) {
    const visual = simulationDayToCivilDate(d);
    const canonical = clock.fromAbsoluteDay(d);
    assert.equal(visual.economicYear, canonical.year, `Ano econômico divergente no dia ${d}`);
    assert.equal(visual.economicMonth, canonical.month, `Mês econômico divergente no dia ${d}`);
    assert.equal(visual.economicDay, canonical.day, `Dia econômico divergente no dia ${d}`);
    assert.equal(visual.isCloseDay, canonical.day === 30, `Fechamento divergente no dia ${d}`);
  }
});

test("Navegação do calendário atravessa meses e anos sem alterar o relógio da partida", () => {
  const runtime = VilarejoCore.createRuntime();
  runtime.clock.reset(149, 0);
  const clockBefore = runtime.clock.snapshot();
  const initialView = getCalendarViewState();

  const december = navigateCalendarMonth(7);
  assert.deepEqual({ year: december.year, month: december.month }, { year: 2026, month: 12 });
  assert.equal(december.isBrowsing, true);

  const january = navigateCalendarMonth(1);
  assert.deepEqual({ year: january.year, month: january.month }, { year: 2027, month: 1 });

  const previousDecember = navigateCalendarMonth(-1);
  assert.deepEqual({ year: previousDecember.year, month: previousDecember.month }, { year: 2026, month: 12 });

  const restoredView = navigateCalendarMonth(-7);
  assert.deepEqual({ year: restoredView.year, month: restoredView.month }, { year: initialView.year, month: initialView.month });
  returnCalendarToToday();
  assert.equal(getCalendarViewState().isBrowsing, false);
  assert.deepEqual(runtime.clock.snapshot(), clockBefore, "Consultar/navegar pelo calendário não pode avançar nem alterar o relógio");
});

if (failures.length > 0) {
  console.error(`\nResultado: ${failures.length} testes falharam.`);
  process.exit(1);
} else {
  console.log(`Resultado: ${passed} testes de calendário aprovados; 0 reprovados.`);
}
