/** Converte linhas da tabela vinculos no mapa usado pelas páginas. */
export function parseVinculosFromRows(vData) {
  const map = {};
  if (!vData?.length) return map;

  const legado = vData.find((row) => row.data);
  if (legado?.data) Object.assign(map, legado.data);

  vData.forEach((row) => {
    if (!row.data && row.carreira_id && row.preparatorio_id) {
      if (!map[row.carreira_id]) map[row.carreira_id] = {};
      if (!map[row.carreira_id][row.preparatorio_id]) {
        map[row.carreira_id][row.preparatorio_id] = { modulos: {} };
      }
    }
  });

  return map;
}

/** Quantidade de preparatórios vinculados a uma carreira (formato legado ou atual). */
export function countPreparatoriosPorCarreira(carreiraId, vinculos) {
  const v = vinculos[carreiraId];
  if (!v) return 0;
  if (Array.isArray(v)) return v.length;
  return Object.keys(v).length;
}
