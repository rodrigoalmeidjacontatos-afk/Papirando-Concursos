/** Converte duração da aula (segundos ou "mm:ss" / "hh:mm:ss") para segundos. */
export function duracaoParaSegundos(duracao) {
  if (duracao == null || duracao === '') return 0;
  if (typeof duracao === 'number' && !Number.isNaN(duracao)) return duracao;
  const str = String(duracao).trim();
  if (!str) return 0;
  if (!str.includes(':') && !Number.isNaN(Number(str))) return Number(str);
  const parts = str.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function formatarSegundos(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0));
  const horas = Math.floor(s / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  const segs = s % 60;
  if (horas > 0) {
    return `${horas}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
  }
  return `${minutos}:${String(segs).padStart(2, '0')}`;
}

export function formatarUltimoAcesso(iso) {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const diff = (hoje - dia) / (1000 * 60 * 60 * 24);
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `hoje, ${hora}`;
  if (diff === 1) return `ontem, ${hora}`;
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + `, ${hora}`;
}

/** Número da aula na lista ordenada do módulo (1-based). */
export function indiceAulaNoModulo(aula, aulasDoModulo) {
  const idx = aulasDoModulo.findIndex((a) => a.id === aula.id);
  return idx >= 0 ? idx + 1 : null;
}

export function rotuloNumeroAula(numero) {
  if (numero == null) return 'Aula —';
  return `Aula ${String(numero).padStart(2, '0')}`;
}
