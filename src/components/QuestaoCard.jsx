import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export default function QuestaoCard({ questao, numero, userEmail, userId, onRespondeu }) {
  const [eliminadas, setEliminadas] = useState([]);
  const [respostaMarcada, setRespostaMarcada] = useState(null);
  const [status, setStatus] = useState(null); // 'acertou', 'errou', ou null
  const [loading, setLoading] = useState(false);
  const [mostrarComentario, setMostrarComentario] = useState(false);
  const [favorita, setFavorita] = useState(false);

  useEffect(() => {
    // Resetar estado quando mudar de questão (se renderizado no mesmo componente)
    setEliminadas([]);
    setRespostaMarcada(null);
    setStatus(null);
    setMostrarComentario(false);
    checkSeFavorita();
  }, [questao.id]);

  const checkSeFavorita = async () => {
    if (!userEmail) return;
    try {
      const { data } = await supabase
        .from('questoes_favoritas')
        .select('id')
        .eq('questao_id', questao.id)
        .eq('user_email', userEmail);
      if (data && data.length > 0) setFavorita(true);
      else setFavorita(false);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFavorito = async () => {
    if (!userEmail) return alert("Faça login para favoritar.");
    try {
      if (favorita) {
        await supabase
          .from('questoes_favoritas')
          .delete()
          .eq('questao_id', questao.id)
          .eq('user_email', userEmail);
        setFavorita(false);
      } else {
        await supabase
          .from('questoes_favoritas')
          .insert([{ questao_id: questao.id, user_email: userEmail }]);
        setFavorita(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleEliminada = (letra) => {
    if (eliminadas.includes(letra)) {
      setEliminadas(eliminadas.filter(l => l !== letra));
    } else {
      setEliminadas([...eliminadas, letra]);
      if (respostaMarcada === letra) setRespostaMarcada(null);
    }
  };

  const gabLower = (questao.gabarito || '').toLowerCase().trim();
  
  // Detecta de forma mais robusta se é Certo/Errado
  const isCertoErrado = questao.modalidade === 'Certo/Errado'
    || gabLower === 'certo' || gabLower === 'errado'
    || gabLower === 'c' || gabLower === 'e'
    || (questao.alternativa_a && questao.alternativa_a.toLowerCase().includes('certo') && questao.alternativa_b && questao.alternativa_b.toLowerCase().includes('errado'));

  // Normaliza o gabarito: 'Certo' ou 'C' → 'A', 'Errado' ou 'E' → 'B'
  let gabaritoNormalizado = questao.gabarito;
  if (isCertoErrado) {
    if (gabLower === 'certo' || gabLower === 'c') {
      gabaritoNormalizado = 'A';
    } else if (gabLower === 'errado' || gabLower === 'e') {
      gabaritoNormalizado = 'B';
    }
  }

  // Monta as alternativas
  let alternativas = [
    { letra: 'A', texto: questao.alternativa_a },
    { letra: 'B', texto: questao.alternativa_b },
    { letra: 'C', texto: questao.alternativa_c },
    { letra: 'D', texto: questao.alternativa_d },
    { letra: 'E', texto: questao.alternativa_e },
  ].filter(alt => alt.texto && String(alt.texto).trim() !== '');

  // Se é Certo/Errado e não tem alternativas, gera automaticamente
  if (isCertoErrado && alternativas.length === 0) {
    alternativas = [
      { letra: 'A', texto: 'Certo' },
      { letra: 'B', texto: 'Errado' },
    ];
  } else if (isCertoErrado && alternativas.length > 0) {
    // Garante que o texto fique legível se vier como apenas "C" ou "E"
    if (alternativas[0].texto.toLowerCase().trim() === 'c') alternativas[0].texto = 'Certo';
    if (alternativas[1] && alternativas[1].texto.toLowerCase().trim() === 'e') alternativas[1].texto = 'Errado';
  }

  // Removemos qualquer numeração que venha no texto (ex: "14. ", "14 - ") para evitar confusão com o contador real
  let enunciadoLimpo = questao.enunciado 
    ? questao.enunciado.replace(/^\s*\d+[\.\-\)]\s*/, '')
    : '';

  let imagemEnunciado = null;
  const matchImg = enunciadoLimpo.match(/\[IMG:(.+?)\]/);
  if (matchImg) {
    imagemEnunciado = matchImg[1].trim();
    enunciadoLimpo = enunciadoLimpo.replace(/\[IMG:(.+?)\]/, '').trim();
  }

  const responder = async () => {
    if (!respostaMarcada) return alert('Selecione uma alternativa.');
    if (status) return; // já respondeu

    setLoading(true);
    const correta = respostaMarcada === gabaritoNormalizado;
    
    try {
      if (userEmail) {
        await supabase.from('questoes_respostas').insert([{
          user_id: userId || '00000000-0000-0000-0000-000000000000',
          user_email: userEmail,
          questao_id: questao.id,
          alternativa_marcada: respostaMarcada,
          correta: correta
        }]);
      }
      
      setStatus(correta ? 'acertou' : 'errou');
      if (onRespondeu) onRespondeu({ ...questao, acertou: correta });
    } catch (error) {
      console.error('Erro ao salvar resposta', error);
      alert('Erro ao salvar sua resposta.');
    } finally {
      setLoading(false);
    }
  };

  const corPrimaria = '#2196F3';
  const corAcerto = '#4CAF50';
  const corErro = '#F44336';

  return (
    <div style={{
      backgroundColor: '#1E1E24',
      borderRadius: '12px',
      marginBottom: '20px',
      border: '1px solid #333',
      color: '#FFF',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      overflow: 'hidden'
    }}>
      {/* HEADER DA QUESTÃO - LINHA 1: Número | Badge ID | Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px',
        borderBottom: '1px solid #333',
        backgroundColor: '#25252D',
        flexWrap: 'wrap'
      }}>
        {/* Badge ID PC */}
        {questao.id && (
          <div 
            title="ID Único da Questão"
            style={{ backgroundColor: '#444', color: '#FFF', padding: '6px 12px', borderRadius: '4px', fontSize: '14px', letterSpacing: '0.5px', fontFamily: 'monospace' }}
          >
            PC-{questao.id.substring(0, 6).toUpperCase()}
          </div>
        )}
        {/* Número da questão */}
        {(numero || questao.numero_questao) && (
          <div style={{ backgroundColor: corPrimaria, color: '#FFF', fontWeight: 'bold', padding: '6px 12px', borderRadius: '4px', fontSize: '14px', letterSpacing: '0.5px' }}>
            Questão {numero || questao.numero_questao}
          </div>
        )}

        {/* Breadcrumb Disciplina > Assunto */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {questao.disciplina && (
            <span style={{ fontSize: '13px', color: '#DDD', fontWeight: '500' }}>
              {questao.disciplina}
            </span>
          )}
          {questao.assunto && (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#AAA" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              <span style={{ fontSize: '13px', color: '#DDD', fontWeight: '500' }}>
                {questao.assunto}
              </span>
            </>
          )}
          {questao.subassunto && (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#AAA" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              <span style={{ fontSize: '13px', color: '#DDD', fontWeight: '500' }}>
                {questao.subassunto}
              </span>
            </>
          )}
        </div>

        {/* Favorito - empurrado para a direita */}
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={toggleFavorito}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: favorita ? '#FFC107' : '#CCC', transition: '0.2s', padding: '2px' }}
            title={favorita ? "Remover dos Favoritos" : "Favoritar"}
          >
            {favorita ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* HEADER DA QUESTÃO - LINHA 2: Ano | Banca | Órgão | Prova */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '7px 16px',
        borderBottom: '1px solid #333',
        flexWrap: 'wrap',
        fontSize: '12px', color: '#AAA'
      }}>
        {questao.ano && (
          <span><strong style={{ color: '#DDD', fontWeight: '600' }}>Ano:</strong> {questao.ano}</span>
        )}
        {questao.banca && (
          <span><strong style={{ color: '#DDD', fontWeight: '600' }}>Banca:</strong>{' '}
            <span style={{ color: '#FFB74D', fontWeight: '600' }}>{questao.banca}</span>
          </span>
        )}
        {questao.orgao && (
          <span><strong style={{ color: '#DDD', fontWeight: '600' }}>Órgão:</strong>{' '}
            <span style={{ color: '#FFB74D', fontWeight: '600' }}>{questao.orgao}</span>
          </span>
        )}
        {questao.cargo && (
          <span><strong style={{ color: '#DDD', fontWeight: '600' }}>Cargo:</strong>{' '}
            <span style={{ color: '#FFB74D', fontWeight: '600' }}>{questao.cargo}</span>
          </span>
        )}
        {(questao.banca || questao.ano || questao.orgao || questao.cargo) && (
          <span style={{ color: '#FFB74D', fontWeight: '500' }}>
            {[questao.banca, questao.ano, questao.orgao, questao.cargo].filter(Boolean).join(' - ')}
          </span>
        )}
      </div>

      {/* CORPO DA QUESTÃO */}
      <div style={{ padding: '20px 20px 0 20px' }}>
        {/* ENUNCIADO */}
        <div style={{ fontSize: '15px', lineHeight: '1.75', marginBottom: '20px', color: '#FFF', whiteSpace: 'pre-wrap' }}>
          {enunciadoLimpo}
        </div>
        {/* IMAGEM DO ENUNCIADO */}
        {imagemEnunciado && (
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <img src={imagemEnunciado} alt="Imagem da questão" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #333' }} />
          </div>
        )}
      </div>

      {/* ALTERNATIVAS */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {alternativas.map(alt => {
          const isEliminada = eliminadas.includes(alt.letra);
          const isSelecionada = respostaMarcada === alt.letra;
          const isGabarito = status && alt.letra === gabaritoNormalizado;
          const isErroUser = status && isSelecionada && !isGabarito;

          let bgColor = '#2A2A33';
          let borderColor = '#444';
          let textColor = isEliminada ? '#777' : '#FFF';

          if (isSelecionada && !status) {
            borderColor = corPrimaria;
            bgColor = 'rgba(33, 150, 243, 0.1)';
          }

          if (status) {
            if (isGabarito) {
              bgColor = 'rgba(76, 175, 80, 0.1)';
              borderColor = corAcerto;
              textColor = '#FFF';
            } else if (isErroUser) {
              bgColor = 'rgba(244, 67, 54, 0.1)';
              borderColor = corErro;
              textColor = '#FFF';
            }
          }

          return (
            <div key={alt.letra} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => toggleEliminada(alt.letra)}
                disabled={status !== null}
                style={{
                  background: 'none', border: 'none', color: isEliminada ? corErro : '#666',
                  cursor: status ? 'default' : 'pointer', fontSize: '18px', padding: 0
                }}
                title={isEliminada ? "Restaurar alternativa" : "Riscar alternativa"}
              >
                {isEliminada ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>
                )}
              </button>
              
              <div 
                onClick={() => {
                  if (status) return;
                  if (eliminadas.includes(alt.letra)) {
                    setEliminadas(eliminadas.filter(l => l !== alt.letra));
                  }
                  setRespostaMarcada(alt.letra);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: bgColor,
                  border: `1px solid ${borderColor}`,
                  cursor: status ? 'default' : 'pointer',
                  textDecoration: isEliminada && !isGabarito ? 'line-through' : 'none',
                  color: textColor,
                  transition: 'all 0.2s',
                  opacity: (isEliminada && !isGabarito) ? 0.5 : 1
                }}
              >
                <span style={{ fontWeight: 'bold', marginRight: '12px', color: isGabarito ? corAcerto : (isErroUser ? corErro : '#888') }}>
                  {alt.letra})
                </span>
                <span style={{ flex: 1, lineHeight: '1.5' }}>{alt.texto}</span>
                
                {status && isGabarito && <span style={{ color: corAcerto, fontWeight: 'bold' }}>✓ Correta</span>}
                {status && isErroUser && <span style={{ color: corErro, fontWeight: 'bold' }}>✗ Incorreta</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* AÇÕES DA QUESTÃO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '16px 20px', borderTop: '1px solid #333' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {!status ? (
            <button
              onClick={responder}
              disabled={loading || !respostaMarcada}
              style={{
                backgroundColor: respostaMarcada ? corPrimaria : '#444',
                color: '#FFF',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: respostaMarcada && !loading ? 'pointer' : 'not-allowed',
                transition: '0.2s'
              }}
            >
              {loading ? 'Respondendo...' : 'Responder'}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ 
                padding: '10px 24px', 
                borderRadius: '8px', 
                fontWeight: 'bold', 
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                color: status === 'acertou' ? corAcerto : corErro,
                border: `1px solid ${status === 'acertou' ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)'}`,
                boxShadow: `0 4px 12px ${status === 'acertou' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)'}`,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontSize: '13px'
              }}>
                {status === 'acertou' ? 'Você Acertou' : 'Você Errou'}
              </span>
              <button
                onClick={() => setMostrarComentario(!mostrarComentario)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#FFF',
                  border: '1px solid #666',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                {mostrarComentario ? 'Ocultar Explicação' : 'Ver Explicação'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* COMENTÁRIOS DA QUESTÃO */}
      {mostrarComentario && (
        <div style={{
          margin: '0 20px 20px',
          backgroundColor: '#2A2A33',
          padding: '20px',
          borderRadius: '8px',
          borderLeft: `4px solid ${corPrimaria}`,
          animation: 'fadeIn 0.3s'
        }}>
          <h4 style={{ margin: '0 0 12px 0', color: corPrimaria }}>Explicação</h4>
          <div style={{ fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: '#DDD' }}>
            {questao.comentario || 'Nenhuma explicação disponível para esta questão no momento.'}
          </div>
          {questao.referencia_legal && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#333', borderRadius: '6px', fontSize: '14px', color: '#CCC' }}>
              <strong style={{ color: '#FFF' }}>Fundamentação Legal:</strong><br/>
              {questao.referencia_legal}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
