(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoExecutive = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function factory() {
  "use strict";
  const VERSION = "2.0.0";
  const SCHEMA = 2;
  const LIMITS = Object.freeze({ audit: 1000, outbox: 500, reviews: 120 });
  const DEPARTMENTS = Object.freeze([
    ["finance", "Fazenda", "Orçamento, receitas, despesas e sustentabilidade fiscal"],
    ["health", "Saúde", "Coordenação administrativa da política de saúde"],
    ["education", "Educação", "Coordenação administrativa da educação"],
    ["security", "Segurança", "Coordenação administrativa da segurança pública"],
    ["development", "Desenvolvimento Econômico", "Emprego, negócios e atividade produtiva"],
    ["infrastructure", "Infraestrutura", "Obras, mobilidade e manutenção"],
    ["environment", "Meio Ambiente", "Proteção ambiental e sustentabilidade"],
    ["culture", "Cultura e Esporte", "Cultura, esporte, lazer e identidade local"],
    ["social", "Assistência Social", "Proteção social e atendimento às famílias"]
  ]);
  const STATUSES = Object.freeze({ department: ["active", "inactive", "merged"], goal: ["planned", "in_progress", "at_risk", "completed", "cancelled"], request: ["pending", "approved", "rejected", "returned", "committed", "executed"], project: ["proposed", "approved", "in_progress", "paused", "completed", "cancelled"], task: ["pending", "in_progress", "completed", "cancelled"] });
  const SKILLS = ["technical", "management", "articulation", "integrity", "loyalty", "popularity"];
  const clone = (x) => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  const text = (x, fallback = "") => String(x ?? fallback).trim();
  const isNum = (x) => x !== null && x !== undefined && x !== "" && Number.isFinite(Number(x));
  const number = (x, fallback = 0) => isNum(x) ? Number(x) : fallback;
  const integer = (x, fallback = 0) => Math.floor(number(x, fallback));
  const clamp = (x, min = 0, max = 100) => Math.max(min, Math.min(max, number(x, min)));
  const idSafe = (x) => /^[a-z0-9][a-z0-9_-]{1,47}$/i.test(String(x || ""));
  const assert = (condition, message, ErrorType = Error) => { if (!condition) throw new ErrorType(message); };
  const unique = (arr, key) => { const seen = new Set(); for (const item of arr) { const k = key(item); assert(!seen.has(k), `Identificador duplicado: ${k}`); seen.add(k); } };

  function createState(options = {}) {
    const month = Math.max(0, integer(options.startMonth));
    const departments = (options.departments || DEPARTMENTS.map(([id, name, purpose]) => ({ id, name, purpose }))).map((d) => ({
      id: text(d.id), name: text(d.name, d.id), purpose: text(d.purpose), status: "active", parentId: null,
      secretaryId: null, goals: [], budgetRequests: [], projects: [], createdMonth: month, closedMonth: null, mergedInto: null
    }));
    const state = {
      schema: SCHEMA, version: VERSION, currentMonth: month,
      counters: { department: departments.length + 1, person: 1, goal: 1, request: 1, meeting: 1, project: 1, task: 1, event: 1 },
      executive: { title: text(options.executiveTitle, "Chefe do Executivo"), name: text(options.executiveName, "") },
      departments, people: [], meetings: [], tasks: [], issues: [], audit: [], outbox: [], monthlyReviews: [],
      metadata: { createdAtMonth: month, lastAdvancedMonth: month, adapterVersion: null }
    };
    validateState(state);
    return state;
  }

  function validateState(s) {
    assert(s && s.schema === SCHEMA && s.version === VERSION, `Estado incompatível. Esperado ${VERSION}.`, TypeError);
    for (const key of ["departments", "people", "meetings", "tasks", "issues", "audit", "outbox", "monthlyReviews"]) assert(Array.isArray(s[key]), `Estado inválido: ${key}.`, TypeError);
    assert(Number.isInteger(s.currentMonth) && s.currentMonth >= 0, "Mês atual inválido.", TypeError);
    unique(s.departments, x => x.id); unique(s.people, x => x.id); unique(s.meetings, x => x.id); unique(s.tasks, x => x.id); unique(s.issues, x => x.id);
    for (const d of s.departments) {
      assert(idSafe(d.id), `ID de secretaria inválido: ${d.id}`, TypeError);
      assert(STATUSES.department.includes(d.status), `Status de secretaria inválido: ${d.status}`, TypeError);
      if (d.secretaryId) { const p = s.people.find(x => x.id === d.secretaryId); assert(p && p.status === "active" && p.departmentId === d.id, `Titular inconsistente em ${d.id}.`); }
      for (const g of d.goals) assert(STATUSES.goal.includes(g.status), `Status de meta inválido: ${g.status}`);
      for (const r of d.budgetRequests) assert(STATUSES.request.includes(r.status), `Status de pedido inválido: ${r.status}`);
      for (const p of d.projects) assert(STATUSES.project.includes(p.status), `Status de projeto inválido: ${p.status}`);
    }
    for (const p of s.people) if (p.status === "active") { const d = s.departments.find(x => x.id === p.departmentId); assert(d && d.status === "active" && d.secretaryId === p.id, `Vínculo funcional inconsistente: ${p.id}`); }
    return true;
  }

  function emit(s, type, payload = {}) {
    const event = { id: `exec-event-${s.counters.event++}`, type, month: s.currentMonth, payload: clone(payload), delivered: false };
    s.audit.push(clone(event)); s.outbox.push(clone(event));
    if (s.audit.length > LIMITS.audit) s.audit.splice(0, s.audit.length - LIMITS.audit);
    if (s.outbox.length > LIMITS.outbox) s.outbox.splice(0, s.outbox.length - LIMITS.outbox);
    return event;
  }
  function transact(s, fn) {
    validateState(s);
    const draft = clone(s);
    const result = fn(draft);
    validateState(draft);
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, draft);
    return clone(result);
  }
  function getDepartment(s, id, active = true) {
    const d = s.departments.find(x => x.id === String(id));
    assert(d && (!active || d.status === "active"), `Secretaria não encontrada ou inativa: ${id}`);
    return d;
  }
  function getPerson(s, id, active = true) {
    const p = s.people.find(x => x.id === String(id));
    assert(p && (!active || p.status === "active"), `Agente público não encontrado ou inativo: ${id}`);
    return p;
  }
  function nextId(s, type, prefix) { return `${prefix}-${s.counters[type]++}`; }

  function addDepartment(s, input = {}) { return transact(s, d => {
    const id = text(input.id); assert(idSafe(id), "Use ID simples (letras, números, _ ou -), com 2 a 48 caracteres.", TypeError);
    assert(!d.departments.some(x => x.id === id), `Secretaria já existe: ${id}`);
    const item = { id, name: text(input.name), purpose: text(input.purpose), status: "active", parentId: input.parentId ? String(input.parentId) : null,
      secretaryId: null, goals: [], budgetRequests: [], projects: [], createdMonth: d.currentMonth, closedMonth: null, mergedInto: null };
    assert(item.name, "Nome da secretaria obrigatório.", TypeError);
    if (item.parentId) getDepartment(d, item.parentId);
    d.departments.push(item); emit(d, "department.created", { departmentId: id, name: item.name }); return item;
  }); }
  function appointSecretary(s, input = {}) { return transact(s, d => {
    const dep = getDepartment(d, input.departmentId); assert(!dep.secretaryId, "A secretaria já possui titular.");
    const name = text(input.name); assert(name, "Nome do secretário obrigatório.", TypeError);
    const skills = {}; for (const k of SKILLS) skills[k] = clamp(input.skills?.[k] ?? 50);
    const person = { id: nextId(d, "person", "person"), name, departmentId: dep.id, background: text(input.background),
      appointedMonth: d.currentMonth, dismissedMonth: null, status: "active", skills,
      traits: { ambition: clamp(input.traits?.ambition ?? 50), pragmatism: clamp(input.traits?.pragmatism ?? 50), ideology: text(input.traits?.ideology, "centro") },
      performance: { score: null, trend: "unrated", reviews: [] } };
    d.people.push(person); dep.secretaryId = person.id;
    emit(d, "secretary.appointed", { personId: person.id, name, departmentId: dep.id }); return person;
  }); }
  function dismissSecretary(s, personId, reason = "Exoneração") { return transact(s, d => {
    const p = getPerson(d, personId); const dep = getDepartment(d, p.departmentId);
    dep.secretaryId = null; p.status = "dismissed"; p.dismissedMonth = d.currentMonth; p.dismissalReason = text(reason);
    emit(d, "secretary.dismissed", { personId: p.id, name: p.name, departmentId: dep.id, reason: p.dismissalReason }); return p;
  }); }
  function replaceSecretary(s, departmentId, input = {}) { return transact(s, d => {
    const dep = getDepartment(d, departmentId);
    if (dep.secretaryId) { const old = getPerson(d, dep.secretaryId); old.status = "dismissed"; old.dismissedMonth = d.currentMonth; old.dismissalReason = "Substituição"; dep.secretaryId = null; emit(d, "secretary.dismissed", { personId: old.id, departmentId: dep.id, reason: "Substituição" }); }
    const name = text(input.name); assert(name, "Nome do novo secretário obrigatório.", TypeError);
    const skills = {}; for (const k of SKILLS) skills[k] = clamp(input.skills?.[k] ?? 50);
    const p = { id: nextId(d, "person", "person"), name, departmentId: dep.id, background: text(input.background), appointedMonth: d.currentMonth,
      dismissedMonth: null, status: "active", skills, traits: { ambition: clamp(input.traits?.ambition ?? 50), pragmatism: clamp(input.traits?.pragmatism ?? 50), ideology: text(input.traits?.ideology, "centro") },
      performance: { score: null, trend: "unrated", reviews: [] } };
    d.people.push(p); dep.secretaryId = p.id; emit(d, "secretary.appointed", { personId: p.id, name, departmentId: dep.id, replacement: true }); return p;
  }); }
  function addGoal(s, departmentId, input = {}) { return transact(s, d => {
    const dep = getDepartment(d, departmentId); const title = text(input.title); assert(title, "Título da meta obrigatório.", TypeError);
    const baseline = isNum(input.baseline) ? Number(input.baseline) : null, target = isNum(input.target) ? Number(input.target) : null;
    const goal = { id: nextId(d, "goal", "goal"), title, description: text(input.description), indicator: text(input.indicator), unit: text(input.unit, "unidade"),
      baseline, target, current: baseline, direction: ["increase", "decrease"].includes(input.direction) ? input.direction : "increase",
      deadlineMonth: isNum(input.deadlineMonth) ? integer(input.deadlineMonth) : null, status: "planned", source: text(input.source, "manual"),
      evidence: [], createdMonth: d.currentMonth, updatedMonth: d.currentMonth };
    assert(goal.deadlineMonth === null || goal.deadlineMonth >= d.currentMonth, "Prazo não pode estar no passado.", RangeError);
    dep.goals.push(goal); emit(d, "goal.created", { departmentId: dep.id, goalId: goal.id, title }); return goal;
  }); }
  function updateGoal(s, departmentId, goalId, input = {}) { return transact(s, d => {
    const dep = getDepartment(d, departmentId), g = dep.goals.find(x => x.id === goalId); assert(g, "Meta não encontrada.");
    if (input.current !== undefined) { assert(isNum(input.current), "Indicador precisa ser numérico.", TypeError); g.current = Number(input.current); }
    if (input.status !== undefined) { assert(STATUSES.goal.includes(input.status), "Status de meta inválido.", TypeError); g.status = input.status; }
    else if (g.target !== null && g.current !== null) {
      const reached = g.direction === "decrease" ? g.current <= g.target : g.current >= g.target;
      g.status = reached ? "completed" : "in_progress";
    }
    g.updatedMonth = d.currentMonth;
    if (input.evidence) g.evidence.push({ month: d.currentMonth, note: text(input.evidence), source: text(input.source, "manual") });
    emit(d, "goal.updated", { departmentId: dep.id, goalId, current: g.current, status: g.status }); return g;
  }); }
  function requestBudget(s, departmentId, input = {}) { return transact(s, d => {
    const dep = getDepartment(d, departmentId); assert(isNum(input.amount) && Number(input.amount) > 0, "Valor solicitado deve ser positivo.", RangeError);
    const req = { id: nextId(d, "request", "budget"), amount: Number(input.amount), purpose: text(input.purpose), category: text(input.category, "other"),
      urgency: ["low", "normal", "high", "critical"].includes(input.urgency) ? input.urgency : "normal", status: "pending",
      requestedMonth: d.currentMonth, decidedMonth: null, decisionNote: "", externalReference: null, linkedProjectId: input.projectId || null };
    assert(req.purpose, "Finalidade do pedido obrigatório.", TypeError); dep.budgetRequests.push(req);
    emit(d, "budget.requested", { departmentId: dep.id, requestId: req.id, amount: req.amount, purpose: req.purpose }); return req;
  }); }
  function decideBudget(s, departmentId, requestId, decision, options = {}) { return transact(s, d => {
    const dep = getDepartment(d, departmentId), req = dep.budgetRequests.find(x => x.id === requestId); assert(req && req.status === "pending", "Pedido pendente não encontrado.");
    assert(["approved", "rejected", "returned"].includes(decision), "Decisão inválida.", TypeError);
    req.status = decision; req.decidedMonth = d.currentMonth; req.decisionNote = text(options.note);
    emit(d, "budget.decision_recorded", { departmentId: dep.id, requestId, decision, amount: req.amount, note: req.decisionNote,
      integrationRequired: decision === "approved" ? "Aprovação administrativa não reserva nem movimenta caixa; o módulo fiscal deve validar saldo e efetivar empenho." : null }); return req;
  }); }
  function registerBudgetExecution(s, departmentId, requestId, result = {}) { return transact(s, d => {
    const dep = getDepartment(d, departmentId), req = dep.budgetRequests.find(x => x.id === requestId); assert(req && req.status === "approved", "Somente pedido aprovado pode receber retorno fiscal.");
    assert(result.status === "committed" || result.status === "executed", "Retorno fiscal deve ser committed ou executed.", TypeError);
    assert(text(result.externalReference), "Referência do módulo fiscal obrigatória.", TypeError);
    req.status = result.status; req.externalReference = text(result.externalReference); req.fiscalAmount = isNum(result.amount) ? Number(result.amount) : req.amount;
    emit(d, "budget.fiscal_result_registered", { departmentId: dep.id, requestId, status: req.status, externalReference: req.externalReference, amount: req.fiscalAmount }); return req;
  }); }
  function createProject(s, departmentId, input = {}) { return transact(s, d => {
    const dep = getDepartment(d, departmentId), name = text(input.name); assert(name, "Nome do projeto obrigatório.", TypeError);
    const project = { id: nextId(d, "project", "project"), name, description: text(input.description), status: "proposed", priority: clamp(input.priority ?? 50),
      estimatedCost: isNum(input.estimatedCost) ? Number(input.estimatedCost) : null, startMonth: null, targetMonth: isNum(input.targetMonth) ? integer(input.targetMonth) : null,
      goalIds: Array.isArray(input.goalIds) ? input.goalIds.slice() : [], milestones: [], createdMonth: d.currentMonth, updatedMonth: d.currentMonth };
    for (const gid of project.goalIds) assert(dep.goals.some(g => g.id === gid), `Meta vinculada não pertence à secretaria: ${gid}`);
    dep.projects.push(project); emit(d, "project.created", { departmentId: dep.id, projectId: project.id, name }); return project;
  }); }
  function updateProject(s, departmentId, projectId, input = {}) { return transact(s, d => {
    const dep = getDepartment(d, departmentId), p = dep.projects.find(x => x.id === projectId); assert(p, "Projeto não encontrado.");
    if (input.status !== undefined) { assert(STATUSES.project.includes(input.status), "Status de projeto inválido.", TypeError); p.status = input.status; if (input.status === "in_progress" && p.startMonth === null) p.startMonth = d.currentMonth; }
    if (input.priority !== undefined) p.priority = clamp(input.priority);
    if (input.targetMonth !== undefined) { assert(isNum(input.targetMonth) && integer(input.targetMonth) >= d.currentMonth, "Prazo inválido.", RangeError); p.targetMonth = integer(input.targetMonth); }
    if (input.milestone) p.milestones.push({ month: d.currentMonth, title: text(input.milestone.title), status: text(input.milestone.status, "recorded"), evidence: text(input.milestone.evidence) });
    p.updatedMonth = d.currentMonth; emit(d, "project.updated", { departmentId: dep.id, projectId, status: p.status }); return p;
  }); }
  function createMeeting(s, input = {}) { return transact(s, d => {
    const title = text(input.title); assert(title, "Título da reunião obrigatório.", TypeError);
    const participants = Array.isArray(input.participants) ? [...new Set(input.participants.map(String))] : d.people.filter(p => p.status === "active").map(p => p.id);
    for (const id of participants) getPerson(d, id);
    const meeting = { id: nextId(d, "meeting", "meeting"), title, month: d.currentMonth, participants,
      agenda: Array.isArray(input.agenda) ? input.agenda.map(x => text(x)).filter(Boolean) : [], notes: text(input.notes), decisions: [], status: "scheduled" };
    d.meetings.push(meeting); emit(d, "meeting.created", { meetingId: meeting.id, title, participants }); return meeting;
  }); }
  function addMeetingDecision(s, meetingId, input = {}) { return transact(s, d => {
    const m = d.meetings.find(x => x.id === meetingId); assert(m, "Reunião não encontrada."); const decision = text(input.decision); assert(decision, "Decisão obrigatória.", TypeError);
    const item = { id: `decision-${m.decisions.length + 1}`, decision, departmentId: input.departmentId ? String(input.departmentId) : null,
      responsiblePersonId: input.responsiblePersonId ? String(input.responsiblePersonId) : null, deadlineMonth: isNum(input.deadlineMonth) ? integer(input.deadlineMonth) : null,
      status: "pending", recordedMonth: d.currentMonth, evidence: "" };
    if (item.departmentId) getDepartment(d, item.departmentId); if (item.responsiblePersonId) getPerson(d, item.responsiblePersonId);
    assert(item.deadlineMonth === null || item.deadlineMonth >= d.currentMonth, "Prazo da decisão no passado.", RangeError);
    m.decisions.push(item); m.status = "in_progress"; emit(d, "meeting.decision_added", { meetingId, decisionId: item.id, decision }); return item;
  }); }
  function createTask(s, input = {}) { return transact(s, d => {
    const title = text(input.title); assert(title, "Descrição da pendência obrigatória.", TypeError);
    const dep = input.departmentId ? getDepartment(d, input.departmentId) : null;
    const person = input.responsiblePersonId ? getPerson(d, input.responsiblePersonId) : null;
    const task = { id: nextId(d, "task", "task"), title, description: text(input.description), departmentId: dep?.id || null, responsiblePersonId: person?.id || null,
      dueMonth: isNum(input.dueMonth) ? integer(input.dueMonth) : null, status: "pending", priority: clamp(input.priority ?? 50), createdMonth: d.currentMonth, completedMonth: null };
    assert(task.dueMonth === null || task.dueMonth >= d.currentMonth, "Prazo não pode estar no passado.", RangeError);
    d.tasks.push(task); emit(d, "task.created", { taskId: task.id, title, departmentId: task.departmentId }); return task;
  }); }
  function updateTask(s, taskId, input = {}) { return transact(s, d => {
    const t = d.tasks.find(x => x.id === taskId); assert(t, "Pendência não encontrada.");
    if (input.status !== undefined) { assert(STATUSES.task.includes(input.status), "Status de pendência inválido.", TypeError); t.status = input.status; if (input.status === "completed") t.completedMonth = d.currentMonth; }
    if (input.responsiblePersonId !== undefined) { if (input.responsiblePersonId) getPerson(d, input.responsiblePersonId); t.responsiblePersonId = input.responsiblePersonId || null; }
    if (input.dueMonth !== undefined) { assert(isNum(input.dueMonth) && integer(input.dueMonth) >= d.currentMonth, "Prazo inválido.", RangeError); t.dueMonth = integer(input.dueMonth); }
    emit(d, "task.updated", { taskId, status: t.status }); return t;
  }); }
  function reviewSecretary(s, personId, input = {}) { return transact(s, d => {
    const p = getPerson(d, personId); assert(isNum(input.score), "Nota precisa ser numérica.", TypeError);
    const score = clamp(input.score), previous = p.performance.score; const trend = previous === null ? "stable" : score > previous + 2 ? "up" : score < previous - 2 ? "down" : "stable";
    const review = { month: d.currentMonth, score, trend, note: text(input.note), evidence: text(input.evidence) };
    p.performance.score = score; p.performance.trend = trend; p.performance.reviews.push(review); if (p.performance.reviews.length > LIMITS.reviews) p.performance.reviews.shift();
    emit(d, "secretary.reviewed", { personId, departmentId: p.departmentId, score, trend }); return p.performance;
  }); }
  function mergeDepartments(s, sourceId, targetId) { return transact(s, d => {
    assert(sourceId !== targetId, "Origem e destino devem ser diferentes.", TypeError);
    const src = getDepartment(d, sourceId), dst = getDepartment(d, targetId);
    assert(!src.secretaryId || !dst.secretaryId || src.secretaryId === dst.secretaryId, "Resolva os dois titulares antes da fusão.");
    if (src.secretaryId && !dst.secretaryId) { dst.secretaryId = src.secretaryId; const p = getPerson(d, src.secretaryId); p.departmentId = dst.id; }
    src.goals.forEach(g => { g.transferredFrom = src.id; }); src.budgetRequests.forEach(r => { r.transferredFrom = src.id; }); src.projects.forEach(p => { p.transferredFrom = src.id; });
    dst.goals.push(...src.goals); dst.budgetRequests.push(...src.budgetRequests); dst.projects.push(...src.projects);
    src.goals = []; src.budgetRequests = []; src.projects = []; src.secretaryId = null; src.status = "merged"; src.mergedInto = dst.id; src.closedMonth = d.currentMonth;
    emit(d, "department.merged", { sourceId, targetId }); return { source: src, target: dst };
  }); }
  function closeDepartment(s, id, options = {}) { return transact(s, d => {
    const dep = getDepartment(d, id); assert(!dep.secretaryId || options.dismissSecretary === true || options.transferTo, "Exonere ou transfira o titular antes de encerrar.");
    if (dep.secretaryId) {
      const p = getPerson(d, dep.secretaryId);
      if (options.transferTo) { const target = getDepartment(d, options.transferTo); assert(!target.secretaryId, "Secretaria de destino já tem titular."); target.secretaryId = p.id; p.departmentId = target.id; }
      else { p.status = "dismissed"; p.dismissedMonth = d.currentMonth; p.dismissalReason = "Extinção da secretaria"; }
      dep.secretaryId = null;
    }
    dep.status = "inactive"; dep.closedMonth = d.currentMonth; emit(d, "department.closed", { departmentId: id, transferTo: options.transferTo || null }); return dep;
  }); }
  function registerIssue(s, input = {}) { return transact(s, d => {
    const title = text(input.title); assert(title, "Título do problema administrativo obrigatório.", TypeError);
    const involved = [...new Set((input.departmentIds || []).map(String))]; for (const id of involved) getDepartment(d, id);
    const owner = input.ownerDepartmentId ? getDepartment(d, input.ownerDepartmentId).id : null;
    const issue = { id: `issue-${d.issues.length + 1}-${d.currentMonth}`, title, description: text(input.description), category: text(input.category, "coordination"),
      severity: ["low", "medium", "high", "critical"].includes(input.severity) ? input.severity : "medium", status: "open",
      departmentIds: involved, ownerDepartmentId: owner, openedMonth: d.currentMonth, dueMonth: isNum(input.dueMonth) ? integer(input.dueMonth) : null,
      resolvedMonth: null, resolution: "", impact: text(input.impact) };
    assert(issue.dueMonth === null || issue.dueMonth >= d.currentMonth, "Prazo do problema no passado.", RangeError);
    d.issues.push(issue); emit(d, "administration.issue_opened", { issueId: issue.id, title, severity: issue.severity, departmentIds: involved }); return issue;
  }); }
  function updateIssue(s, issueId, input = {}) { return transact(s, d => {
    const issue = d.issues.find(x => x.id === issueId); assert(issue, "Problema administrativo não encontrado.");
    if (input.status !== undefined) { assert(["open", "in_progress", "resolved", "cancelled"].includes(input.status), "Status de problema inválido.", TypeError); issue.status = input.status;
      if (input.status === "resolved") { issue.resolvedMonth = d.currentMonth; issue.resolution = text(input.resolution); assert(issue.resolution, "Descreva a solução adotada.", TypeError); } }
    if (input.ownerDepartmentId !== undefined) issue.ownerDepartmentId = input.ownerDepartmentId ? getDepartment(d, input.ownerDepartmentId).id : null;
    if (input.severity !== undefined) { assert(["low", "medium", "high", "critical"].includes(input.severity), "Gravidade inválida.", TypeError); issue.severity = input.severity; }
    emit(d, "administration.issue_updated", { issueId, status: issue.status, severity: issue.severity }); return issue;
  }); }
  function advanceMonth(s, targetMonth = s.currentMonth + 1) { return transact(s, d => {
    const target = integer(targetMonth, d.currentMonth + 1); assert(target >= d.currentMonth, "O calendário administrativo não pode retroceder.", RangeError);
    if (target === d.currentMonth) return { unchanged: true, review: d.monthlyReviews[d.monthlyReviews.length - 1] || null };
    const generated = [];
    for (let month = d.currentMonth + 1; month <= target; month++) {
      d.currentMonth = month;
      for (const dep of d.departments.filter(x => x.status === "active")) for (const goal of dep.goals) {
        if (["completed", "cancelled"].includes(goal.status)) continue;
        if (goal.deadlineMonth !== null && goal.deadlineMonth < month) goal.status = "at_risk";
      }
      for (const task of d.tasks) if (task.status !== "completed" && task.status !== "cancelled" && task.dueMonth !== null && task.dueMonth < month) task.overdue = true;
      const activeDeps = d.departments.filter(x => x.status === "active"), goals = activeDeps.flatMap(x => x.goals), reqs = activeDeps.flatMap(x => x.budgetRequests);
      const review = { month, departments: activeDeps.length, staffedDepartments: activeDeps.filter(x => x.secretaryId).length,
        activeSecretaries: d.people.filter(x => x.status === "active").length,
        goals: { total: goals.length, completed: goals.filter(x => x.status === "completed").length, atRisk: goals.filter(x => x.status === "at_risk").length, inProgress: goals.filter(x => x.status === "in_progress").length },
        pendingBudgetRequests: reqs.filter(x => x.status === "pending").length, overdueTasks: d.tasks.filter(x => x.overdue && x.status !== "completed").length,
        activeProjects: activeDeps.flatMap(x => x.projects).filter(x => ["approved", "in_progress", "paused"].includes(x.status)).length,
        openIssues: d.issues.filter(x => ["open", "in_progress"].includes(x.status)).length, overdueIssues: d.issues.filter(x => x.dueMonth !== null && x.dueMonth < month && ["open", "in_progress"].includes(x.status)).length };
      d.monthlyReviews.push(review); if (d.monthlyReviews.length > 120) d.monthlyReviews.shift(); emit(d, "administration.month_closed", review); generated.push(review);
    }
    d.metadata.lastAdvancedMonth = target;
    return { unchanged: false, reviews: generated, review: generated[generated.length - 1] };
  }); }
  function getSnapshot(s) {
    validateState(s);
    const departments = s.departments.map(dep => ({ ...clone(dep), secretary: dep.secretaryId ? clone(s.people.find(p => p.id === dep.secretaryId)) : null }));
    const active = departments.filter(x => x.status === "active"), goals = active.flatMap(x => x.goals), requests = active.flatMap(x => x.budgetRequests);
    return clone({ version: VERSION, schema: SCHEMA, currentMonth: s.currentMonth, executive: s.executive, departments, people: s.people,
      meetings: s.meetings, tasks: s.tasks, issues: s.issues, audit: s.audit, outbox: s.outbox, monthlyReviews: s.monthlyReviews,
      summary: { departments: active.length, staffedDepartments: active.filter(x => x.secretaryId).length,
        activeSecretaries: s.people.filter(x => x.status === "active").length, goals: goals.length,
        completedGoals: goals.filter(x => x.status === "completed").length, atRiskGoals: goals.filter(x => x.status === "at_risk").length,
        pendingBudgetRequests: requests.filter(x => x.status === "pending").length,
        activeProjects: active.flatMap(x => x.projects).filter(x => ["approved", "in_progress", "paused"].includes(x.status)).length,
        pendingTasks: s.tasks.filter(x => ["pending", "in_progress"].includes(x.status)).length,
        overdueTasks: s.tasks.filter(x => x.overdue && x.status !== "completed").length,
        openIssues: s.issues.filter(x => ["open", "in_progress"].includes(x.status)).length,
        criticalIssues: s.issues.filter(x => x.severity === "critical" && ["open", "in_progress"].includes(x.status)).length } });
  }
  function acknowledgeEvents(s, ids) { return transact(s, d => {
    const set = new Set((ids || []).map(String)); let count = 0;
    for (const event of d.outbox) if (set.has(event.id) && !event.delivered) { event.delivered = true; event.deliveredMonth = d.currentMonth; count++; }
    return { acknowledged: count, pending: d.outbox.filter(x => !x.delivered).length };
  }); }
  function getPendingEvents(s) { validateState(s); return clone(s.outbox.filter(x => !x.delivered)); }
  function exportState(s) { validateState(s); return JSON.stringify({ format: "vilarejo-executive", version: VERSION, state: s }); }
  function importState(raw) {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : clone(raw);
    assert(parsed && parsed.format === "vilarejo-executive" && parsed.version === VERSION && parsed.state, "Arquivo de Gabinete incompatível.", TypeError);
    validateState(parsed.state); return clone(parsed.state);
  }
  function migrateV1ToV2(old) {
    assert(old && old.version === "1.0.0" && Array.isArray(old.departments), "Estado v1 inválido.", TypeError);
    const s = createState({ startMonth: old.currentMonth || 0, executiveTitle: old.executive?.headOfGovernment || "Chefe do Executivo" });
    s.departments = old.departments.map(dep => ({ id: dep.id, name: dep.name, purpose: dep.purpose, status: dep.status === "merged" ? "merged" : dep.status === "closed" ? "inactive" : "active",
      parentId: null, secretaryId: null, goals: clone(dep.goals || []).map(g => ({ ...g, status: STATUSES.goal.includes(g.status) ? g.status : "in_progress", direction: "increase", evidence: [] })),
      budgetRequests: clone(dep.budgetRequests || []).map(r => ({ ...r, status: STATUSES.request.includes(r.status) ? r.status : "pending", category: "other", urgency: "normal", externalReference: null })),
      projects: [], createdMonth: dep.createdMonth || 0, closedMonth: null, mergedInto: dep.mergedInto || null }));
    s.people = (old.secretaries || []).map((p, i) => ({ id: p.id || `person-${i + 1}`, name: p.name, departmentId: p.departmentId, background: p.background || "", appointedMonth: p.appointedMonth || 0,
      dismissedMonth: p.dismissedMonth ?? null, status: p.status === "active" ? "active" : "dismissed", skills: Object.fromEntries(SKILLS.map(k => [k, clamp(p.skills?.[k] ?? 50)])),
      traits: { ambition: 50, pragmatism: 50, ideology: "centro" }, performance: { score: p.performance?.score ?? null, trend: "unrated", reviews: clone(p.performance?.notes || []) } }));
    for (const dep of s.departments) { const p = s.people.find(x => x.id === dep.secretaryId || (x.status === "active" && x.departmentId === dep.id)); dep.secretaryId = p && p.status === "active" ? p.id : null; }
    s.audit = clone(old.history || old.events || []).map((e, i) => ({ id: e.id || `migrated-${i + 1}`, type: e.type || "legacy.event", month: e.month || 0, payload: clone(e), delivered: true }));
    s.outbox = []; s.counters.person = s.people.length + 1; s.counters.event = s.audit.length + 1;
    const maxSuffix = (items, prefix) => items.reduce((m, x) => { const n = Number(String(x.id || "").match(new RegExp(`^${prefix}-(\\d+)$`))?.[1] || 0); return Math.max(m, n); }, 0);
    s.counters.goal = maxSuffix(s.departments.flatMap(x => x.goals), "goal") + 1;
    s.counters.request = maxSuffix(s.departments.flatMap(x => x.budgetRequests), "budget") + 1;
    validateState(s); return s;
  }
  function resetState(s, options = {}) { const fresh = createState(options); for (const k of Object.keys(s)) delete s[k]; Object.assign(s, fresh); return getSnapshot(s); }

  return Object.freeze({ VERSION, SCHEMA, DEFAULT_DEPARTMENTS: clone(DEPARTMENTS), STATUSES, createState, validateState, getSnapshot, resetState,
    addDepartment, appointSecretary, dismissSecretary, replaceSecretary, addGoal, updateGoal, requestBudget, decideBudget, registerBudgetExecution,
    createProject, updateProject, createMeeting, addMeetingDecision, createTask, updateTask, registerIssue, updateIssue, reviewSecretary, mergeDepartments, closeDepartment,
    advanceMonth, getPendingEvents, acknowledgeEvents, exportState, importState, migrateV1ToV2 });
});
