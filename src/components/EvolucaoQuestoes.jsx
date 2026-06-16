import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export default function EvolucaoQuestoes({ userEmail }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodoSelecionado, setPeriodoSelecionado] = useState(7);
  const [disciplinaAberta, setDisciplinaAberta] = useState(null); // drill-down
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false); // modal de confirmação
  const [limpando, setLimpando] = useState(false);

  useEffect(() => {
    if (userEmail) fetchStats();
  }, [userEmail, periodoSelecionado]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: respostas, error } = await supabase
        .from('questoes_respostas')
        .select(`
          correta,
          created_at,
          alternativa_marcada,
          questoes (
            disciplina,
            assunto,
            banca,
            dificuldade
          )
        `)
        .eq('user_email', userEmail)
        .gte('created_at', new Date(Date.now() - periodoSelecionado * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!respostas || respostas.length === 0) {
        setStats({ vazio: true });
        setLoading(false);
        return;
      }

      const total = respostas.length;
      const acertos = respostas.filter(r => r.correta).length;
      const erros = total - acertos;
      const taxaAcerto = total > 0 ? Math.round((acertos / total) * 100) : 0;

      // Desempenho por disciplina + assuntos dentro de cada disciplina
      const porDisciplina = {};
      respostas.forEach(r => {
        const disc = r.questoes?.disciplina || 'Não informado';
        const assunto = r.questoes?.assunto || 'Não informado';
        if (!porDisciplina[disc]) porDisciplina[disc] = { acertos: 0, total: 0, assuntos: {} };
        porDisciplina[disc].total++;
        if (r.correta) porDisciplina[disc].acertos++;
        // Drill-down de assuntos
        if (!porDisciplina[disc].assuntos[assunto]) porDisciplina[disc].assuntos[assunto] = { acertos: 0, total: 0 };
        porDisciplina[disc].assuntos[assunto].total++;
        if (r.correta) porDisciplina[disc].assuntos[assunto].acertos++;
      });

      const rankDisciplinas = Object.entries(porDisciplina)
        .map(([nome, d]) => ({
          nome,
          acertos: d.acertos,
          total: d.total,
          taxa: Math.round((d.acertos / d.total) * 100),
          assuntos: Object.entries(d.assuntos)
            .map(([an, av]) => ({ nome: an, acertos: av.acertos, total: av.total, taxa: Math.round((av.acertos / av.total) * 100) }))
            .sort((a, b) => a.taxa - b.taxa) // pior desempenho primeiro
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Desempenho por banca
      const porBanca = {};
      respostas.forEach(r => {
        const banca = r.questoes?.banca || 'Não informado';
        if (!porBanca[banca]) porBanca[banca] = { acertos: 0, total: 0 };
        porBanca[banca].total++;
        if (r.correta) porBanca[banca].acertos++;
      });
      const rankBancas = Object.entries(porBanca)
        .map(([nome, d]) => ({ nome, ...d, taxa: Math.round((d.acertos / d.total) * 100) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Evolução diária
      const porDia = {};
      respostas.forEach(r => {
        const dia = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!porDia[dia]) porDia[dia] = { acertos: 0, total: 0 };
        porDia[dia].total++;
        if (r.correta) porDia[dia].acertos++;
      });
      const evolucaoDiaria = Object.entries(porDia).map(([dia, d]) => ({
        dia, taxa: Math.round((d.acertos / d.total) * 100), total: d.total, acertos: d.acertos
      }));

      setStats({ total, acertos, erros, taxaAcerto, rankDisciplinas, rankBancas, evolucaoDiaria });
    } catch (e) {
      console.error('Erro ao buscar stats de questões:', e);
    } finally {
      setLoading(false);
    }
  };

  const limparHistorico = async () => {
    setLimpando(true);
    try {
      const { error } = await supabase
        .from('questoes_respostas')
        .delete()
        .eq('user_email', userEmail);
      if (error) throw error;
      setConfirmandoLimpar(false);
      setDisciplinaAberta(null);
      setStats({ vazio: true });
    } catch (e) {
      alert('Erro ao limpar histórico: ' + e.message);
    } finally {
      setLimpando(false);
    }
  };

  // Gráfico de barras SVG
  const MiniBarChart = ({ data, height = 80 }) => {
    if (!data || data.length === 0) return null;
    const maxVal = Math.max(...data.map(d => d.total), 1);
    const barW = Math.max(20, Math.floor(260 / data.length) - 4);
    return (
      <svg width="100%" height={height + 30} viewBox={`0 0 ${data.length * (barW + 4)} ${height + 30}`} preserveAspectRatio="xMidYMid meet">
        {data.map((d, i) => {
          const bh = Math.max(4, Math.round((d.total / maxVal) * height));
          const x = i * (barW + 4);
          const cor = d.taxa >= 70 ? '#4CAF50' : d.taxa >= 50 ? '#FFC107' : '#E53935';
          return (
            <g key={i}>
              <rect x={x} y={height - bh} width={barW} height={bh} rx="3" fill={cor} opacity="0.85" />
              <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize="9" fill="#888">{d.dia}</text>
              <text x={x + barW / 2} y={height - bh - 4} textAnchor="middle" fontSize="9" fill="#FFF">{d.taxa}%</text>
            </g>
          );
        })}
      </svg>
    );
  };

  // Gráfico de rosca SVG
  const DonutChart = ({ acertos, erros }) => {
    const total = acertos + erros;
    if (total === 0) return null;
    const r = 45, cx = 60, cy = 60;
    const circunf = 2 * Math.PI * r;
    const pctAcertos = acertos / total;
    const dashAcertos = pctAcertos * circunf;
    const dashErros = circunf - dashAcertos;
    return (
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2A2A35" strokeWidth="14" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E53935" strokeWidth="14"
          strokeDasharray={`${dashErros} ${circunf}`} strokeDashoffset={0}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4CAF50" strokeWidth="14"
          strokeDasharray={`${dashAcertos} ${circunf}`} strokeDashoffset={-dashErros}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#FFF">{Math.round(pctAcertos * 100)}%</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#888">acerto</text>
      </svg>
    );
  };

  // Barra genérica
  const Barra = ({ nome, taxa, acertos, total, onClick, clickable }) => {
    const cor = taxa >= 70 ? '#4CAF50' : taxa >= 50 ? '#FFC107' : '#E53935';
    return (
      <div
        onClick={onClick}
        style={{
          marginBottom: '10px',
          cursor: clickable ? 'pointer' : 'default',
          backgroundColor: clickable ? 'rgba(255,255,255,0.02)' : 'transparent',
          borderRadius: '8px',
          padding: clickable ? '8px' : '0',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => clickable && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
        onMouseLeave={e => clickable && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {clickable && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
            <span style={{ fontSize: '13px', color: '#DDD', fontWeight: '600', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#888' }}>{acertos}/{total}</span>
            <span style={{ fontSize: '13px', color: cor, fontWeight: 'bold', minWidth: '36px', textAlign: 'right' }}>{taxa}%</span>
          </div>
        </div>
        <div style={{ height: '6px', backgroundColor: '#2A2A35', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${taxa}%`, backgroundColor: cor, borderRadius: '3px', transition: 'width 0.6s ease', boxShadow: `0 0 8px ${cor}66` }} />
        </div>
      </div>
    );
  };

  const card = (children, style = {}) => (
    <div style={{ backgroundColor: 'rgba(20, 20, 25, 0.85)', border: '1px solid #1C1C2A', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', ...style }}>
      {children}
    </div>
  );

  const periodoBtns = [{ label: 'Hoje', value: 1 }, { label: '7 dias', value: 7 }, { label: '30 dias', value: 30 }, { label: '90 dias', value: 90 }];

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
      Carregando seu desempenho...
    </div>
  );

  if (!stats || stats.vazio) return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
      <p style={{ fontSize: '16px', color: '#888' }}>Nenhuma questão respondida ainda.</p>
      <p style={{ fontSize: '13px', color: '#555' }}>Acesse a aba <strong style={{ color: '#F0AD4E' }}>Questões</strong> e comece a praticar!</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '8px' }}>

      {/* MODAL DE CONFIRMAÇÃO - LIMPAR HISTÓRICO */}
      {confirmandoLimpar && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#1A1A22', border: '1px solid #E5391455',
            borderRadius: '20px', padding: '40px', maxWidth: '400px', width: '90%',
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ color: '#FFF', fontSize: '20px', fontWeight: '800', margin: '0 0 12px' }}>Limpar Histórico de Questões</h3>
            <p style={{ color: '#AAA', fontSize: '14px', lineHeight: '1.7', margin: '0 0 8px' }}>
              Essa ação irá <strong style={{ color: '#E53935' }}>apagar permanentemente</strong> todo o seu histórico de questões respondidas.
            </p>
            <p style={{ color: '#666', fontSize: '13px', margin: '0 0 28px' }}>
              Seus acertos, erros e estatísticas serão zerados. Essa ação <strong style={{ color: '#E53935' }}>não pode ser desfeita</strong>.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmandoLimpar(false)}
                style={{ backgroundColor: 'transparent', border: '1px solid #444', color: '#AAA', padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}
              >
                Cancelar
              </button>
              <button
                onClick={limparHistorico}
                disabled={limpando}
                style={{ backgroundColor: '#E53935', border: 'none', color: '#FFF', padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', opacity: limpando ? 0.7 : 1 }}
              >
                {limpando ? 'Limpando...' : 'Sim, Limpar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TÍTULO + FILTRO PERÍODO + LIMPAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#FFF', fontWeight: '800', letterSpacing: '0.5px' }}>
          🎯 Desempenho em Questões
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {periodoBtns.map(p => (
            <button key={p.value} onClick={() => setPeriodoSelecionado(p.value)} style={{
              backgroundColor: periodoSelecionado === p.value ? '#F0AD4E' : 'transparent',
              color: periodoSelecionado === p.value ? '#000' : '#888',
              border: `1px solid ${periodoSelecionado === p.value ? '#F0AD4E' : '#333'}`,
              padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
              fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s'
            }}>{p.label}</button>
          ))}
          <button
            onClick={() => setConfirmandoLimpar(true)}
            style={{
              backgroundColor: 'transparent', border: '1px solid #E5393544',
              color: '#E53935', padding: '6px 14px', borderRadius: '999px',
              cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E5393522'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            🗑️ Limpar Histórico
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Total Respondidas', valor: stats.total, cor: '#2196F3', icon: '📝' },
          { label: 'Acertos', valor: stats.acertos, cor: '#4CAF50', icon: '✅' },
          { label: 'Erros', valor: stats.erros, cor: '#E53935', icon: '❌' },
          { label: 'Taxa de Acerto', valor: `${stats.taxaAcerto}%`, cor: stats.taxaAcerto >= 70 ? '#4CAF50' : stats.taxaAcerto >= 50 ? '#FFC107' : '#E53935', icon: '🏆' },
        ].map((item, i) => (
          <div key={i} style={{ backgroundColor: 'rgba(20,20,25,0.85)', border: `1px solid ${item.cor}33`, borderRadius: '14px', padding: '20px', textAlign: 'center', boxShadow: `0 4px 20px ${item.cor}22` }}>
            <div style={{ fontSize: '28px', marginBottom: '4px' }}>{item.icon}</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: item.cor, lineHeight: 1 }}>{item.valor}</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* GRÁFICO ROSCA + EVOLUÇÃO DIÁRIA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '20px', alignItems: 'stretch' }}>
        {card(
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', height: '100%' }}>
            <h4 style={{ margin: 0, fontSize: '13px', color: '#AAA', textTransform: 'uppercase', letterSpacing: '1px' }}>Acertos vs Erros</h4>
            <DonutChart acertos={stats.acertos} erros={stats.erros} />
            <div style={{ display: 'flex', gap: '16px' }}>
              <span style={{ fontSize: '12px', color: '#4CAF50' }}>● Acertos ({stats.acertos})</span>
              <span style={{ fontSize: '12px', color: '#E53935' }}>● Erros ({stats.erros})</span>
            </div>
          </div>,
          { minWidth: '200px' }
        )}
        {card(
          <>
            <h4 style={{ margin: '0 0 16px', fontSize: '13px', color: '#AAA', textTransform: 'uppercase', letterSpacing: '1px' }}>Evolução Diária</h4>
            {stats.evolucaoDiaria.length > 1
              ? <MiniBarChart data={stats.evolucaoDiaria} height={80} />
              : <p style={{ color: '#555', fontSize: '13px' }}>Responda questões em dias diferentes para ver a evolução.</p>
            }
          </>
        )}
      </div>

      {/* DESEMPENHO POR DISCIPLINA (CLICÁVEL) + BANCA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* CARD DISCIPLINAS COM DRILL-DOWN */}
        {card(
          <>
            <h4 style={{ margin: '0 0 4px', fontSize: '13px', color: '#AAA', textTransform: 'uppercase', letterSpacing: '1px' }}>Por Disciplina</h4>
            <p style={{ fontSize: '11px', color: '#555', margin: '0 0 16px' }}>Clique em uma disciplina para ver os assuntos</p>
            {stats.rankDisciplinas.length === 0
              ? <p style={{ color: '#555', fontSize: '13px' }}>Sem dados ainda.</p>
              : stats.rankDisciplinas.map((d, i) => (
                <div key={i}>
                  <Barra
                    nome={d.nome}
                    taxa={d.taxa}
                    acertos={d.acertos}
                    total={d.total}
                    clickable={true}
                    onClick={() => setDisciplinaAberta(disciplinaAberta === d.nome ? null : d.nome)}
                  />

                  {/* DRILL-DOWN: Assuntos da disciplina */}
                  {disciplinaAberta === d.nome && (
                    <div style={{
                      backgroundColor: '#0F0F15',
                      border: '1px solid #2A2A35',
                      borderRadius: '10px',
                      padding: '16px',
                      marginBottom: '12px',
                      animation: 'fadeIn 0.2s'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontSize: '12px', color: '#F0AD4E', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📚 Assuntos — {d.nome}
                        </span>
                        <span style={{ fontSize: '11px', color: '#555' }}>Pior desempenho primeiro</span>
                      </div>
                      {d.assuntos.length === 0
                        ? <p style={{ color: '#555', fontSize: '12px' }}>Sem assuntos registrados.</p>
                        : d.assuntos.map((a, ai) => (
                          <Barra key={ai} nome={a.nome} taxa={a.taxa} acertos={a.acertos} total={a.total} clickable={false} />
                        ))
                      }
                    </div>
                  )}
                </div>
              ))
            }
          </>
        )}

        {/* CARD BANCAS */}
        {card(
          <>
            <h4 style={{ margin: '0 0 20px', fontSize: '13px', color: '#AAA', textTransform: 'uppercase', letterSpacing: '1px' }}>Por Banca</h4>
            {stats.rankBancas.length === 0
              ? <p style={{ color: '#555', fontSize: '13px' }}>Sem dados ainda.</p>
              : stats.rankBancas.map((d, i) => <Barra key={i} nome={d.nome} taxa={d.taxa} acertos={d.acertos} total={d.total} clickable={false} />)
            }
          </>
        )}
      </div>

    </div>
  );
}
