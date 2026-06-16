import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import Papa from 'papaparse';

export default function AdminQuestoes() {
  const [questoes, setQuestoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const porPagina = 10;

  const [form, setForm] = useState({
    concurso: '', orgao: '', cargo: '', banca: '', ano: '', 
    estado: '', fase: '', numero_questao: '', disciplina: '', 
    assunto: '', palavra_chave: '', dificuldade: 'Media', 
    modalidade: 'Multipla Escolha', enunciado: '', 
    alternativa_a: '', alternativa_b: '', alternativa_c: '', 
    alternativa_d: '', alternativa_e: '', gabarito: 'A', 
    comentario: '', referencia_legal: '', link_prova: ''
  });

  const [editandoId, setEditandoId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchQuestoes();
  }, [pagina]);

  const fetchQuestoes = async () => {
    setLoading(true);
    try {
      const de = (pagina - 1) * porPagina;
      const ate = de + porPagina - 1;
      const { data, count, error } = await supabase
        .from('questoes')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(de, ate);
      
      if (error) throw error;
      setQuestoes(data || []);
      setTotal(count || 0);
    } catch (e) {
      console.error(e);
      alert('Erro ao buscar questões');
    } finally {
      setLoading(false);
    }
  };

  const salvarQuestao = async () => {
    if (!form.enunciado || !form.gabarito) return alert('Enunciado e gabarito são obrigatórios.');
    try {
      if (editandoId) {
        const { error } = await supabase.from('questoes').update(form).eq('id', editandoId);
        if (error) throw error;
        alert('Questão atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('questoes').insert([form]);
        if (error) throw error;
        alert('Questão cadastrada com sucesso!');
      }
      setForm({
        concurso: '', orgao: '', cargo: '', banca: '', ano: '', estado: '', fase: '', numero_questao: '',
        disciplina: '', assunto: '', palavra_chave: '', dificuldade: 'Media', modalidade: 'Multipla Escolha',
        enunciado: '', alternativa_a: '', alternativa_b: '', alternativa_c: '', alternativa_d: '', alternativa_e: '',
        gabarito: 'A', comentario: '', referencia_legal: '', link_prova: ''
      });
      setEditandoId(null);
      fetchQuestoes();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar questão');
    }
  };

  const editarQuestao = (q) => {
    setForm(q);
    setEditandoId(q.id);
  };

  const excluirQuestao = async (id) => {
    if (!window.confirm('Certeza que deseja excluir esta questão?')) return;
    try {
      const { error } = await supabase.from('questoes').delete().eq('id', id);
      if (error) throw error;
      fetchQuestoes();
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
      // Força a detecção do ponto e vírgula se o Excel brasileiro foi usado
      transformHeader: (header) => header.trim(),
      complete: async (results) => {
        const rows = results.data;
        if (rows.length === 0) return alert('O arquivo CSV está vazio.');
        
        // Limpar dados antes de enviar pro banco
        const colunasValidas = [
          'concurso', 'orgao', 'cargo', 'banca', 'ano', 'estado', 'fase', 'numero_questao',
          'disciplina', 'assunto', 'palavra_chave', 'dificuldade', 'modalidade', 'enunciado',
          'alternativa_a', 'alternativa_b', 'alternativa_c', 'alternativa_d', 'alternativa_e',
          'gabarito', 'comentario', 'referencia_legal', 'link_prova'
        ];

        const cleanRows = rows.map(row => {
          const cleanRow = {};
          for (const key in row) {
            if (!colunasValidas.includes(key)) continue; // Ignora colunas extras como __parsed_extra
            
            let val = row[key];
            if (typeof val === 'string') val = val.trim();
            if (val === '') {
              cleanRow[key] = null; // Campos vazios viram null
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
          fetchQuestoes();
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

  const baixarModeloCSV = () => {
    const colunas = [
      'concurso', 'orgao', 'cargo', 'banca', 'ano', 'estado', 'fase', 'numero_questao',
      'disciplina', 'assunto', 'palavra_chave', 'dificuldade', 'modalidade', 'enunciado',
      'alternativa_a', 'alternativa_b', 'alternativa_c', 'alternativa_d', 'alternativa_e',
      'gabarito', 'comentario', 'referencia_legal', 'link_prova'
    ];
    // Usa ponto e vírgula por padrão para compatibilidade com Excel em PT-BR
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + colunas.join(";");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_importacao_questoes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          <label htmlFor="csvUpload" style={{ backgroundColor: '#FF9800', color: '#FFF', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Importar CSV
          </label>
        </div>
      </div>

      {/* FORMULÁRIO */}
      <div style={{ backgroundColor: '#1E1E24', padding: '24px', borderRadius: '12px', border: '1px solid #333', marginBottom: '24px' }}>
        <h3 style={{ color: '#FFF', marginBottom: '16px' }}>{editandoId ? 'Editar Questão' : 'Nova Questão'}</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <input placeholder="Banca (Ex: Cebraspe)" value={form.banca} onChange={e=>setForm({...form, banca: e.target.value})} style={inputStyle} />
          <input placeholder="Órgão (Ex: PF)" value={form.orgao} onChange={e=>setForm({...form, orgao: e.target.value})} style={inputStyle} />
          <input placeholder="Cargo (Ex: Agente)" value={form.cargo} onChange={e=>setForm({...form, cargo: e.target.value})} style={inputStyle} />
          <input placeholder="Ano" value={form.ano} onChange={e=>setForm({...form, ano: e.target.value})} style={inputStyle} type="number" />
          <input placeholder="Disciplina (Ex: Dir. Penal)" value={form.disciplina} onChange={e=>setForm({...form, disciplina: e.target.value})} style={inputStyle} />
          <input placeholder="Assunto" value={form.assunto} onChange={e=>setForm({...form, assunto: e.target.value})} style={inputStyle} />
          
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

        <textarea placeholder="Enunciado da Questão" value={form.enunciado} onChange={e=>setForm({...form, enunciado: e.target.value})} style={{...inputStyle, width: '100%', height: '100px', marginBottom: '16px', resize: 'vertical'}} />

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

        <textarea placeholder="Comentário do Professor" value={form.comentario} onChange={e=>setForm({...form, comentario: e.target.value})} style={{...inputStyle, width: '100%', height: '80px', marginBottom: '16px', resize: 'vertical'}} />

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={salvarQuestao} style={{ backgroundColor: '#4CAF50', color: '#FFF', padding: '10px 20px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            {editandoId ? 'Atualizar Questão' : 'Cadastrar Questão'}
          </button>
          {editandoId && (
            <button onClick={() => { setEditandoId(null); setForm({banca: '', enunciado: '', gabarito: 'A'})}} style={{ backgroundColor: '#555', color: '#FFF', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Cancelar Edição
            </button>
          )}
        </div>
      </div>

      {/* LISTAGEM */}
      <div style={{ backgroundColor: '#1E1E24', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
        <h3 style={{ color: '#FFF', marginBottom: '16px' }}>Questões Cadastradas ({total})</h3>
        
        {loading ? <p style={{color: '#888'}}>Carregando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#CCC', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>ID</th>
                <th style={{ padding: '10px' }}>Banca/Órgão</th>
                <th style={{ padding: '10px' }}>Disciplina</th>
                <th style={{ padding: '10px' }}>Enunciado</th>
                <th style={{ padding: '10px' }}>Gabarito</th>
                <th style={{ padding: '10px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {questoes.map(q => (
                <tr key={q.id} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '10px' }}>{q.id.substring(0,6)}</td>
                  <td style={{ padding: '10px' }}>{q.banca} - {q.orgao}</td>
                  <td style={{ padding: '10px' }}>{q.disciplina}</td>
                  <td style={{ padding: '10px' }}>{q.enunciado.substring(0, 50)}...</td>
                  <td style={{ padding: '10px', color: '#4CAF50', fontWeight: 'bold' }}>{q.gabarito}</td>
                  <td style={{ padding: '10px' }}>
                    <button onClick={() => editarQuestao(q)} style={{ background: '#2196F3', color: '#FFF', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}>✏️</button>
                    <button onClick={() => excluirQuestao(q.id)} style={{ background: '#F44336', color: '#FFF', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
            <button disabled={pagina === 1} onClick={() => setPagina(p=>p-1)} style={{ padding: '6px 12px', cursor: pagina===1 ? 'not-allowed' : 'pointer' }}>Anterior</button>
            <span style={{ color: '#888' }}>Página {pagina}</span>
            <button disabled={pagina * porPagina >= total} onClick={() => setPagina(p=>p+1)} style={{ padding: '6px 12px', cursor: pagina*porPagina>=total ? 'not-allowed' : 'pointer' }}>Próxima</button>
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
