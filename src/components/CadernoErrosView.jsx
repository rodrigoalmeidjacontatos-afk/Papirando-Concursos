import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import QuestaoCard from './QuestaoCard';

export default function CadernoErrosView({ userEmail, userId }) {
  const navigate = useNavigate();

  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modoRefazer, setModoRefazer] = useState(false);
  const [questaoRefazendoIndex, setQuestaoRefazendoIndex] = useState(0);

  // Filtros
  const [filtroDisciplina, setFiltroDisciplina] = useState('');
  const [filtroAssunto, setFiltroAssunto] = useState('');
  const [filtroBanca, setFiltroBanca] = useState('');
  const [filtroTipoErro, setFiltroTipoErro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos', 'revisar_hoje', 'pendente', 'em_revisao', 'dominada'

  // Edição rápida de anotação
  const [editandoAnotacaoId, setEditandoAnotacaoId] = useState(null);
  const [textoAnotacaoTemp, setTextoAnotacaoTemp] = useState('');
  const [tipoErroTemp, setTipoErroTemp] = useState('');
  const [salvandoId, setSalvandoId] = useState(null);

  // Questão expandida para refazer inline
  const [refazendoId, setRefazendoId] = useState(null);

  const fetchCaderno = useCallback(async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Busca os itens do caderno de erros
      const { data: cadernoData, error: errCaderno } = await supabase
        .from('caderno_erros')
        .select('*')
        .eq('user_email', userEmail)
        .order('data_erro', { ascending: false });

      if (errCaderno) throw errCaderno;

      if (!cadernoData || cadernoData.length === 0) {
        setItens([]);
        setLoading(false);
        return;
      }

      // 2. Busca os dados completos das questões
      const questaoIds = [...new Set(cadernoData.map(c => c.questao_id).filter(Boolean))];
      let questoesMap = {};
      if (questaoIds.length > 0) {
        const { data: questoesData } = await supabase
          .from('questoes')
          .select('*')
          .in('id', questaoIds);

        if (questoesData) {
          questoesData.forEach(q => {
            questoesMap[q.id] = q;
          });
        }
      }

      // 3. Mescla
      const mesclados = cadernoData.map(item => ({
        ...item,
        questao: questoesMap[item.questao_id] || null
      }));

      setItens(mesclados);
    } catch (err) {
      console.error('Erro ao buscar Caderno de Erros:', err);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchCaderno();
  }, [fetchCaderno]);

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const total = itens.length;
    const agora = new Date();

    const revisarHoje = itens.filter(item => {
      if (item.status === 'dominada') return false;
      if (!item.proxima_revisao) return true;
      return new Date(item.proxima_revisao) <= agora;
    }).length;

    const dominadas = itens.filter(i => i.status === 'dominada').length;
    const pendentes = itens.filter(i => i.status === 'pendente' || !i.status).length;
    const emRevisao = itens.filter(i => i.status === 'em_revisao').length;

    // Erros por Disciplina
    const porDisciplina = {};
    itens.forEach(i => {
      const disc = i.questao?.disciplina || 'Sem disciplina';
      porDisciplina[disc] = (porDisciplina[disc] || 0) + 1;
    });

    // Erros por Tipo de Erro
    const porTipo = {};
    itens.forEach(i => {
      const t = i.tipo_erro || 'Falta de conhecimento';
      porTipo[t] = (porTipo[t] || 0) + 1;
    });

    return { total, revisarHoje, dominadas, pendentes, emRevisao, porDisciplina, porTipo };
  }, [itens]);

  // Lista filtrada
  const itensFiltrados = useMemo(() => {
    const agora = new Date();
    return itens.filter(item => {
      if (filtroDisciplina && item.questao?.disciplina !== filtroDisciplina) return false;
      if (filtroAssunto && item.questao?.assunto !== filtroAssunto) return false;
      if (filtroBanca && item.questao?.banca !== filtroBanca) return false;
      if (filtroTipoErro && item.tipo_erro !== filtroTipoErro) return false;

      if (filtroStatus === 'revisar_hoje') {
        if (item.status === 'dominada') return false;
        if (!item.proxima_revisao) return true;
        return new Date(item.proxima_revisao) <= agora;
      }
      if (filtroStatus === 'dominada') return item.status === 'dominada';
      if (filtroStatus === 'pendente') return item.status === 'pendente' || !item.status;
      if (filtroStatus === 'em_revisao') return item.status === 'em_revisao';

      return true;
    });
  }, [itens, filtroDisciplina, filtroAssunto, filtroBanca, filtroTipoErro, filtroStatus]);

  // Opções para os filtros
  const opcoesFiltro = useMemo(() => {
    const discs = new Set();
    const ass = new Set();
    const bancas = new Set();

    itens.forEach(i => {
      if (i.questao?.disciplina) discs.add(i.questao.disciplina);
      if (i.questao?.assunto) ass.add(i.questao.assunto);
      if (i.questao?.banca) bancas.add(i.questao.banca);
    });

    return {
      disciplinas: Array.from(discs).sort(),
      assuntos: Array.from(ass).sort(),
      bancas: Array.from(bancas).sort()
    };
  }, [itens]);

  // Ações no item
  const salvarAnotacao = async (itemId) => {
    setSalvandoId(itemId);
    try {
      const { error } = await supabase
        .from('caderno_erros')
        .update({
          anotacao: textoAnotacaoTemp,
          tipo_erro: tipoErroTemp,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;

      setItens(prev => prev.map(item => item.id === itemId ? {
        ...item,
        anotacao: textoAnotacaoTemp,
        tipo_erro: tipoErroTemp
      } : item));

      setEditandoAnotacaoId(null);
    } catch (e) {
      alert('Erro ao salvar anotação: ' + e.message);
    } finally {
      setSalvandoId(null);
    }
  };

  const marcarComoDominada = async (itemId, dominadaAtual) => {
    const novoStatus = dominadaAtual ? 'pendente' : 'dominada';
    try {
      const { error } = await supabase
        .from('caderno_erros')
        .update({
          status: novoStatus,
          acertos_seguidos: novoStatus === 'dominada' ? 3 : 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;

      setItens(prev => prev.map(item => item.id === itemId ? {
        ...item,
        status: novoStatus,
        acertos_seguidos: novoStatus === 'dominada' ? 3 : 0
      } : item));
    } catch (e) {
      alert('Erro ao alterar status: ' + e.message);
    }
  };

  const removerDoCaderno = async (itemId) => {
    if (!window.confirm('Deseja remover esta questão do seu Caderno de Erros?')) return;
    try {
      const { error } = await supabase
        .from('caderno_erros')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setItens(prev => prev.filter(item => item.id !== itemId));
    } catch (e) {
      alert('Erro ao remover: ' + e.message);
    }
  };

  const abrirEdicaoAnotacao = (item) => {
    setEditandoAnotacaoId(item.id);
    setTextoAnotacaoTemp(item.anotacao || '');
    setTipoErroTemp(item.tipo_erro || 'Falta de conhecimento');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* CARDS DE RESUMO SUPERIOR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        
        <div style={{ ...cardResumoStyle, border: '1px solid #E5393544', boxShadow: '0 4px 20px #E5393515' }}>
          <span style={{ fontSize: '28px' }}>📖</span>
          <div>
            <div style={{ fontSize: '26px', fontWeight: '900', color: '#E53935' }}>{stats.total}</div>
            <div style={cardLabelStyle}>Total no Caderno</div>
          </div>
        </div>

        <div 
          onClick={() => setFiltroStatus(filtroStatus === 'revisar_hoje' ? 'todos' : 'revisar_hoje')}
          style={{ 
            ...cardResumoStyle, 
            border: filtroStatus === 'revisar_hoje' ? '2px solid #FFD700' : '1px solid #FFD70044', 
            boxShadow: '0 4px 20px #FFD70015',
            cursor: 'pointer',
            background: filtroStatus === 'revisar_hoje' ? 'rgba(255, 215, 0, 0.1)' : cardResumoStyle.background
          }}
        >
          <span style={{ fontSize: '28px' }}>⏰</span>
          <div>
            <div style={{ fontSize: '26px', fontWeight: '900', color: '#FFD700' }}>{stats.revisarHoje}</div>
            <div style={cardLabelStyle}>Revisar Hoje (Espaçada)</div>
          </div>
        </div>

        <div 
          onClick={() => setFiltroStatus(filtroStatus === 'em_revisao' ? 'todos' : 'em_revisao')}
          style={{ 
            ...cardResumoStyle, 
            border: filtroStatus === 'em_revisao' ? '2px solid #2196F3' : '1px solid #2196F344', 
            boxShadow: '0 4px 20px #2196F315',
            cursor: 'pointer',
            background: filtroStatus === 'em_revisao' ? 'rgba(33, 150, 243, 0.1)' : cardResumoStyle.background
          }}
        >
          <span style={{ fontSize: '28px' }}>🔄</span>
          <div>
            <div style={{ fontSize: '26px', fontWeight: '900', color: '#2196F3' }}>{stats.emRevisao}</div>
            <div style={cardLabelStyle}>Em Revisão</div>
          </div>
        </div>

        <div 
          onClick={() => setFiltroStatus(filtroStatus === 'dominada' ? 'todos' : 'dominada')}
          style={{ 
            ...cardResumoStyle, 
            border: filtroStatus === 'dominada' ? '2px solid #4CAF50' : '1px solid #4CAF5044', 
            boxShadow: '0 4px 20px #4CAF5015',
            cursor: 'pointer',
            background: filtroStatus === 'dominada' ? 'rgba(76, 175, 80, 0.1)' : cardResumoStyle.background
          }}
        >
          <span style={{ fontSize: '28px' }}>🏆</span>
          <div>
            <div style={{ fontSize: '26px', fontWeight: '900', color: '#4CAF50' }}>{stats.dominadas}</div>
            <div style={cardLabelStyle}>Dominadas (3+ Acertos)</div>
          </div>
        </div>

      </div>

      {/* ALERTA DE REVISÃO DO DIA SE HOUVER */}
      {stats.revisarHoje > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(255, 152, 0, 0.15) 0%, rgba(229, 9, 20, 0.1) 100%)',
          border: '1px solid #FF980088',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🔥</span>
            <div>
              <strong style={{ color: '#FFD700', fontSize: '15px' }}>Você tem {stats.revisarHoje} questão(ões) agendada(s) para revisar hoje!</strong>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#AAA' }}>A repetição espaçada (1d, 7d, 30d) garante fixação profunda na memória de longo prazo.</p>
            </div>
          </div>
          <button
            onClick={() => {
              setFiltroStatus('revisar_hoje');
              setModoRefazer(true);
              setQuestaoRefazendoIndex(0);
            }}
            style={{
              backgroundColor: '#F0AD4E',
              color: '#000',
              fontWeight: '900',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            ▶ Refazer Revisões de Hoje
          </button>
        </div>
      )}

      {/* GRÁFICOS DE PONTOS FRACOS (DISCIPLINA & TIPO DE ERRO) */}
      {itens.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* Gráfico Erros por Disciplina */}
          <div style={sectionCardStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📊 Erros por Disciplina (Onde você mais erra)
            </h3>
            {Object.entries(stats.porDisciplina).map(([disc, qtd]) => {
              const pct = Math.round((qtd / stats.total) * 100);
              return (
                <div key={disc} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: '#DDD', fontWeight: '600' }}>{disc}</span>
                    <span style={{ color: '#E53935', fontWeight: 'bold' }}>{qtd} ({pct}%)</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#2A2A35', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#E53935', borderRadius: '3px', transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gráfico Diagnóstico do Tipo de Erro */}
          <div style={sectionCardStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🧠 Diagnóstico do Tipo de Erro
            </h3>
            {Object.entries(stats.porTipo).map(([tipo, qtd]) => {
              const pct = Math.round((qtd / stats.total) * 100);
              const cores = {
                'Falta de conhecimento': '#F44336',
                'Falta de atenção': '#FF9800',
                'Interpretação': '#2196F3',
                'Confusão de conceitos': '#9C27B0',
                'Chute': '#FFC107',
                'Tempo': '#00BCD4'
              };
              const cor = cores[tipo] || '#9E9E9E';
              return (
                <div key={tipo} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: '#DDD', fontWeight: '600' }}>{tipo}</span>
                    <span style={{ color: cor, fontWeight: 'bold' }}>{qtd} ({pct}%)</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#2A2A35', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: cor, borderRadius: '3px', transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* BARRA DE FILTROS + BOTÃO REFAZER CADERNO */}
      <div style={{ backgroundColor: '#1E1E24', padding: '20px', borderRadius: '12px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>
            🔍 Filtrar Questões do Caderno ({itensFiltrados.length} encontradas)
          </span>
          {itensFiltrados.length > 0 && !modoRefazer && (
            <button
              onClick={() => {
                setModoRefazer(true);
                setQuestaoRefazendoIndex(0);
              }}
              style={{
                backgroundColor: '#4CAF50',
                color: '#FFF',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ▶ Refazer Estas Questões ({itensFiltrados.length})
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={selectFilterStyle}>
            <option value="todos">Todos os Status</option>
            <option value="revisar_hoje">⏰ Revisar Hoje</option>
            <option value="pendente">⏳ Pendentes</option>
            <option value="em_revisao">🔄 Em Revisão</option>
            <option value="dominada">🏆 Dominadas</option>
          </select>

          <select value={filtroDisciplina} onChange={e => setFiltroDisciplina(e.target.value)} style={selectFilterStyle}>
            <option value="">Todas as Disciplinas</option>
            {opcoesFiltro.disciplinas.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select value={filtroAssunto} onChange={e => setFiltroAssunto(e.target.value)} style={selectFilterStyle}>
            <option value="">Todos os Assuntos</option>
            {opcoesFiltro.assuntos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={filtroBanca} onChange={e => setFiltroBanca(e.target.value)} style={selectFilterStyle}>
            <option value="">Todas as Bancas</option>
            {opcoesFiltro.bancas.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select value={filtroTipoErro} onChange={e => setFiltroTipoErro(e.target.value)} style={selectFilterStyle}>
            <option value="">Todos os Tipos de Erro</option>
            <option value="Falta de conhecimento">Falta de conhecimento</option>
            <option value="Falta de atenção">Falta de atenção</option>
            <option value="Interpretação">Interpretação</option>
            <option value="Confusão de conceitos">Confusão de conceitos</option>
            <option value="Chute">Chute</option>
            <option value="Tempo">Tempo</option>
          </select>

          {(filtroDisciplina || filtroAssunto || filtroBanca || filtroTipoErro || filtroStatus !== 'todos') && (
            <button
              onClick={() => {
                setFiltroDisciplina('');
                setFiltroAssunto('');
                setFiltroBanca('');
                setFiltroTipoErro('');
                setFiltroStatus('todos');
              }}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #555',
                color: '#AAA',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '10px'
              }}
            >
              Limpar Filtros
            </button>
          )}

        </div>

      </div>

      {/* SESSÃO MODO REFAZER (FOCADO) */}
      {modoRefazer && itensFiltrados.length > 0 && (
        <div style={{
          backgroundColor: '#1A1A22',
          border: '2px solid #4CAF50',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(76, 175, 80, 0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span style={{ backgroundColor: '#4CAF50', color: '#FFF', fontSize: '11px', fontWeight: '900', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                Modo de Revisão / Refazer
              </span>
              <h3 style={{ margin: '8px 0 0', fontSize: '18px', color: '#FFF' }}>
                Questão {questaoRefazendoIndex + 1} de {itensFiltrados.length}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                disabled={questaoRefazendoIndex === 0}
                onClick={() => setQuestaoRefazendoIndex(prev => prev - 1)}
                style={{
                  backgroundColor: questaoRefazendoIndex === 0 ? '#333' : '#444',
                  color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: questaoRefazendoIndex === 0 ? 'not-allowed' : 'pointer', fontSize: '13px'
                }}
              >
                ◀ Anterior
              </button>
              <button
                disabled={questaoRefazendoIndex >= itensFiltrados.length - 1}
                onClick={() => setQuestaoRefazendoIndex(prev => prev + 1)}
                style={{
                  backgroundColor: questaoRefazendoIndex >= itensFiltrados.length - 1 ? '#333' : '#2196F3',
                  color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: questaoRefazendoIndex >= itensFiltrados.length - 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold'
                }}
              >
                Próxima ▶
              </button>
              <button
                onClick={() => setModoRefazer(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #E53935',
                  color: '#E53935', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
                }}
              >
                Fechar Sessão ✕
              </button>
            </div>
          </div>

          {itensFiltrados[questaoRefazendoIndex]?.questao ? (
            <QuestaoCard
              key={itensFiltrados[questaoRefazendoIndex].questao.id}
              questao={itensFiltrados[questaoRefazendoIndex].questao}
              numero={questaoRefazendoIndex + 1}
              userEmail={userEmail}
              userId={userId}
              onRespondeu={async () => {
                await fetchCaderno();
              }}
            />
          ) : (
            <p style={{ color: '#888' }}>Detalhes desta questão não disponíveis.</p>
          )}
        </div>
      )}

      {/* LISTAGEM DE QUESTÕES DO CADERNO */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#888' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📖</div>
          Carregando seu Caderno de Erros...
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: '#1E1E24', borderRadius: '16px', border: '1px solid #333' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{ color: '#FFF', fontSize: '20px', margin: '0 0 8px' }}>
            {itens.length === 0 ? 'Seu Caderno de Erros está vazio!' : 'Nenhuma questão encontrada para os filtros atuais.'}
          </h3>
          <p style={{ color: '#888', maxWidth: '420px', margin: '0 auto 20px', fontSize: '14px', lineHeight: 1.6 }}>
            {itens.length === 0 
              ? 'Sempre que você errar uma questão ou marcá-la no chute, ela entrará automaticamente aqui para sua revisão.'
              : 'Tente alterar os filtros acima ou limpar os critérios selecionados.'}
          </p>
          {itens.length === 0 && (
            <button
              onClick={() => navigate('/questoes')}
              style={{
                backgroundColor: '#E50914',
                color: '#FFF',
                border: 'none',
                padding: '12px 28px',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Bora Resolver Questões!
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {itensFiltrados.map((item, idx) => {
            const q = item.questao;
            const isDominada = item.status === 'dominada';
            const emEdicao = editandoAnotacaoId === item.id;
            const emRefazerInline = refazendoId === item.id;

            return (
              <div key={item.id} style={{
                backgroundColor: '#1E1E24',
                border: isDominada ? '1px solid #4CAF5044' : '1px solid #333',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: isDominada ? '0 4px 16px rgba(76,175,80,0.1)' : '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'border-color 0.2s'
              }}>
                
                {/* CABEÇALHO DO ITEM */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #2A2A35', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{
                      backgroundColor: '#E5393522',
                      border: '1px solid #E5393566',
                      color: '#FF8A80',
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}>
                      {item.qtd_erros || 1}x Erro(s)
                    </span>

                    <span style={{
                      backgroundColor: isDominada ? '#4CAF5022' : '#2196F322',
                      border: `1px solid ${isDominada ? '#4CAF5066' : '#2196F366'}`,
                      color: isDominada ? '#81C784' : '#64B5F6',
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}>
                      {isDominada ? '🏆 Dominada' : `Etapa ${item.etapa_revisao || 0}/3 (${item.acertos_seguidos || 0} acertos seguidos)`}
                    </span>

                    <span style={{ fontSize: '13px', color: '#BBB' }}>
                      {q?.disciplina} {q?.assunto ? `• ${q.assunto}` : ''} {q?.banca ? `• ${q.banca}` : ''} {q?.ano ? `(${q.ano})` : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#888' }}>
                    <span>Último erro: {new Date(item.data_erro).toLocaleDateString('pt-BR')}</span>
                    {item.proxima_revisao && !isDominada && (
                      <span style={{
                        color: new Date(item.proxima_revisao) <= new Date() ? '#FFD700' : '#888',
                        fontWeight: new Date(item.proxima_revisao) <= new Date() ? 'bold' : 'normal'
                      }}>
                        • Próx. revisão: {new Date(item.proxima_revisao).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>

                {/* ENUNCIADO E COMPARAÇÃO DE ALTERNATIVAS */}
                <div>
                  <p style={{ margin: '0 0 12px', fontSize: '14px', lineHeight: 1.6, color: '#DDD' }}>
                    {q?.enunciado ? (q.enunciado.length > 250 ? q.enunciado.substring(0, 250) + '...' : q.enunciado) : 'Enunciado não disponível.'}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', backgroundColor: '#141419', padding: '10px 14px', borderRadius: '8px', border: '1px solid #282830', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: '#888' }}>Sua resposta marcada: </span>
                      <strong style={{ color: '#E53935' }}>{item.resposta_marcada || 'Não informada'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Gabarito correto: </span>
                      <strong style={{ color: '#4CAF50' }}>{item.resposta_correta || q?.gabarito || 'Não informado'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Diagnóstico: </span>
                      <strong style={{ color: '#FFB74D' }}>{item.tipo_erro || 'Falta de conhecimento'}</strong>
                    </div>
                  </div>
                </div>

                {/* CAMPO DE ANOTAÇÕES DO ALUNO ("Por que errei / Regra correta") */}
                <div style={{ backgroundColor: '#181820', border: '1px solid #2A2A38', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#FFD700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ✍️ Minhas Anotações (Por que errei / Regra Correta)
                    </span>
                    {!emEdicao && (
                      <button
                        onClick={() => abrirEdicaoAnotacao(item)}
                        style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        ✏️ {item.anotacao ? 'Editar Anotação' : '+ Escrever Anotação'}
                      </button>
                    )}
                  </div>

                  {emEdicao ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#AAA' }}>Tipo de Erro:</span>
                        <select
                          value={tipoErroTemp}
                          onChange={e => setTipoErroTemp(e.target.value)}
                          style={{ ...selectFilterStyle, width: 'auto', padding: '6px 10px' }}
                        >
                          <option value="Falta de conhecimento">Falta de conhecimento</option>
                          <option value="Falta de atenção">Falta de atenção</option>
                          <option value="Interpretação">Interpretação</option>
                          <option value="Confusão de conceitos">Confusão de conceitos</option>
                          <option value="Chute">Chute</option>
                          <option value="Tempo">Tempo</option>
                        </select>
                      </div>
                      <textarea
                        rows={3}
                        value={textoAnotacaoTemp}
                        onChange={e => setTextoAnotacaoTemp(e.target.value)}
                        placeholder="Ex: Confundi o prazo do art. 5º com o do art. 10. A regra correta é X..."
                        style={{
                          width: '100%',
                          backgroundColor: '#111116',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          color: '#FFF',
                          padding: '10px',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          resize: 'vertical'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditandoAnotacaoId(null)}
                          style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#BBB', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => salvarAnotacao(item.id)}
                          disabled={salvandoId === item.id}
                          style={{ backgroundColor: '#4CAF50', border: 'none', color: '#FFF', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          {salvandoId === item.id ? 'Salvando...' : 'Salvar Anotação'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: item.anotacao ? '#EEE' : '#666', fontStyle: item.anotacao ? 'normal' : 'italic', lineHeight: 1.5 }}>
                      {item.anotacao || 'Nenhuma anotação adicionada ainda. Clique em "+ Escrever Anotação" para registrar a regra.'}
                    </p>
                  )}
                </div>

                {/* MODO REFAZER INLINE */}
                {emRefazerInline && q && (
                  <div style={{ marginTop: '8px', borderTop: '1px solid #333', paddingTop: '16px' }}>
                    <QuestaoCard
                      questao={q}
                      numero={idx + 1}
                      userEmail={userEmail}
                      userId={userId}
                      onRespondeu={async () => {
                        await fetchCaderno();
                      }}
                    />
                  </div>
                )}

                {/* BOTÕES DE AÇÃO DO ITEM */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid #282830', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setRefazendoId(emRefazerInline ? null : item.id)}
                      style={{
                        backgroundColor: emRefazerInline ? '#555' : '#2196F3',
                        color: '#FFF',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {emRefazerInline ? 'Ocultar Questão' : '▶ Refazer Agora'}
                    </button>

                    <button
                      onClick={() => marcarComoDominada(item.id, isDominada)}
                      style={{
                        backgroundColor: 'transparent',
                        border: `1px solid ${isDominada ? '#888' : '#4CAF50'}`,
                        color: isDominada ? '#888' : '#81C784',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isDominada ? 'Desmarcar Dominada' : '✓ Marcar como Dominada'}
                    </button>
                  </div>

                  <button
                    onClick={() => removerDoCaderno(item.id)}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #E5393544',
                      color: '#E53935',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  >
                    🗑️ Remover do Caderno
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

const cardResumoStyle = {
  backgroundColor: '#1E1E24',
  borderRadius: '12px',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: '16px'
};

const cardLabelStyle = {
  fontSize: '11px',
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginTop: '2px'
};

const sectionCardStyle = {
  backgroundColor: '#1E1E24',
  border: '1px solid #333',
  borderRadius: '12px',
  padding: '20px'
};

const selectFilterStyle = {
  backgroundColor: '#141419',
  border: '1px solid #444',
  borderRadius: '6px',
  color: '#FFF',
  padding: '10px 12px',
  fontSize: '13px',
  outline: 'none',
  width: '100%'
};
