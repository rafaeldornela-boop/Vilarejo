/**
 * VILAREJO | INFRASTRUCTURE CATALOG
 * Catálogo visual. Não contém custos, produção, empregos ou efeitos econômicos.
 * Esses dados só poderão existir após contratos próprios com os módulos de domínio.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldInfrastructureCatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const entries = [
    ["house", "Casa", "Moradia", "Residência individual", "residential", 92, 78, 0x9b7659],
    ["apartment", "Conjunto habitacional", "Moradia", "Edificação residencial vertical", "residential", 118, 124, 0x9a8a78],
    ["market", "Mercado", "Comércio", "Centro de abastecimento comercial", "commercial", 112, 86, 0xb9854e],
    ["warehouse", "Armazém", "Comércio", "Galpão de armazenamento", "commercial", 128, 88, 0x8e8979],
    ["town_hall", "Prefeitura", "Administração", "Centro administrativo municipal", "civic", 132, 112, 0x8b9a78],
    ["school", "Escola", "Educação", "Unidade de ensino", "public", 124, 92, 0x6f91a2],
    ["hospital", "Hospital", "Saúde", "Unidade hospitalar", "public", 142, 108, 0x6b9b94],
    ["fire_station", "Corpo de bombeiros", "Segurança", "Quartel de resposta a emergências", "public", 116, 94, 0xc36c52],
    ["police_station", "Posto policial", "Segurança", "Unidade policial", "public", 104, 84, 0x647f9b],
    ["factory", "Fábrica", "Indústria", "Complexo industrial", "industry", 146, 112, 0x8c8b84],
    ["lumber_mill", "Serraria", "Indústria", "Unidade de processamento de madeira", "industry", 132, 92, 0x9b7954],
    ["water_treatment", "Estação de tratamento de água", "Saneamento", "Tratamento e distribuição de água", "utility", 144, 100, 0x5798a6],
    ["sewage_plant", "Estação de esgoto", "Saneamento", "Tratamento de efluentes", "utility", 144, 100, 0x718b7b],
    ["hydroelectric_dam", "Usina hidrelétrica", "Energia", "Barragem, vertedouro e casa de força", "energy", 190, 128, 0x4d8eaa],
    ["nuclear_plant", "Usina nuclear", "Energia", "Central nuclear com torres de resfriamento", "energy", 178, 144, 0x8d9b8c],
    ["thermal_plant", "Usina termelétrica", "Energia", "Central de geração termelétrica", "energy", 164, 122, 0x98765e],
    ["solar_farm", "Parque solar", "Energia", "Conjunto de painéis fotovoltaicos", "energy", 160, 74, 0x5d8294],
    ["wind_farm", "Parque eólico", "Energia", "Conjunto de aerogeradores", "energy", 164, 150, 0x8aa3a0],
    ["gold_mine", "Mina de ouro", "Extração", "Mina com galeria, esteira e pilhas de minério", "extraction", 158, 120, 0xb28b45],
    ["iron_mine", "Mina de ferro", "Extração", "Mina e área de beneficiamento mineral", "extraction", 158, 120, 0x8b7062],
    ["oil_field", "Campo de petróleo", "Extração", "Poços e unidades de bombeamento", "extraction", 160, 128, 0x6f7774],
    ["oil_refinery", "Refinaria", "Indústria", "Parque de tanques e torres de processamento", "industry", 174, 132, 0x8a887e],
    ["port", "Porto", "Logística", "Terminal de cargas e docas", "logistics", 172, 112, 0x6d8e9a],
    ["rail_station", "Estação ferroviária", "Logística", "Terminal ferroviário", "logistics", 140, 94, 0x8b8173],
    ["airport", "Aeroporto", "Logística", "Terminal e pista ilustrativos", "logistics", 190, 110, 0x87949a],
    ["landfill", "Aterro sanitário", "Saneamento", "Área de disposição e manejo de resíduos", "utility", 154, 100, 0x8b896d],
    ["greenhouse", "Estufa agrícola", "Agropecuária", "Cultivo protegido", "agriculture", 124, 78, 0x6d9871]
  ];

  const catalog = entries.map(row => Object.freeze({
    type: row[0], label: row[1], category: row[2], description: row[3],
    group: row[4], width: row[5], height: row[6], color: row[7],
    visualOnly: true
  }));

  const byType = Object.create(null);
  catalog.forEach(item => { byType[item.type] = item; });

  function get(type) { return byType[String(type)] || null; }
  function list(group) {
    return catalog.filter(item => !group || item.group === group);
  }

  return Object.freeze({
    version: "1.0.0",
    items: Object.freeze(catalog),
    get,
    list,
    groups: Object.freeze(["residential", "commercial", "civic", "public", "industry", "utility", "energy", "extraction", "logistics", "agriculture"])
  });
});
