(function attachIntelligenceView(root) {
  "use strict";
  const api = root.VilarejoIntelligence;
  const runtimeAdapter = root.VilarejoIntelligenceRuntime;
  const service = runtimeAdapter && runtimeAdapter.service;
  if (!api || !service) return;

  const SVG_WIDTH = 820;
  const SVG_HEIGHT = 260;
  const COLORS = ["#2563eb", "#c2410c", "#15803d"];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function numberPt(value, digits = 1) {
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  }
  function metricMap() { return new Map(service.getMetricDefinitions().map((metric) => [metric.id, metric])); }
  function valueFor(record, metricId) {
    const value = record && record.metrics ? record.metrics[metricId] : undefined;
    return finite(value) ? value : null;
  }
  function monthText(month) { return `Mês ${Math.floor(Number(month) || 0)}`; }
  function alertDateText(alert) {
    const parts = [monthText(alert.occurrenceMonth)];
    if (finite(alert.occurrenceDay)) parts.push(`dia simulado ${Math.floor(alert.occurrenceDay)}`);
    if (finite(alert.occurrenceYear)) parts.push(`ano simulado ${Math.floor(alert.occurrenceYear)}`);
    return parts.join(" · ");
  }
  function formatValue(metric, value) {
    if (!finite(value)) return "Sem dado";
    if (metric?.unit?.startsWith("R$")) return `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value)}`;
    const digits = Math.abs(value) >= 100 ? 0 : 1;
    const formatted = numberPt(value, digits);
    if (metric?.kind === "rate") return `${formatted}%`;
    if (metric?.kind === "derived-rate") return `${formatted} por mil`;
    return `${formatted} ${metric?.unit || ""}`.trim();
  }
  function formatAxis(metric, value) {
    if (metric?.unit?.startsWith("R$")) {
      const abs = Math.abs(value);
      if (abs >= 1e6) return `R$ ${(value / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
      if (abs >= 1e3) return `R$ ${(value / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
      return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
    }
    return numberPt(value, Math.abs(value) >= 100 ? 0 : 1);
  }
  function formatChange(metric, trend) {
    if (!trend) return "";
    if (metric?.kind === "rate" || metric?.kind === "derived-rate") return `${numberPt(trend.delta, 1)} p.p.`;
    if (trend.relativeChangePct !== null && trend.relativeChangePct !== undefined) return `${numberPt(trend.relativeChangePct, 1)}%`;
    return numberPt(trend.delta, 1);
  }
  function runLabel(run) {
    if (!run) return "Execução atual";
    const created = run.createdAt ? new Date(run.createdAt).toLocaleString("pt-BR") : "data não disponível";
    return `${run.status} — ${created} — ${run.recordCount} meses registrados`;
  }

  function rawChart(records, metric, metricId) {
    const rows = records || [];
    const values = rows.map((record, index) => ({ record, index, value: valueFor(record, metricId) }));
    const valid = values.filter((point) => point.value !== null);
    if (valid.length < 2) return `<div class="intel-empty-chart">${valid.length ? "Há apenas uma observação; são necessários ao menos dois pontos para desenhar a série." : "Sem observações disponíveis para este indicador neste período. Nenhum valor foi imputado."}</div>`;

    let min = Math.min(...valid.map((point) => point.value));
    let max = Math.max(...valid.map((point) => point.value));
    if (min === max) { const pad = Math.max(Math.abs(min) * 0.1, 1); min -= pad; max += pad; }
    else { const pad = (max - min) * 0.12; min -= pad; max += pad; }
    const left = 82; const right = 18; const top = 18; const bottom = 34;
    const plotWidth = SVG_WIDTH - left - right; const plotHeight = SVG_HEIGHT - top - bottom;
    const x = (index) => left + (rows.length <= 1 ? 0 : index * plotWidth / (rows.length - 1));
    const y = (value) => top + (max - value) * plotHeight / (max - min);
    const grid = Array.from({ length: 5 }, (_, i) => {
      const value = max - (max - min) * i / 4;
      const yy = top + plotHeight * i / 4;
      return `<g class="intel-grid"><line x1="${left}" y1="${yy}" x2="${SVG_WIDTH - right}" y2="${yy}"/><text x="${left - 8}" y="${yy + 4}" text-anchor="end">${escapeHtml(formatAxis(metric, value))}</text></g>`;
    }).join("");
    const segments = [];
    let segment = [];
    for (const point of values) {
      if (point.value === null) {
        if (segment.length) segments.push(segment);
        segment = [];
      } else segment.push(point);
    }
    if (segment.length) segments.push(segment);
    const paths = segments.map((points) => `<path class="intel-series-line" d="${points.map((point, i) => `${i ? "L" : "M"}${x(point.index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ")}"/>`).join("");
    const dots = valid.map((point) => `<circle class="intel-series-dot" cx="${x(point.index).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="3"><title>${escapeHtml(monthText(point.record.month))}: ${escapeHtml(formatValue(metric, point.value))}</title></circle>`).join("");
    const tickIndexes = [...new Set([0, Math.floor((rows.length - 1) / 3), Math.floor(2 * (rows.length - 1) / 3), rows.length - 1])];
    const xLabels = tickIndexes.map((index) => `<text class="intel-axis-label" x="${x(index)}" y="${SVG_HEIGHT - 8}" text-anchor="middle">${escapeHtml(monthText(rows[index].month))}</text>`).join("");
    return `<svg class="intel-chart" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="${escapeHtml(metric.label)} ao longo dos meses">${grid}${paths}${dots}${xLabels}</svg>`;
  }

  function comparisonChart(records, metricIds, definitions) {
    const ids = metricIds.slice(0, 3);
    if (!ids.length) return `<div class="intel-empty-chart">Selecione até três indicadores para comparação normalizada.</div>`;
    const rows = records || [];
    const series = ids.map((id, index) => {
      const metric = definitions.get(id);
      const points = rows.map((record, xIndex) => ({ record, xIndex, value: valueFor(record, id) }));
      const first = points.find((point) => point.value !== null && point.value !== 0);
      const normalized = points.map((point) => ({ ...point, value: point.value === null || !first ? null : point.value / first.value * 100 }));
      return { id, metric, color: COLORS[index], points: normalized, baseMonth: first?.record.month ?? null };
    }).filter((item) => item.metric);
    if (!series.some((item) => item.points.some((point) => point.value !== null))) return `<div class="intel-empty-chart">Sem base não nula e dados suficientes para comparação. Valores ausentes permanecem em branco.</div>`;

    const all = series.flatMap((item) => item.points.filter((point) => point.value !== null).map((point) => point.value));
    let min = Math.min(...all); let max = Math.max(...all);
    if (min === max) { min -= 5; max += 5; } else { const pad = (max - min) * 0.12; min -= pad; max += pad; }
    const left = 48; const right = 14; const top = 18; const bottom = 34;
    const plotWidth = SVG_WIDTH - left - right; const plotHeight = SVG_HEIGHT - top - bottom;
    const x = (i) => left + (rows.length <= 1 ? 0 : i * plotWidth / (rows.length - 1));
    const y = (v) => top + (max - v) * plotHeight / (max - min);
    const grid = Array.from({ length: 5 }, (_, i) => {
      const value = max - (max - min) * i / 4; const yy = top + plotHeight * i / 4;
      return `<g class="intel-grid"><line x1="${left}" y1="${yy}" x2="${SVG_WIDTH - right}" y2="${yy}"/><text x="${left - 6}" y="${yy + 4}" text-anchor="end">${numberPt(value, 0)}</text></g>`;
    }).join("");
    const lines = series.map((item) => {
      const parts = []; let current = [];
      item.points.forEach((point) => { if (point.value === null) { if (current.length) parts.push(current); current = []; } else current.push(point); });
      if (current.length) parts.push(current);
      return parts.map((points) => `<path class="intel-compare-line" stroke="${item.color}" d="${points.map((point, i) => `${i ? "L" : "M"}${x(point.xIndex).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ")}"/>`).join("");
    }).join("");
    const tickIndexes = [...new Set([0, Math.floor((rows.length - 1) / 3), Math.floor(2 * (rows.length - 1) / 3), rows.length - 1])];
    const xLabels = tickIndexes.map((index) => `<text class="intel-axis-label" x="${x(index)}" y="${SVG_HEIGHT - 8}" text-anchor="middle">${escapeHtml(monthText(rows[index].month))}</text>`).join("");
    const legend = series.map((item) => `<span class="intel-legend-item"><i style="--intel-series-color:${item.color}"></i>${escapeHtml(item.metric.label)} (base 100 em ${item.baseMonth ? monthText(item.baseMonth) : "n/d"})</span>`).join("");
    return `<div class="intel-legend">${legend}</div><p class="intel-chart-caption">Índice relativo: primeira observação não nula de cada série = 100. A comparação não iguala unidades nem estabelece relação causal.</p><svg class="intel-chart" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="Comparação normalizada de indicadores">${grid}${lines}${xLabels}</svg>`;
  }

  function renderAlerts(alerts, definitions) {
    if (!alerts.length) return `<div class="intel-empty-state">Nenhum alerta calculável nesta execução. Faltas de dados não são tratadas como zero nem geram alertas.</div>`;
    return `<div class="intel-alert-list">${alerts.map((alert) => {
      const metric = definitions.get(alert.metricId);
      const value = formatValue(metric, alert.observed);
      const severity = alert.severity === "crítico" ? "critical" : alert.severity === "atenção" ? "attention" : "info";
      const status = alert.status === "ativo" ? "Ativo" : alert.status === "resolvido" ? `Resolvido no ${monthText(alert.resolvedMonth)}` : alert.status === "dados pendentes" ? "Ativo — aguardando dado" : "Em observação";
      return `<article class="intel-alert intel-alert--${severity}"><div class="intel-alert-head"><span class="intel-severity">${escapeHtml(alert.severity)}</span><span class="intel-alert-status">${escapeHtml(status)}</span></div><h4>${escapeHtml(alert.indicator)}</h4><dl><div><dt>Data de ocorrência</dt><dd>${escapeHtml(alertDateText(alert))}</dd></div><div><dt>Valor observado</dt><dd>${escapeHtml(value)}</dd></div><div><dt>Condição</dt><dd>${escapeHtml(alert.threshold)}</dd></div></dl><p>${escapeHtml(alert.explanation)}</p><small>${escapeHtml(alert.evolution)}</small></article>`;
    }).join("")}</div>`;
  }

  function renderTrends(trends, definitions) {
    if (!trends.length) return `<div class="intel-empty-state">São necessárias pelo menos três observações válidas por indicador para estimar tendência.</div>`;
    return `<div class="intel-trend-grid">${trends.map((trend) => {
      const metric = definitions.get(trend.metricId);
      const change = formatChange(metric, trend);
      return `<article class="intel-trend-card"><h4>${escapeHtml(trend.label)}</h4><div class="intel-trend-fact"><b>Fato observado</b><span>${escapeHtml(trend.fact)}</span><span>Variação: ${escapeHtml(change || "n/d")} · ${trend.observations} observações</span></div><div class="intel-trend-stat"><b>Tendência estatística</b><span>${escapeHtml(trend.statisticalTrend)}</span><span>Ritmo: ${escapeHtml(trend.acceleration)}</span></div><div class="intel-trend-interpretation"><b>Interpretação limitada</b><span>${escapeHtml(trend.interpretation)}</span></div></article>`;
    }).join("")}</div>`;
  }

  function renderHistoryTable(records, metric, metricId) {
    const rows = records.slice(-12).reverse();
    if (!rows.length) return `<div class="intel-empty-state">Ainda não há fechamento mensal registrado nesta execução.</div>`;
    return `<div class="intel-table-wrap"><table class="intel-history-table"><thead><tr><th>Mês da simulação</th><th>Valor</th><th>Natureza</th><th>Fonte / método</th><th>Qualidade</th></tr></thead><tbody>${rows.map((record) => {
      const value = valueFor(record, metricId);
      const quality = record.metricQuality?.[metricId] || (value === null ? "Não disponível neste fechamento" : "Dado modelado da simulação");
      return `<tr><td>${escapeHtml(monthText(record.month))}</td><td>${escapeHtml(formatValue(metric, value))}</td><td>${escapeHtml(metric.kind)}</td><td>${escapeHtml(metric.source)}</td><td>${escapeHtml(quality)}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function renderMethodology() {
    const rules = api.ALERT_RULES.map((rule) => `<li><b>${escapeHtml(rule.id)}</b>: ${escapeHtml(rule.thresholdText)}. Justificativa: ${escapeHtml(rule.explanation)}</li>`).join("");
    return `<details class="intel-methodology"><summary>Metodologia, limites e limiares dos alertas</summary><p>O módulo observa exclusivamente fechamentos mensais reais gerados pela simulação. Valores econômicos são nominais e por mês simulado, salvo quando identificados como estoque, taxa ou acumulado. Tendências precisam de pelo menos três observações; aceleração/desaceleração requer pelo menos seis. A curva comparativa normaliza cada série na primeira observação não nula (base 100).</p><ul>${rules}</ul><p>Os limiares são heurísticas internas de monitoramento do jogo, escolhidas para exigir magnitude e persistência. “Informativo” descreve um primeiro sinal; não é uma crise. Dados ausentes interrompem a evidência e não são interpolados. A simultaneidade não demonstra causalidade. Não existe nesta referência indicador histórico de Gini/renda média nem uma série mensal de qualidade de serviços públicos.</p></details>`;
  }

  function renderDashboard(host) {
    if (!host || !service) return;
    const definitions = metricMap();
    const runOptions = service.getRunList();
    const selectedRunId = service.getSelectedRunId() || service.getCurrentRunId();
    const run = service.getRun(selectedRunId);
    const allRecords = service.getRunHistory(selectedRunId);
    const period = service.getVisibleMonths();
    const visibleRecords = allRecords.slice(-period);
    const selectedMetricId = service.getSelectedMetric();
    const selectedMetric = definitions.get(selectedMetricId) || definitions.get("gdpProduction");
    const alerts = service.getAlerts(selectedRunId);
    const trends = service.getTrends(selectedRunId, period);
    const severeAlerts = alerts.filter((alert) => alert.status === "ativo" && alert.severity !== "informativo");
    const severeCount = severeAlerts.length;
    const latestMonth = allRecords.length ? allRecords[allRecords.length - 1].month : null;
    const options = [...definitions.values()].map((metric) => `<option value="${escapeHtml(metric.id)}" ${metric.id === selectedMetric.id ? "selected" : ""}>${escapeHtml(metric.label)} — ${escapeHtml(metric.unit)}</option>`).join("");
    const currentRunId = service.getCurrentRunId();
    const currentSummary = service.getSummary();
    const serviceHistoryText = "A tela de Serviços desta referência apresenta indicadores de estado atual, mas não publica snapshots mensais históricos com contrato de série. A Central não cria uma série retroativa nem estima valores; alertas e tendências de serviços ficam indisponíveis.";
    const recordsShown = visibleRecords.length;
    const compareOptions = [...definitions.values()].map((metric) => `<option value="${escapeHtml(metric.id)}" ${service.getCompareMetrics().includes(metric.id) ? "selected" : ""}>${escapeHtml(metric.label)}</option>`).join("");
    const activeAlertsText = severeCount >= 2
      ? `${severeCount} alertas persistentes ativos: ${severeAlerts.map((alert) => alert.indicator).join(", ")}. Coocorrência temporal observada; não implica causalidade.`
      : severeCount === 1
        ? `Um alerta persistente ativo em ${severeAlerts[0].indicator}. A classificação descreve o limiar observado, não sua causa.`
        : "Nenhum alerta persistente ativo nesta execução.";

    host.innerHTML = `
      <div class="intel-shell">
        <header class="intel-header"><div><p class="intel-eyebrow">LEITURA TEMPORAL · DADOS DA SIMULAÇÃO</p><h2>Central de Inteligência</h2><p>Fatos observados, tendências estatísticas e alertas separados. Nada aqui altera a simulação.</p></div><div class="intel-run-id">Execução: <code>${escapeHtml(selectedRunId || "n/d")}</code></div></header>
        <div class="intel-persistence-note"><b>Persistência:</b> ${escapeHtml(service.getPersistenceStatus())} <span>Histórico local por execução; escolher uma execução arquivada não carrega a partida.</span></div>
        <section class="intel-toolbar" aria-label="Filtros de análise"><label>Execução histórica<select data-intel-run>${runOptions.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedRunId ? "selected" : ""}>${escapeHtml(runLabel(item))}${item.id === currentRunId ? " (atual nesta aba)" : ""}</option>`).join("")}</select></label><div class="intel-period-control" role="group" aria-label="Janela temporal">${[12, 24, 60].map((months) => `<button type="button" data-intel-period="${months}" aria-pressed="${months === period}">${months} meses</button>`).join("")}</div><label>Indicador principal<select data-intel-metric>${options}</select></label><label>Comparar (até 3; base 100)<select data-intel-compare multiple size="4">${compareOptions}</select></label></section>
        <section class="intel-kpis" aria-label="Resumo da execução"><article><span>Último fechamento registrado</span><b>${latestMonth === null ? "Sem dados" : escapeHtml(monthText(latestMonth))}</b></article><article><span>Fechamentos disponíveis</span><b>${allRecords.length} / até ${api.MAX_MONTHS_PER_RUN}</b></article><article><span>Alertas persistentes ativos</span><b>${severeCount}</b></article><article><span>Execução selecionada</span><b>${escapeHtml(run?.status === "archived" || selectedRunId !== currentRunId ? "Arquivo histórico" : "Atual nesta aba")}</b></article></section>
        <section class="intel-simultaneous"><b>Leitura simultânea:</b> ${escapeHtml(activeAlertsText)}</section>
        <section class="intel-chart-grid"><article class="intel-panel"><div class="intel-panel-heading"><div><p class="intel-eyebrow">SÉRIE MENSAL</p><h3>${escapeHtml(selectedMetric.label)}</h3><p>${escapeHtml(selectedMetric.unit)} · ${escapeHtml(selectedMetric.kind)} · Fonte: ${escapeHtml(selectedMetric.source)}</p></div><span class="intel-count">${recordsShown} observações na janela</span></div>${rawChart(visibleRecords, selectedMetric, selectedMetric.id)}<div class="intel-chart-caption">Cada ponto é um fechamento mensal observado. Lacunas não são interpoladas.</div></article><article class="intel-panel"><div class="intel-panel-heading"><div><p class="intel-eyebrow">COMPARAÇÃO</p><h3>Trajetórias relativas</h3><p>Escala base 100, sem equivalência de unidades.</p></div></div>${comparisonChart(visibleRecords, service.getCompareMetrics(), definitions)}</article></section>
        <section class="intel-panel"><div class="intel-panel-heading"><div><p class="intel-eyebrow">ALERTAS</p><h3>Eventos e persistência</h3><p>Ocorrência, gravidade, valor observado, condição e evolução.</p></div></div>${renderAlerts(alerts, definitions)}</section>
        <section class="intel-panel"><div class="intel-panel-heading"><div><p class="intel-eyebrow">TENDÊNCIAS</p><h3>Crescimento, retração e ritmo</h3><p>Fato observado ≠ tendência estatística ≠ interpretação.</p></div></div>${renderTrends(trends, definitions)}</section>
        <section class="intel-panel"><div class="intel-panel-heading"><div><p class="intel-eyebrow">CONSULTA MENSAL</p><h3>${escapeHtml(selectedMetric.label)}</h3><p>Até 12 fechamentos recentes da janela selecionada.</p></div></div>${renderHistoryTable(visibleRecords, selectedMetric, selectedMetric.id)}</section>
        <section class="intel-unavailable"><div><p class="intel-eyebrow">SERVIÇOS PÚBLICOS</p><h3>Série histórica indisponível</h3><p>${escapeHtml(serviceHistoryText)}</p></div><span>Sem valores / sem alertas</span></section>
        ${renderMethodology()}
        <footer class="intel-footer">Indicadores modelados, não estatísticas observadas do mundo real. Estado da simulação: separado do histórico analítico local. ${escapeHtml(currentSummary.persistenceWarning || "")}</footer>
      </div>`;

    const runSelect = host.querySelector("[data-intel-run]");
    if (runSelect) runSelect.addEventListener("change", (event) => { service.selectRun(event.target.value); renderDashboard(host); });
    host.querySelectorAll("[data-intel-period]").forEach((button) => button.addEventListener("click", () => { service.setVisibleMonths(button.dataset.intelPeriod); renderDashboard(host); }));
    const metricSelect = host.querySelector("[data-intel-metric]");
    if (metricSelect) metricSelect.addEventListener("change", (event) => { service.setSelectedMetric(event.target.value); renderDashboard(host); });
    const compareSelect = host.querySelector("[data-intel-compare]");
    if (compareSelect) compareSelect.addEventListener("change", (event) => {
      const ids = Array.from(event.target.selectedOptions).map((option) => option.value);
      service.setCompareMetrics(ids);
      renderDashboard(host);
    });
  }

  api.renderDashboard = renderDashboard;
})(window);
