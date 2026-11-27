import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import Papa from 'papaparse';

// Busca IDs no banco por prefixo UUID de forma otimizada para grande volume
async function buscarIdsPorPrefixoUUID(prefixo) {
  try {
    const p = prefixo.toLowerCase();
    // 1. Tenta usar função RPC otimizada caso exista
    const { data: rpcData, error: rpcError } = await supabase.rpc('buscar_questoes_por_prefixo_id', { p_prefixo: p });
    if (!rpcError && rpcData) {
      return rpcData.map(r => r.id || r);
    }

    // 2. Fallback
    const { data, error } = await supabase
      .from('questoes')
      .select('id')
      .limit(50000);
    if (error || !data) return [];
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
    modalidade: 'Multipla Escolha', texto_associado: '', enunciado: '', 
    alternativa_a: '', alternativa_b: '', alternativa_c: '', 
    alternativa_d: '', alternativa_e: '', gabarito: 'A', 
    comentario: '', referencia_legal: '', link_prova: ''
  });

  const [editandoId, setEditandoId] = useState(null);
  const [idCopiado, setIdCopiado] = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [excluindoLote, setExcluindoLote] = useState(false);
  const [imagemAux, setImagemAux] = useState('');
  const [fileInputRef, fileInputAtualizarRef] = [useRef(null), useRef(null)];
  const [modalMesclarAberto, setModalMesclarAberto] = useState(false);
  const [disciplinaOrigem, setDisciplinaOrigem] = useState('');
  const [disciplinaDestino, setDisciplinaDestino] = useState('');
  const [mesclando, setMesclando] = useState(false);

  // Modal Mesclar Assuntos
  const [modalMesclarAssuntoAberto, setModalMesclarAssuntoAberto] = useState(false);
  const [disciplinaFiltroAssunto, setDisciplinaFiltroAssunto] = useState('');
  const [assuntoOrigem, setAssuntoOrigem] = useState('');
  const [assuntoDestino, setAssuntoDestino] = useState('');
  const [mesclandoAssunto, setMesclandoAssunto] = useState(false);
  const [mapaDisciplinaAssuntos, setMapaDisciplinaAssuntos] = useState([]);

  const [opcoesDisciplina, setOpcoesDisciplina] = useState([]);
  const [opcoesAssunto, setOpcoesAssunto] = useState([]);
  const [opcoesBanca, setOpcoesBanca] = useState([]);
  const [opcoesOrgao, setOpcoesOrgao] = useState([]);
  const [opcoesCargo, setOpcoesCargo] = useState([]);

  const carregarOpcoesAutocomplete = useCallback(async () => {
    try {
      // 1. Tenta carregar via RPC oficial get_questoes_filtros (traz 100% de todas as questões do banco)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_questoes_filtros');
      if (!rpcError && rpcData) {
        if (rpcData.disciplinas) {
          setOpcoesDisciplina(rpcData.disciplinas.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')));
        }
        if (rpcData.bancas) {
          setOpcoesBanca(rpcData.bancas.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')));
        }
        if (rpcData.orgaos) {
          setOpcoesOrgao(rpcData.orgaos.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')));
        }
        if (rpcData.cargos) {
          setOpcoesCargo(rpcData.cargos.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')));
        }
        if (rpcData.disciplina_assuntos) {
          setMapaDisciplinaAssuntos(rpcData.disciplina_assuntos);
          const todosAssuntos = [...new Set(rpcData.disciplina_assuntos.map(da => da.assunto).filter(Boolean))];
          setOpcoesAssunto(todosAssuntos.sort((a, b) => a.localeCompare(b, 'pt-BR')));
        }
        return;
      }

      // Fallback paginado para carregar tudo mesmo sem RPC
      const PAGE_SIZE = 1000;
      let allData = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('questoes')
          .select('disciplina, assunto, banca, orgao, cargo')
          .range(from, from + PAGE_SIZE - 1);

        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          if (data.length < PAGE_SIZE) hasMore = false;
          else from += PAGE_SIZE;
        }
      }

      const discSet = new Set();
      const assSet = new Set();
      const bancaSet = new Set();
      const orgaoSet = new Set();
      const cargoSet = new Set();
      const discAssList = [];

      allData.forEach(item => {
        const d = item.disciplina ? item.disciplina.trim() : '';
        const a = item.assunto ? item.assunto.trim() : '';
        if (d) discSet.add(d);
        if (a) assSet.add(a);
        if (item.banca) bancaSet.add(item.banca.trim());
        if (item.orgao) orgaoSet.add(item.orgao.trim());
        if (item.cargo) cargoSet.add(item.cargo.trim());
        if (d && a) discAssList.push({ disciplina: d, assunto: a });
      });

      setOpcoesDisciplina(Array.from(discSet).sort((a, b) => a.localeCompare(b, 'pt-BR')));
      setOpcoesAssunto(Array.from(assSet).sort((a, b) => a.localeCompare(b, 'pt-BR')));
      setOpcoesBanca(Array.from(bancaSet).sort((a, b) => a.localeCompare(b, 'pt-BR')));
      setOpcoesOrgao(Array.from(orgaoSet).sort((a, b) => a.localeCompare(b, 'pt-BR')));
      setOpcoesCargo(Array.from(cargoSet).sort((a, b) => a.localeCompare(b, 'pt-BR')));
      setMapaDisciplinaAssuntos(discAssList);
    } catch (e) {
      console.error('Erro ao buscar opções de autocomplete:', e);
    }
  }, []);

  useEffect(() => {
    carregarOpcoesAutocomplete();
  }, [carregarOpcoesAutocomplete]);

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
        texto_associado: '', enunciado: '', alternativa_a: '', alternativa_b: '', alternativa_c: '', alternativa_d: '', alternativa_e: '',
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
      setSelecionados(prev => { const next = new Set(prev); next.delete(id); return next; });
      fetchQuestoes(pagina, buscaAtiva);
    } catch (e) {
      alert('Erro ao excluir: ' + e.message);
    }
  };

  const toggleSelecionado = (id) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelecionarTodos = () => {
    const idsNaPagina = questoes.map(q => q.id);
    const todosSelecionados = idsNaPagina.length > 0 && idsNaPagina.every(id => selecionados.has(id));
    if (todosSelecionados) {
      setSelecionados(prev => {
        const next = new Set(prev);
        idsNaPagina.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelecionados(prev => {
        const next = new Set(prev);
        idsNaPagina.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const excluirSelecionados = async () => {
    if (selecionados.size === 0) return;
    const qtd = selecionados.size;
    if (!window.confirm(`Tem certeza que deseja excluir ${qtd} questão(ões) selecionada(s)? Esta ação não pode ser desfeita.`)) return;
    setExcluindoLote(true);
    try {
      const ids = Array.from(selecionados);
      const { error } = await supabase.from('questoes').delete().in('id', ids);
      if (error) throw error;
      alert(`${qtd} questão(ões) excluída(s) com sucesso!`);
      setSelecionados(new Set());
      fetchQuestoes(1, buscaAtiva);
      setPagina(1);
    } catch (e) {
      alert('Erro ao excluir em lote: ' + e.message);
    } finally {
      setExcluindoLote(false);
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
          'disciplina', 'assunto', 'subassunto', 'palavra_chave', 'dificuldade', 'modalidade', 'texto_associado', 'enunciado',
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

  const gerarDownloadCSV = (conteudo, nomeArquivo) => {
    const blob = new Blob(["\uFEFF" + conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", nomeArquivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const baixarModeloMultiplaEscolha = () => {
    const cabecalho = [
      'concurso', 'orgao', 'cargo', 'banca', 'ano', 'estado', 'fase', 'numero_questao',
      'disciplina', 'assunto', 'subassunto', 'palavra_chave', 'dificuldade', 'modalidade',
      'texto_associado', 'enunciado',
      'alternativa_a', 'alternativa_b', 'alternativa_c', 'alternativa_d', 'alternativa_e',
      'gabarito', 'comentario', 'referencia_legal', 'link_prova'
    ].join(";");

    // Linha de exemplo preenchida
    const exemplo = [
      'Concurso PF 2024',          // concurso
      'PF',                         // orgao
      'Agente Federal',             // cargo
      'Cebraspe',                   // banca
      '2024',                       // ano
      'DF',                         // estado
      'Objetiva',                   // fase
      '1',                          // numero_questao
      'Direito Penal',              // disciplina
      'Crimes contra a pessoa',     // assunto
      'Homicídio doloso',           // subassunto
      'homicídio;dolo;pena',        // palavra_chave
      'Media',                      // dificuldade (Fácil | Media | Difícil)
      'Multipla Escolha',           // modalidade — use "Multipla Escolha" para múltipla escolha
      '',                           // texto_associado (deixe vazio se não houver)
      'Qual a pena mínima para o homicídio doloso simples?', // enunciado
      '6 anos',                     // alternativa_a
      '4 anos',                     // alternativa_b
      '12 anos',                    // alternativa_c
      '20 anos',                    // alternativa_d
      '2 anos',                     // alternativa_e
      'A',                          // gabarito — use A | B | C | D | E
      'Art. 121 do CP: pena de 6 a 20 anos.', // comentario
      'Art. 121 do Código Penal',   // referencia_legal
      'https://www.exemplo.com/prova.pdf' // link_prova
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";");

    gerarDownloadCSV(`${cabecalho}\n${exemplo}`, "modelo_multipla_escolha.csv");
  };

  const baixarModeloCebraspe = () => {
    const cabecalho = [
      'concurso', 'orgao', 'cargo', 'banca', 'ano', 'estado', 'fase', 'numero_questao',
      'disciplina', 'assunto', 'subassunto', 'palavra_chave', 'dificuldade', 'modalidade',
      'texto_associado', 'enunciado',
      'alternativa_a', 'alternativa_b', 'alternativa_c', 'alternativa_d', 'alternativa_e',
      'gabarito', 'comentario', 'referencia_legal', 'link_prova'
    ].join(";");

    // Linha de exemplo — modalidade Cebraspe (Certo/Errado)
    const exemplo = [
      'Concurso PF 2024',          // concurso
      'PF',                         // orgao
      'Agente Federal',             // cargo
      'Cebraspe',                   // banca
      '2024',                       // ano
      'DF',                         // estado
      'Objetiva',                   // fase
      '42',                         // numero_questao
      'Direito Constitucional',     // disciplina
      'Direitos Fundamentais',      // assunto
      'Igualdade',                  // subassunto
      'igualdade;CF/88;art. 5º',   // palavra_chave
      'Media',                      // dificuldade (Fácil | Media | Difícil)
      'Certo/Errado',               // modalidade — use "Certo/Errado" para questões Cebraspe
      '',                           // texto_associado (deixe vazio se não houver)
      'Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade.', // enunciado
      '',                           // alternativa_a — DEIXE VAZIO para Certo/Errado
      '',                           // alternativa_b — DEIXE VAZIO para Certo/Errado
      '',                           // alternativa_c — DEIXE VAZIO para Certo/Errado
      '',                           // alternativa_d — DEIXE VAZIO para Certo/Errado
      '',                           // alternativa_e — DEIXE VAZIO para Certo/Errado
      'Certo',                      // gabarito — use APENAS "Certo" ou "Errado"
      'Transcrição literal do Art. 5º, caput, da CF/88.', // comentario
      'Art. 5º da Constituição Federal de 1988', // referencia_legal
      'https://www.exemplo.com/prova.pdf' // link_prova
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";");

    gerarDownloadCSV(`${cabecalho}\n${exemplo}`, "modelo_cebraspe_certo_errado.csv");
  };

  const handleMesclarDisciplinas = async () => {
    if (!disciplinaOrigem || !disciplinaDestino) {
      return alert('Selecione a disciplina de origem e a disciplina de destino.');
    }
    if (disciplinaOrigem === disciplinaDestino) {
      return alert('A disciplina de origem e destino não podem ser iguais.');
    }
    if (!window.confirm(`Tem certeza que deseja alterar todas as questões de:\n"${disciplinaOrigem}"\n\nPara:\n"${disciplinaDestino}"?`)) {
      return;
    }

    setMesclando(true);
    try {
      const { data, error } = await supabase
        .from('questoes')
        .update({ disciplina: disciplinaDestino })
        .eq('disciplina', disciplinaOrigem)
        .select('id');

      if (error) throw error;

      const qtd = data ? data.length : 0;
      alert(`Sucesso! ${qtd} questão(ões) atualizada(s) para "${disciplinaDestino}".`);
      
      // Atualiza as opções locais
      setOpcoesDisciplina(prev => {
        const next = prev.filter(d => d !== disciplinaOrigem);
        if (!next.includes(disciplinaDestino)) next.push(disciplinaDestino);
        return next.sort((a, b) => a.localeCompare(b, 'pt-BR'));
      });

      setDisciplinaOrigem('');
      setDisciplinaDestino('');
      setModalMesclarAberto(false);
      carregarOpcoesAutocomplete();
      fetchQuestoes(1, buscaAtiva);
    } catch (err) {
      console.error('Erro ao mesclar disciplinas:', err);
      alert('Erro ao mesclar: ' + err.message);
    } finally {
      setMesclando(false);
    }
  };

  const handleMesclarAssuntos = async () => {
    if (!assuntoOrigem || !assuntoDestino) {
      return alert('Selecione o assunto de origem e o assunto de destino.');
    }
    if (assuntoOrigem.trim().toLowerCase() === assuntoDestino.trim().toLowerCase()) {
      return alert('O assunto de origem e destino não podem ser idênticos.');
    }

    const filtroMsg = disciplinaFiltroAssunto ? `\n(Apenas dentro da disciplina: "${disciplinaFiltroAssunto}")` : '\n(Em todas as disciplinas)';
    if (!window.confirm(`Tem certeza que deseja alterar todas as questões com assunto:\n"${assuntoOrigem}"\n\nPara:\n"${assuntoDestino}"?${filtroMsg}`)) {
      return;
    }

    setMesclandoAssunto(true);
    try {
      let query = supabase
        .from('questoes')
        .update({ assunto: assuntoDestino })
        .eq('assunto', assuntoOrigem);

      if (disciplinaFiltroAssunto) {
        query = query.eq('disciplina', disciplinaFiltroAssunto);
      }

      const { data, error } = await query.select('id');
      if (error) throw error;

      const qtd = data ? data.length : 0;
      alert(`Sucesso! ${qtd} questão(ões) atualizada(s) para o assunto "${assuntoDestino}".`);

      setAssuntoOrigem('');
      setAssuntoDestino('');
      setModalMesclarAssuntoAberto(false);
      carregarOpcoesAutocomplete();
      fetchQuestoes(1, buscaAtiva);
    } catch (err) {
      console.error('Erro ao mesclar assuntos:', err);
      alert('Erro ao mesclar assuntos: ' + err.message);
    } finally {
      setMesclandoAssunto(false);
    }
  };

  // Lista de assuntos filtrados pela disciplina selecionada no modal de assunto
  const assuntosDisponiveisParaMesclar = React.useMemo(() => {
    if (!disciplinaFiltroAssunto) {
      return opcoesAssunto;
    }
    const filtrados = mapaDisciplinaAssuntos
      .filter(item => item.disciplina === disciplinaFiltroAssunto)
      .map(item => item.assunto)
      .filter(Boolean);
    return [...new Set(filtrados)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [disciplinaFiltroAssunto, mapaDisciplinaAssuntos, opcoesAssunto]);

  const totalPaginas = Math.ceil(total / porPagina);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{color: '#fff', margin: 0}}>Gerenciar Banco de Questões</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={baixarModeloMultiplaEscolha} style={{ backgroundColor: '#555', color: '#FFF', padding: '10px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              📥 Modelo Múltipla Escolha
            </button>
            <button onClick={baixarModeloCebraspe} style={{ backgroundColor: '#6a4c93', color: '#FFF', padding: '10px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              📥 Modelo Cebraspe (C/E)
            </button>
          </div>
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
          <button 
            onClick={() => setModalMesclarAberto(true)} 
            style={{ 
              backgroundColor: '#9C27B0', 
              color: '#FFF', 
              padding: '10px 16px', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔄 Mesclar Disciplinas (Lote)
          </button>
          <button 
            onClick={() => setModalMesclarAssuntoAberto(true)} 
            style={{ 
              backgroundColor: '#3F51B5', 
              color: '#FFF', 
              padding: '10px 16px', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📚 Mesclar Assuntos (Lote)
          </button>
        </div>
      </div>

      {/* MODAL DE MESCLAR DISCIPLINAS EM LOTE */}
      {modalMesclarAberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#1E1E24',
            border: '1px solid #9C27B088',
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#FFF', margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔄 Mesclar / Padronizar Disciplina
              </h3>
              <button 
                onClick={() => setModalMesclarAberto(false)}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#AAA', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
              Todas as questões cadastradas na disciplina de <strong>origem</strong> serão atualizadas de uma vez para o nome da disciplina de <strong>destino</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ color: '#FF8A80', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                  De (Disciplina Antiga / Incorreta):
                </label>
                <select
                  value={disciplinaOrigem}
                  onChange={e => setDisciplinaOrigem(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                >
                  <option value="">Selecione a disciplina para alterar...</option>
                  {opcoesDisciplina.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ color: '#81C784', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                  Para (Disciplina Correta / Padronizada):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Direito Administrativo"
                  value={disciplinaDestino}
                  onChange={e => setDisciplinaDestino(e.target.value)}
                  list="lista-sugestoes-destino"
                  style={{ ...inputStyle, width: '100%' }}
                />
                <datalist id="lista-sugestoes-destino">
                  {opcoesDisciplina.map(d => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setModalMesclarAberto(false)}
                disabled={mesclando}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #555',
                  color: '#AAA',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleMesclarDisciplinas}
                disabled={mesclando || !disciplinaOrigem || !disciplinaDestino}
                style={{
                  backgroundColor: '#9C27B0',
                  color: '#FFF',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  cursor: (mesclando || !disciplinaOrigem || !disciplinaDestino) ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  opacity: (mesclando || !disciplinaOrigem || !disciplinaDestino) ? 0.6 : 1
                }}
              >
                {mesclando ? 'Atualizando Questões...' : 'Confirmar e Mesclar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE MESCLAR ASSUNTOS EM LOTE */}
      {modalMesclarAssuntoAberto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#1E1E24',
            border: '1px solid #3F51B588',
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '560px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#FFF', margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📚 Mesclar / Padronizar Assuntos
              </h3>
              <button 
                onClick={() => setModalMesclarAssuntoAberto(false)}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#AAA', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
              Corrija assuntos duplicados ou com pequenas variações de escrita (ex: erros de digitação, singular/plural ou acentuação). Todas as questões receberão o nome do assunto correto.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ color: '#BBB', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                  Filtrar por Disciplina (Opcional):
                </label>
                <select
                  value={disciplinaFiltroAssunto}
                  onChange={e => {
                    setDisciplinaFiltroAssunto(e.target.value);
                    setAssuntoOrigem('');
                  }}
                  style={{ ...inputStyle, width: '100%' }}
                >
                  <option value="">Todas as Disciplinas</option>
                  {opcoesDisciplina.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#777', marginTop: '4px', display: 'block' }}>
                  Selecione uma disciplina para filtrar a lista de assuntos abaixo ou deixe em branco para ver todos.
                </span>
              </div>

              <div>
                <label style={{ color: '#FF8A80', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                  De (Assunto Antigo / Com Variação):
                </label>
                <select
                  value={assuntoOrigem}
                  onChange={e => setAssuntoOrigem(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                >
                  <option value="">Selecione o assunto para alterar...</option>
                  {assuntosDisponiveisParaMesclar.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ color: '#81C784', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                  Para (Assunto Correto / Padronizado):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Licitações e Contratos Administrativos"
                  value={assuntoDestino}
                  onChange={e => setAssuntoDestino(e.target.value)}
                  list="lista-sugestoes-assunto-destino"
                  style={{ ...inputStyle, width: '100%' }}
                />
                <datalist id="lista-sugestoes-assunto-destino">
                  {assuntosDisponiveisParaMesclar.map(a => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setModalMesclarAssuntoAberto(false)}
                disabled={mesclandoAssunto}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #555',
                  color: '#AAA',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleMesclarAssuntos}
                disabled={mesclandoAssunto || !assuntoOrigem || !assuntoDestino}
                style={{
                  backgroundColor: '#3F51B5',
                  color: '#FFF',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  cursor: (mesclandoAssunto || !assuntoOrigem || !assuntoDestino) ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  opacity: (mesclandoAssunto || !assuntoOrigem || !assuntoDestino) ? 0.6 : 1
                }}
              >
                {mesclandoAssunto ? 'Atualizando Questões...' : 'Confirmar e Mesclar Assunto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORMULÁRIO */}
      <div style={{ backgroundColor: '#1E1E24', padding: '24px', borderRadius: '12px', border: '1px solid #333', marginBottom: '24px' }}>
        <h3 style={{ color: '#FFF', marginBottom: '16px' }}>{editandoId ? `Editar Questão — ID: PC-${editandoId.substring(0, 6).toUpperCase()}` : 'Nova Questão'}</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <input placeholder="Banca (Ex: Cebraspe)" value={form.banca} onChange={e=>setForm({...form, banca: e.target.value})} style={inputStyle} list="lista-bancas" />
          <datalist id="lista-bancas">
            {opcoesBanca.map(b => <option key={b} value={b} />)}
          </datalist>
          <input placeholder="Órgão (Ex: PF)" value={form.orgao} onChange={e=>setForm({...form, orgao: e.target.value})} style={inputStyle} list="lista-orgaos" />
          <datalist id="lista-orgaos">
            {opcoesOrgao.map(o => <option key={o} value={o} />)}
          </datalist>
          <input placeholder="Cargo (Ex: Agente)" value={form.cargo} onChange={e=>setForm({...form, cargo: e.target.value})} style={inputStyle} list="lista-cargos" />
          <datalist id="lista-cargos">
            {opcoesCargo.map(c => <option key={c} value={c} />)}
          </datalist>
          <input placeholder="Ano" value={form.ano} onChange={e=>setForm({...form, ano: e.target.value})} style={inputStyle} type="number" />
          <input placeholder="Disciplina (Ex: Dir. Penal)" value={form.disciplina} onChange={e=>setForm({...form, disciplina: e.target.value})} style={inputStyle} list="lista-disciplinas" />
          <datalist id="lista-disciplinas">
            {opcoesDisciplina.map(d => <option key={d} value={d} />)}
          </datalist>

          <input placeholder="Assunto" value={form.assunto} onChange={e=>setForm({...form, assunto: e.target.value})} style={inputStyle} list="lista-assuntos" />
          <datalist id="lista-assuntos">
            {opcoesAssunto.map(a => <option key={a} value={a} />)}
          </datalist>

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

        <textarea placeholder="Texto Associado (Opcional - Ex: Textos de interpretação, charges, poemas...)" value={form.texto_associado} onChange={e=>setForm({...form, texto_associado: e.target.value})} style={{...inputStyle, width: '100%', height: '80px', marginBottom: '8px', resize: 'vertical'}} />
        
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
            <button onClick={() => { setEditandoId(null); setForm({banca: '', enunciado: '', texto_associado: '', gabarito: 'A', dificuldade: 'Media', modalidade: 'Multipla Escolha', concurso: '', orgao: '', cargo: '', ano: '', estado: '', fase: '', numero_questao: '', disciplina: '', assunto: '', subassunto: '', palavra_chave: '', alternativa_a: '', alternativa_b: '', alternativa_c: '', alternativa_d: '', alternativa_e: '', comentario: '', referencia_legal: '', link_prova: ''})}} style={{ backgroundColor: '#555', color: '#FFF', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Cancelar Edição
            </button>
          )}
        </div>
      </div>

      {/* LISTAGEM */}
      <div style={{ backgroundColor: '#1E1E24', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h3 style={{ color: '#FFF', margin: 0 }}>Questões Cadastradas ({total})</h3>
            {selecionados.size > 0 && (
              <button
                onClick={excluirSelecionados}
                disabled={excluindoLote}
                style={{
                  backgroundColor: excluindoLote ? '#666' : '#F44336',
                  color: '#FFF',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: excluindoLote ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  animation: 'none'
                }}
              >
                🗑️ {excluindoLote ? 'Excluindo...' : `Excluir Selecionados (${selecionados.size})`}
              </button>
            )}
          </div>

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
                  <th style={{ padding: '10px', width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={questoes.length > 0 && questoes.every(q => selecionados.has(q.id))}
                      onChange={toggleSelecionarTodos}
                      title="Selecionar/Desmarcar todos desta página"
                      style={{ width: '18px', height: '18px', accentColor: '#E50914', cursor: 'pointer' }}
                    />
                  </th>
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
                  <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Nenhuma questão encontrada.</td></tr>
                )}
                {questoes.map(q => {
                  const displayId = `PC-${q.id.substring(0, 6).toUpperCase()}`;
                  const copiado = idCopiado === q.id;
                  return (
                    <tr key={q.id} style={{ borderBottom: '1px solid #2a2a2a', transition: 'background 0.15s', backgroundColor: selecionados.has(q.id) ? '#1a1a2e' : 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = selecionados.has(q.id) ? '#22224a' : '#25252e'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = selecionados.has(q.id) ? '#1a1a2e' : 'transparent'}
                    >
                      <td style={{ padding: '10px' }}>
                        <input
                          type="checkbox"
                          checked={selecionados.has(q.id)}
                          onChange={() => toggleSelecionado(q.id)}
                          style={{ width: '18px', height: '18px', accentColor: '#E50914', cursor: 'pointer' }}
                        />
                      </td>
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
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} style={{ padding: '6px 14px', cursor: pagina === 1 ? 'not-allowed' : 'pointer', backgroundColor: pagina === 1 ? '#333' : '#2196F3', color: '#FFF', border: 'none', borderRadius: '4px' }}>&#171; Anterior</button>
            
            {Array.from({ length: totalPaginas }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPaginas || (p >= pagina - 2 && p <= pagina + 2))
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) {
                  acc.push(<span key={`ellipsis-${p}`} style={{ color: '#888', padding: '0 4px' }}>...</span>);
                }
                acc.push(
                  <button 
                    key={p} 
                    onClick={() => setPagina(p)} 
                    style={{ 
                      padding: '6px 12px', 
                      cursor: 'pointer', 
                      backgroundColor: pagina === p ? '#4CAF50' : '#333', 
                      color: '#FFF', 
                      border: 'none', 
                      borderRadius: '4px',
                      fontWeight: pagina === p ? 'bold' : 'normal'
                    }}>
                    {p}
                  </button>
                );
                return acc;
              }, [])}
            
            <button disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)} style={{ padding: '6px 14px', cursor: pagina >= totalPaginas ? 'not-allowed' : 'pointer', backgroundColor: pagina >= totalPaginas ? '#333' : '#2196F3', color: '#FFF', border: 'none', borderRadius: '4px' }}>Próxima &#187;</button>
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
