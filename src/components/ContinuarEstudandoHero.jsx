import React from 'react';
import {
  duracaoParaSegundos,
  formatarSegundos,
  formatarUltimoAcesso,
  rotuloNumeroAula,
} from '../utils/aulaDuracao';

const BRAND = '#E50914';
const BG_CARD = '#141414';
const BG_TAG = '#222';
const BORDER = '#333';
const TEXT = '#F5F5F5';
const TEXT_MUTED = '#888';
const TEXT_DIM = '#AAA';

function ContinuarEstudandoHero({
  item,
  preparatorio,
  onContinuar,
  onVerHistorico,
}) {
  if (!item?.aula) return null;

  const { aula, modulo, disciplina, progresso, indiceAula, totalAulasModulo } = item;
  const videoId = aula.video_id || aula.videoId;
  const thumb = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : preparatorio?.capa || null;

  const durTotal = duracaoParaSegundos(aula.duracao);
  const tempoAssistido = progresso?.tempo_assistido || 0;
  let pct = 0;
  if (durTotal > 0) {
    pct = Math.min(100, Math.round((tempoAssistido / durTotal) * 100));
  }
  if (progresso?.concluida) pct = 100;

  const tempoTxt = durTotal > 0
    ? `${formatarSegundos(tempoAssistido)} de ${formatarSegundos(durTotal)}`
    : formatarSegundos(tempoAssistido);

  const temProgresso = progresso && (tempoAssistido > 0 || progresso.ultimo_acesso);
  const labelBotao = temProgresso ? 'Continuar agora' : 'Começar agora';
  const rotuloAula = rotuloNumeroAula(indiceAula);

  return (
    <section style={styles.wrap}>
      <style>{`
        @media (max-width: 768px) {
          .continuar-estudando-card {
            grid-template-columns: 1fr !important;
          }
          .continuar-estudando-actions {
            flex-direction: column !important;
            align-items: stretch !important;
          }
        }
      `}</style>
      <h2 style={styles.sectionTitle}>Continuar estudando</h2>
      <div style={styles.card} className="continuar-estudando-card">
        <button
          type="button"
          style={styles.thumbArea}
          onClick={onContinuar}
          aria-label={labelBotao}
        >
          {thumb ? (
            <img src={thumb} alt="" style={styles.thumbImg} />
          ) : (
            <div style={styles.thumbPlaceholder}>▶</div>
          )}
          <div style={styles.thumbOverlay}>
            <span style={styles.playIcon}>▶</span>
          </div>
          <div style={styles.thumbProgressTrack}>
            <div style={{ ...styles.thumbProgressFill, width: `${pct}%` }} />
          </div>
        </button>

        <div style={styles.info}>
          <div style={styles.infoTop}>
            <span style={styles.tag}>{disciplina?.nome || 'Disciplina'}</span>
            {onVerHistorico && (
              <button type="button" style={styles.linkBtn} onClick={(e) => { e.stopPropagation(); onVerHistorico(); }}>
                Ver histórico completo
              </button>
            )}
          </div>

          {temProgresso ? (
            <p style={styles.parouEm}>
              <span style={styles.parouEmLabel}>Você parou em</span>{' '}
              <strong style={styles.parouEmStrong}>
                {rotuloAula}
                {totalAulasModulo ? ` de ${String(totalAulasModulo).padStart(2, '0')}` : ''}
              </strong>
              {modulo?.nome ? <span style={styles.parouEmMod}> · {modulo.nome}</span> : null}
            </p>
          ) : (
            <p style={styles.parouEm}>
              <span style={styles.parouEmLabel}>Próxima aula</span>{' '}
              <strong style={styles.parouEmStrong}>{rotuloAula}</strong>
            </p>
          )}

          <h3 style={styles.aulaTitle}>{aula.titulo}</h3>
          <p style={styles.prepName}>{preparatorio?.nome}</p>

          <div style={styles.progressRow}>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${pct}%` }} />
            </div>
            <span style={styles.pctLabel}>{pct}% concluído</span>
          </div>

          <div style={styles.metaGrid}>
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>⏱</span>
              <div>
                <div style={styles.metaValue}>{tempoTxt}</div>
                <div style={styles.metaLabel}>Tempo assistido nesta aula</div>
              </div>
            </div>
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>📅</span>
              <div>
                <div style={styles.metaValue}>
                  {progresso?.ultimo_acesso ? formatarUltimoAcesso(progresso.ultimo_acesso) : '—'}
                </div>
                <div style={styles.metaLabel}>Último acesso</div>
              </div>
            </div>
          </div>

          <div style={styles.actions} className="continuar-estudando-actions">
            <button type="button" style={styles.primaryBtn} onClick={onContinuar}>
              ▶ {labelBotao}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

const styles = {
  wrap: { marginBottom: '40px' },
  sectionTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: TEXT,
    margin: '0 0 20px',
    letterSpacing: '0.5px',
  },
  card: {
    display: 'grid',
    gridTemplateColumns: 'minmax(300px, 1.15fr) minmax(280px, 1fr)',
    gap: '28px',
    background: BG_CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
  },
  thumbArea: {
    position: 'relative',
    padding: 0,
    border: 'none',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    background: '#0A0A0A',
    aspectRatio: '16 / 9',
    width: '100%',
    alignSelf: 'start',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    minHeight: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
    color: '#444',
    background: '#0A0A0A',
  },
  thumbOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.4)',
    pointerEvents: 'none',
  },
  playIcon: {
    fontSize: '44px',
    color: TEXT,
    filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.8))',
  },
  thumbProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'rgba(255,255,255,0.12)',
    pointerEvents: 'none',
  },
  thumbProgressFill: {
    height: '100%',
    background: BRAND,
    transition: 'width 0.3s',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minHeight: '100%',
  },
  infoTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  tag: {
    background: BG_TAG,
    color: TEXT_DIM,
    border: `1px solid ${BORDER}`,
    fontSize: '10px',
    fontWeight: '700',
    padding: '5px 12px',
    borderRadius: '6px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: TEXT_MUTED,
    fontSize: '12px',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '4px 0',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  parouEm: { margin: '4px 0 0', fontSize: '13px', color: TEXT_DIM, lineHeight: 1.5 },
  parouEmLabel: { color: TEXT_MUTED },
  parouEmStrong: { color: TEXT, fontWeight: '800' },
  parouEmMod: { color: TEXT_MUTED, fontWeight: '500' },
  aulaTitle: { margin: 0, fontSize: '22px', fontWeight: '800', color: TEXT, lineHeight: 1.25 },
  prepName: { margin: 0, fontSize: '14px', color: TEXT_MUTED },
  progressRow: { display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px' },
  progressTrack: {
    flex: 1,
    height: '8px',
    background: '#2A2A2A',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', background: BRAND, borderRadius: '4px', transition: 'width 0.3s' },
  pctLabel: { fontSize: '13px', fontWeight: '700', color: TEXT, whiteSpace: 'nowrap' },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginTop: '4px',
  },
  metaItem: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  metaIcon: { fontSize: '16px', lineHeight: 1, opacity: 0.7 },
  metaValue: { fontSize: '14px', fontWeight: '600', color: TEXT },
  metaLabel: { fontSize: '11px', color: TEXT_MUTED, marginTop: '2px' },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 'auto',
    paddingTop: '8px',
  },
  primaryBtn: {
    padding: '14px 32px',
    background: BRAND,
    border: 'none',
    color: TEXT,
    borderRadius: '8px',
    fontWeight: '800',
    fontSize: '15px',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(229, 9, 20, 0.35)',
  },
};

export default ContinuarEstudandoHero;
