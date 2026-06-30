import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import Papa from 'papaparse';

// Busca todos os IDs do banco e filtra client-side pelo prefixo do UUID.
// Abordagem simples e confiável: evita problemas com cast id::text no PostgREST.
async function buscarIdsPorPrefixoUUID(prefixo) {
  try {
    const { data, error } = await supabase
      .from('questoes')
      .select('id')
      .limit(5000);
    if (error || !data) return [];
    const p = prefixo.toLowerCase();
    return data.map(r => r.id).filter(id => id && id.toLowerCase().startsWith(p));
  } catch {
    return [];
  }
}

export default function AdminQuestoes() {
  const [questoes, setQuestoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const porPagina = 10;

  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const buscaInputRef = useRef(null);

  const [form, setForm] = useState({
    concurso: '', orgao: '', cargo: '', banca: '', ano: '', 
    estado: '', fase: '', numero_questao: '', disciplina: '', 
    assunto: '', subassunto: '', palavra_chave: '', dificuldade: 'Media', 
    modalidade: 'Multipla Escolha', enunciado: '', 
    alternativa_a: '', alternativa_b: '', alternativa_c: '', 
    alternativa_d: '', alternativa_e: '', gabarito: 'A', 
    comentario: '', referencia_legal: '', link_prova: ''
  });

  const [editandoId, setEditandoId] = useState(null);
  const [idCopiado, setIdCopiado] = useState(null);
  const [imagemAux, setImagemAux] = useState('');
  const fileInputRef = useRef(null);
  const fileInputAtualizarRef = useRef(null);

  const fetchQuestoes = useCallback(async (pg = pagina, buscaFiltro = buscaAtiva) => {
    setLoading(true);
    try {
      const de = (pg - 1) * porPagina;
      const ate = de + porPagina - 1;
      let query = supabase
        .from('questoes')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (buscaFiltro.trim()) {
        const kw = buscaFiltro.trim();

        // Detecta "PC-XXXXXX" ou sequência puramente hexadecimal (possível prefixo de UUID)
        const matchPc = kw.match(/^PC-([a-zA-Z0-9-]+)/i);
        const prefixoUUID = matchPc
          ? matchPc[1].toLowerCase()
          : /^[0-9a-fA-F]{4,32}$/.test(kw) ? kw.toLowerCase() : null;

        // UUID completo → busca exata
        const isUUIDCompleto = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kw);

        if (isUUIDCompleto) {
          query = query.eq('id', kw);
        } else if (prefixoUUID) {
          // Faz pré-busca de IDs via fetch direto (evita encoding do ::)
          const ids = await buscarIdsPorPrefixoUUID(prefixoUUID);
          if (ids.length > 0) {
            query = query.in('id', ids);
          } else {
            // Fallback: busca nos campos de texto normais
            query = query.or(
              `enunciado.ilike.%${kw}%,banca.ilike.%${kw}%,disciplina.ilike.%${kw}%,assunto.ilike.%${kw}%,subassunto.ilike.%${kw}%,orgao.ilike.%${kw}%,concurso.ilike.%${kw}%,cargo.ilike.%${kw}%,numero_questao.ilike.%${kw}%`
            );
          }
        } else {
          // Busca nos campos de texto (enunciado, banca, numero_questao, etc.)
          query = query.or(
            `enunciado.ilike.%${kw}%,banca.ilike.%${kw}%,disciplina.ilike.%${kw}%,assunto.ilike.%${kw}%,subassunto.ilike.%${kw}%,orgao.ilike.%${kw}%,concurso.ilike.%${kw}%,cargo.ilike.%${kw}%,numero_questao.ilike.%${kw}%`
          );
        }
      }

      const { data, count, error } = await query.range(de, ate);
      if (error) throw error;
      setQuestoes(data || []);
      setTotal(count || 0);
    } catch (e) {
      console.error(e);
      alert('Erro ao buscar questões');
    } finally {
      setLoading(false);
    }
  }, [pagina, buscaAtiva]);

  useEffect(() => {
    fetchQuestoes(pagina, buscaAtiva);
  }, [pagina, buscaAtiva]);

  const handleBuscar = () => {
    setPagina(1);
    setBuscaAtiva(busca);
  };

  const handleLimparBusca = () => {
    setBusca('');
    setBuscaAtiva('');
    setPagina(1);
  };

  const copiarId = (id) => {
    navigator.clipboard.writeText(id).then(() => {
      setIdCopiado(id);
      setTimeout(() => setIdCopiado(null), 2000);
    });
  };

  const salvarQuestao = async () => {
    if (!form.enunciado || !form.gabarito) return alert('Enunciado e gabarito são obrigatórios.');
    try {
      const payload = { ...form };
      if (imagemAux.trim()) {
        payload.enunciado = payload.enunciado.trim() + `\n\n[IMG:${imagemAux.trim()}]`;
      }
      
      if (editandoId) {
        const { error } = await supabase.from('questoes').update(payload).eq('id', editandoId);
        if (error) throw error;
        alert('Questão atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('questoes').insert([payload]);
        if (error) throw error;
        alert('Questão cadastrada com sucesso!');
      }
      setForm({
        concurso: '', orgao: '', cargo: '', banca: '', ano: '', estado: '', fase: '', numero_questao: '',
        disciplina: '', assunto: '', subassunto: '', palavra_chave: '', dificuldade: 'Media', modalidade: 'Multipla Escolha',
        enunciado: '', alternativa_a: '', alternativa_b: '', alternativa_c: '', alternativa_d: '', alternativa_e: '',
        gabarito: 'A', comentario: '', referencia_legal: '', link_prova: ''
      });
      setImagemAux('');
      setEditandoId(null);
      fetchQuestoes(1, buscaAtiva);
      setPagina(1);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar questão');
    }
  };

  const editarQuestao = (q) => {
    let enunciadoClean = q.enunciado || '';
    let urlImg = '';
    const matchImg = enunciadoClean.match(/\[IMG:(.+?)\]/);
    if (matchImg) {
      urlImg = matchImg[1].trim();
      enunciadoClean = enunciadoClean.replace(/\[IMG:(.+?)\]/, '').trim();
    }
    setForm({ ...q, enunciado: enunciadoClean });
    setImagemAux(urlImg);
    setEditandoId(q.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluirQuestao = async (id) => {
    if (!window.confirm('Certeza que deseja excluir esta questão?')) return;
    try {
      const { error } = await supabase.from('questoes').delete().eq('id', id);
      if (error) throw error;
      fetchQuestoes(pagina, buscaAtiva);
    } catch (e) {
      alert('Erro ao excluir: ' + e.message);
    }
  };

  const importarCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: async (results) => {
        const rows = results.data;
        if (rows.length === 0) return alert('O arquivo CSV está vazio.');
        
        const colunasValidas = [
          'concurso', 'orgao', 'cargo', 'banca', 'ano', 'estado', 'fase', 'numero_questao',
          'disciplina', 'assunto', 'subassunto', 'palavra_chave', 'dificuldade', 'modalidade', 'enunciado',
          'alternativa_a', 'alternativa_b', 'alternativa_c', 'alternativa_d', 'alternativa_e',
          'gabarito', 'comentario', 'referencia_legal', 'link_prova'
        ];

        const cleanRows = rows.map(row => {
          const cleanRow = {};
          for (const key in row) {
            if (!colunasValidas.includes(key)) continue;
            let val = row[key];
            if (typeof val === 'string') val = val.trim();
            if (val === '') {
              cleanRow[key] = null;
            } else if (key === 'ano' || key === 'numero_questao') {
              cleanRow[key] = parseInt(val, 10);
              if (isNaN(cleanRow[key])) cleanRow[key] = null;
            } else {
              cleanRow[key] = val;
            }
          }
          return cleanRow;
        });

        setLoading(true);
        try {
          const { error } = await supabase.from('questoes').insert(cleanRows);
          if (error) throw error;
          alert(`${cleanRows.length} questões importadas com sucesso!`);
          fetchQuestoes(1, buscaAtiva);
          setPagina(1);
        } catch (err) {
          console.error('Erro Supabase:', err);
          alert(`Erro ao importar: ${err.message || err.details || 'Desconhecido'}. Verifique os dados do seu CSV.`);
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  const importarAtualizacoesCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function(results) {
        const rows = results.data;
        if (rows.length === 0) return alert('O arquivo CSV está vazio.');

        const confirmacao = window.confirm(`Atenção: O sistema vai buscar as ${rows.length} questões no banco (pelo enunciado exato) e atualizar o campo Subassunto delas. Confirma?`);
        if (!confirmacao) return;

        setLoading(true);
        try {
          let atualizadas = 0;
          let naoEncontradas = 0;
          
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const enunciado = row.enunciado?.trim();
            const subassunto = row.subassunto?.trim();
            
            if (!enunciado || !subassunto) continue;
            
            // Busca a questão pelo enunciado exato
            const { data: qData } = await supabase
              .from('questoes')
              .select('id')
              .eq('enunciado', enunciado)
              .limit(1);
              
            if (qData && qData.length > 0) {
              const { error: uError } = await supabase
                .from('questoes')
                .update({ subassunto: subassunto })
                .eq('id', qData[0].id);
                
              if (!uError) atualizadas++;
            } else {
              naoEncontradas++;
            }
          }
          
          alert(`Atualização concluída!\n\nAtualizadas: ${atualizadas}\nNão encontradas (ou sem enunciado/subassunto): ${naoEncontradas}`);
          fetchQuestoes(1, buscaAtiva);
        } catch (err) {
          console.error('Erro ao atualizar via CSV:', err);
          alert('Erro na atualização em lote.');
        } finally {
          setLoading(false);
          if (fileInputAtualizarRef.current) fileInputAtualizarRef.current.value = '';
        }
      }
    });
  };

  const baixarModeloCSV = () => {
    const colunas = [
      'concurso', 'orgao', 'cargo', 'banca', 'ano', 'estado', 'fase', 'numero_questao',
      'disciplina', 'assunto', 'subassunto', 'palavra_chave', 'dificuldade', 'modalidade', 'enunciado',
      'alternativa_a', 'alternativa_b', 'alternativa_c', 'alternativa_d', 'alternativa_e',
      'gabarito', 'comentario', 'referencia_legal', 'link_prova'
    ];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + colunas.join(";");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_importacao_questoes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPaginas = Math.ceil(total / porPagina);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{color: '#fff', margin: 0}}>Gerenciar Banco de Questões</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={baixarModeloCSV} style={{ backgroundColor: '#555', color: '#FFF', padding: '10px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Baixar Modelo CSV
          </button>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={importarCSV} 
            style={{ display: 'none' }} 
            id="csvUpload" 
          />
          <button onClick={() => document.getElementById('csvUpload').click()} style={{ backgroundColor: '#2196F3', color: '#FFF', padding: '10px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Importar Novas (CSV)
          </button>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputAtualizarRef} 
            onChange={importarAtualizacoesCSV} 
            style={{ display: 'none' }} 
            id="csvAtualizar" 
          />
          <button onClick={() => document.getElementById('csvAtualizar').click()} style={{ backgroundColor: '#FF9800', color: '#FFF', padding: '10px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Atualizar Subassuntos (CSV)
          </button>
        </div>
      </div>

      {/* FORMULÁRIO */}
      <div style={{ backgroundColor: '#1E1E24', padding: '24px', borderRadius: '12px', border: '1px solid #333', marginBottom: '24px' }}>
        <h3 style={{ color: '#FFF', marginBottom: '16px' }}>{editandoId ? `Editar Questão — ID: PC-${editandoId.substring(0, 6).toUpperCase()}` : 'Nova Questão'}</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <input placeholder="Banca (Ex: Cebraspe)" value={form.banca} onChange={e=>setForm({...form, banca: e.target.value})} style={inputStyle} />
          <input placeholder="Órgão (Ex: PF)" value={form.orgao} onChange={e=>setForm({...form, orgao: e.target.value})} style={inputStyle} />
          <input placeholder="Cargo (Ex: Agente)" value={form.cargo} onChange={e=>setForm({...form, cargo: e.target.value})} style={inputStyle} />
          <input placeholder="Ano" value={form.ano} onChange={e=>setForm({...form, ano: e.target.value})} style={inputStyle} type="number" />
          <input placeholder="Disciplina (Ex: Dir. Penal)" value={form.disciplina} onChange={e=>setForm({...form, disciplina: e.target.value})} style={inputStyle} />
          <input placeholder="Assunto" value={form.assunto} onChange={e=>setForm({...form, assunto: e.target.value})} style={inputStyle} />
          <input placeholder="Subassunto" value={form.subassunto} onChange={e=>setForm({...form, subassunto: e.target.value})} style={inputStyle} />
          
          <select value={form.dificuldade} onChange={e=>setForm({...form, dificuldade: e.target.value})} style={inputStyle}>
            <option value="Fácil">Fácil</option>
            <option value="Media">Média</option>
            <option value="Difícil">Difícil</option>
          </select>
          <select value={form.modalidade} onChange={e=>setForm({...form, modalidade: e.target.value})} style={inputStyle}>
            <option value="Multipla Escolha">Múltipla Escolha (A-E)</option>
            <option value="Certo/Errado">Certo/Errado (Cebraspe)</option>
          </select>
        </div>

        <textarea placeholder="Enunciado da Questão" value={form.enunciado} onChange={e=>setForm({...form, enunciado: e.target.value})} style={{...inputStyle, width: '100%', height: '100px', marginBottom: '8px', resize: 'vertical'}} />
        
        <input placeholder="URL da Imagem para o Enunciado (Opcional) - Ex: https://site.com/charge.png" value={imagemAux} onChange={e=>setImagemAux(e.target.value)} style={{...inputStyle, width: '100%', marginBottom: '16px'}} />

        {form.modalidade === 'Multipla Escolha' ? (
          <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
            <input placeholder="Alternativa A" value={form.alternativa_a} onChange={e=>setForm({...form, alternativa_a: e.target.value})} style={inputStyle} />
            <input placeholder="Alternativa B" value={form.alternativa_b} onChange={e=>setForm({...form, alternativa_b: e.target.value})} style={inputStyle} />
            <input placeholder="Alternativa C" value={form.alternativa_c} onChange={e=>setForm({...form, alternativa_c: e.target.value})} style={inputStyle} />
            <input placeholder="Alternativa D" value={form.alternativa_d} onChange={e=>setForm({...form, alternativa_d: e.target.value})} style={inputStyle} />
            <input placeholder="Alternativa E" value={form.alternativa_e} onChange={e=>setForm({...form, alternativa_e: e.target.value})} style={inputStyle} />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
            <p style={{color: '#888', fontSize: '12px', margin: 0}}>Para Certo/Errado, as alternativas são geradas automaticamente na exibição.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Gabarito</label>
            <select value={form.gabarito} onChange={e=>setForm({...form, gabarito: e.target.value})} style={{...inputStyle, width: '100%'}}>
              {form.modalidade === 'Multipla Escolha' ? (
                <>
                  <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="E">E</option>
                </>
              ) : (
                <>
                  <option value="Certo">Certo</option><option value="Errado">Errado</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Referência Legal / Súmula</label>
            <input placeholder="Ex: Art. 5º da CF/88" value={form.referencia_legal} onChange={e=>setForm({...form, referencia_legal: e.target.value})} style={{...inputStyle, width: '100%'}} />
          </div>
        </div>

        <textarea placeholder="Explicação da Banca" value={form.comentario} onChange={e=>setForm({...form, comentario: e.target.value})} style={{...inputStyle, width: '100%', height: '80px', marginBottom: '16px', resize: 'vertical'}} />

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={salvarQuestao} style={{ backgroundColor: '#4CAF50', color: '#FFF', padding: '10px 20px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            {editandoId ? 'Atualizar Questão' : 'Cadastrar Questão'}
          </button>
          {editandoId && (
            <button onClick={() => { setEditandoId(null); setForm({banca: '', enunciado: '', gabarito: 'A', dificuldade: 'Media', modalidade: 'Multipla Escolha', concurso: '', orgao: '', cargo: '', ano: '', estado: '', fase: '', numero_questao: '', disciplina: '', assunto: '', subassunto: '', palavra_chave: '', alternativa_a: '', alternativa_b: '', alternativa_c: '', alternativa_d: '', alternativa_e: '', comentario: '', referencia_legal: '', link_prova: ''})}} style={{ backgroundColor: '#555', color: '#FFF', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Cancelar Edição
            </button>
          )}
        </div>
      </div>

      {/* LISTAGEM */}
      <div style={{ backgroundColor: '#1E1E24', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ color: '#FFF', margin: 0 }}>Questões Cadastradas ({total})</h3>

          {/* BARRA DE BUSCA */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '480px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '16px', pointerEvents: 'none' }}>🔍</span>
              <input
                ref={buscaInputRef}
                type="text"
                placeholder="Buscar por ID, enunciado, banca, disciplina..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                style={{ ...inputStyle, paddingLeft: '38px', paddingRight: busca ? '32px' : '12px' }}
              />
              {busca && (
                <button
                  onClick={handleLimparBusca}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
                >×</button>
              )}
            </div>
            <button
              onClick={handleBuscar}
              style={{ backgroundColor: '#2196F3', color: '#FFF', padding: '10px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
            >
              Buscar
            </button>
          </div>
        </div>

        {buscaAtiva && (
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
            Mostrando resultados para: <strong style={{ color: '#2196F3' }}>"{buscaAtiva}"</strong>
            {' '}— <span style={{ cursor: 'pointer', color: '#F44336', textDecoration: 'underline' }} onClick={handleLimparBusca}>Limpar</span>
          </p>
        )}
        
        {loading ? <p style={{color: '#888'}}>Carregando...</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#CCC', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                  <th style={{ padding: '10px', whiteSpace: 'nowrap', color: '#888' }}>ID</th>
                  <th style={{ padding: '10px' }}>Banca / Órgão</th>
                  <th style={{ padding: '10px' }}>Disciplina</th>
                  <th style={{ padding: '10px' }}>Enunciado</th>
                  <th style={{ padding: '10px' }}>Gabarito</th>
                  <th style={{ padding: '10px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {questoes.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Nenhuma questão encontrada.</td></tr>
                )}
                {questoes.map(q => {
                  const displayId = `PC-${q.id.substring(0, 6).toUpperCase()}`;
                  const copiado = idCopiado === q.id;
                  return (
                    <tr key={q.id} style={{ borderBottom: '1px solid #2a2a2a', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#25252e'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '10px' }}>
                        <div
                          title={`ID completo: ${q.id}\nClique para copiar`}
                          onClick={() => copiarId(q.id)}
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            backgroundColor: copiado ? '#1a3a1a' : '#141419',
                            color: copiado ? '#4CAF50' : '#7eb8f7',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            border: `1px solid ${copiado ? '#4CAF50' : '#2a3a4a'}`,
                            display: 'inline-block',
                            userSelect: 'none',
                            transition: 'all 0.2s'
                          }}
                        >
                          {copiado ? '✓ Copiado!' : displayId}
                        </div>
                      </td>
                      <td style={{ padding: '10px' }}>{q.banca}{q.orgao ? ` — ${q.orgao}` : ''}</td>
                      <td style={{ padding: '10px' }}>{q.disciplina || '—'}</td>
                      <td style={{ padding: '10px', maxWidth: '320px' }}>
                        <span title={q.enunciado}>{q.enunciado ? q.enunciado.substring(0, 60) + (q.enunciado.length > 60 ? '…' : '') : '—'}</span>
                      </td>
                      <td style={{ padding: '10px', color: '#4CAF50', fontWeight: 'bold' }}>{q.gabarito}</td>
                      <td style={{ padding: '10px' }}>
                        <button onClick={() => editarQuestao(q)} title="Editar" style={{ background: '#2196F3', color: '#FFF', border: 'none', padding: '5px 9px', borderRadius: '4px', cursor: 'pointer', marginRight: '6px' }}>✏️</button>
                        <button onClick={() => excluirQuestao(q.id)} title="Excluir" style={{ background: '#F44336', color: '#FFF', border: 'none', padding: '5px 9px', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
            <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} style={{ padding: '6px 14px', cursor: pagina === 1 ? 'not-allowed' : 'pointer', backgroundColor: pagina === 1 ? '#333' : '#2196F3', color: '#FFF', border: 'none', borderRadius: '4px' }}>← Anterior</button>
            <span style={{ color: '#888' }}>Página {pagina} de {totalPaginas}</span>
            <button disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)} style={{ padding: '6px 14px', cursor: pagina >= totalPaginas ? 'not-allowed' : 'pointer', backgroundColor: pagina >= totalPaginas ? '#333' : '#2196F3', color: '#FFF', border: 'none', borderRadius: '4px' }}>Próxima →</button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #444',
  backgroundColor: '#141419',
  color: '#FFF',
  width: '100%',
  boxSizing: 'border-box'
};
