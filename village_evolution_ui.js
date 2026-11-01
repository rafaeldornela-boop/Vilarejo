function syncSocialEvolution(quiet=false, monthOverride=null){
 const engine=window.VilarejoEvolution;
 if(!engine||!S)return null;
 if(!S.socialEvolution)S.socialEvolution=engine.createState();
 const metrics=engine.readMetrics(S);
 const month=Number.isFinite(monthOverride)?monthOverride:(S.monthNumber||0);
 const result=engine.advance(S.socialEvolution,metrics,month);
 S.socialEvolution=result.state;
 if(!quiet&&typeof feed==="function")result.events.forEach(event=>feed(event.message));
 return S.socialEvolution;
}
function getSocialEvolutionSnapshot(){
 return S&&S.socialEvolution?JSON.parse(JSON.stringify(S.socialEvolution)):null;
}
function renderSocialEvolution(){
 const host=$("villageEvolutionContent");
 const engine=window.VilarejoEvolution;
 if(!host||!engine||!S)return;
 if(!S.socialEvolution)syncSocialEvolution(true,S.monthNumber||0);
 const view=engine.overview(S.socialEvolution);
 const metrics=view.metrics||{};
 const bulletin=view.bulletin||engine.buildBulletin(S.socialEvolution);
 const next=view.nextStage;
 const milestone=next?[
  `${metrics.population??"?"}/${next.population} moradores`,
  `${metrics.activeFirms??"?"}/${next.firms} atividades econômicas`,
  next.sectors>0?`${metrics.sectorCount??"?"}/${next.sectors} setores`:""
 ].filter(Boolean).join(" · "):"Todos os marcos de desenvolvimento foram alcançados.";
 const statusLabel={normal:"Normal",atencao:"Atenção",critica:"Crítico",sem_dados:"Sem dados"};
 const trendLabel={melhorando:"melhorando",piorando:"piorando",estavel:"estável",sem_historico:"histórico em formação"};
 const formatNeed=(item)=>{
  if(item.value==null)return "Indicador ainda não modelado";
  const value=item.id==="habitacao"||item.id==="infraestrutura"?`${Math.round(item.value*100)}% da capacidade`:`${(item.value*100).toFixed(1)}%`;
  return `${value} · ${trendLabel[item.trend]||"sem histórico"}`+(item.persistent?` · ${item.consecutiveMonths} meses` : "");
 };
 const needs=view.needs.filter(item=>item.level!=="sem_dados");
 const missing=view.needs.filter(item=>item.level==="sem_dados");
 const articles=bulletin.articles.slice(0,4).map(article=>`
  <article class="evo2-article evo2-${article.severity}">
   <div class="evo2-category">${article.category}</div>
   <h3>${article.title}</h3>
   <p>${article.summary}</p>
   ${article.persistence?`<p class="evo2-muted">${article.persistence}</p>`:""}
   ${article.recommendation?`<div class="evo2-recommendation"><b>Questão para o governo</b><span>${article.recommendation}</span></div>`:""}
  </article>`).join("");
 const institutionStatus={locked:"Aguardando requisitos",available:"Disponível para avaliação",planned:"Planejada",under_construction:"Em construção",ready_to_operate:"Aguardando equipe",operational:"Em funcionamento"};
 const institutions=view.institutions.filter(item=>item.type!=="base"&&item.type!=="capacidade_existente");
 const institutionRows=institutions.map(item=>{
  const blockers=(item.blockers||[]).slice(0,2).join(" ");
  return `<div class="evo2-institution"><div><b>${item.name}</b><span>${institutionStatus[item.lifecycle]||institutionStatus[item.availability]||item.lifecycle}</span></div>${blockers?`<p>${blockers}</p>`:""}</div>`;
 }).join("");
 const operational=view.operational.map(item=>`<span class="evo2-chip">${item.name}</span>`).join("");
 const headline=bulletin.headline||"Jornal do Vilarejo";
 host.innerHTML=`
  <div class="evo2-top">
   <div><span class="evo2-kicker">Edição ${String(bulletin.month||0).padStart(2,"0")} · Desenvolvimento local</span><div class="evo2-phase">${view.stage.label}</div></div>
   <div class="evo2-scale"><b>${metrics.population??"?"}</b><span>moradores</span><i>·</i><b>${metrics.activeFirms??"?"}</b><span>atividades</span></div>
  </div>
  <div class="evo2-progress"><b>Próximo marco: ${next?next.label:"concluído"}</b><span>${milestone}</span></div>
  <section class="evo2-paper">
   <div class="evo2-paper-head"><span>Jornal do Vilarejo</span><small>Resumo do fechamento mensal</small></div>
   <h3 class="evo2-headline">${headline}</h3>
   <p class="evo2-subhead">${bulletin.subhead||"Sem novos registros neste fechamento."}</p>
   <div class="evo2-articles">${articles||`<div class="evo2-quiet">Nenhuma pressão relevante foi identificada nos indicadores disponíveis neste fechamento.</div>`}</div>
  </section>
  <div class="evo2-two-col">
   <section class="evo2-section"><h3>Indicadores sociais</h3>
    ${needs.map(item=>`<div class="evo2-need"><div><b>${item.label}</b><span class="evo2-status evo2-${item.level}">${statusLabel[item.level]}</span></div><p>${formatNeed(item)}</p></div>`).join("")||`<p class="evo2-muted">Ainda não há indicadores sociais disponíveis.</p>`}
    ${missing.length?`<p class="evo2-data-note">Ainda sem medição: ${missing.map(item=>item.label).join(", ")}. A ausência de dados não é tratada como ausência de problema.</p>`:""}
   </section>
   <section class="evo2-section"><h3>Estruturas e serviços</h3>
    <div class="evo2-chips">${operational||"Nenhuma estrutura operacional registrada."}</div>
    <h4>Próximas possibilidades</h4>
    ${institutionRows||`<p class="evo2-muted">Nenhum novo serviço no catálogo.</p>`}
   </section>
  </div>
  <p class="evo2-foot">Avançar de fase não cria instituições automaticamente. Cada serviço exige necessidade observável, decisão, investimento, equipe e orçamento de manutenção.</p>
 `;
}
