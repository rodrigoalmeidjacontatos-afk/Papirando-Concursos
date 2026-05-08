import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

function AdminPage() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('categorias');
  const [userEmail, setUserEmail] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const styles = getStyles(isDarkMode);

  const renderIcon = (iconStr) => {
    if (typeof iconStr === 'string' && (iconStr.startsWith('http') || iconStr.startsWith('data:'))) {
      return <img src={iconStr} alt="logo" style={{width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover'}} />;
    }
    return <span style={{fontSize: '20px'}}>{iconStr || '📚'}</span>;
  };

  
  // ========== DADOS ========== 
  const [categorias, setCategorias] = useState([]);
  const [carreiras, setCarreiras] = useState([]);
  const [preparatorios, setPreparatorios] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [aulas, setAulas] = useState([]);
  const [vinculos, setVinculos] = useState({});
  
  // ========== DADOS DE USUÁRIOS (NOVO) ==========
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [novosUsuariosBadge, setNovosUsuariosBadge] = useState(0);
  
  // ========== CONTROLE DE EXPANSÃO ==========
  const [selectedPrepId, setSelectedPrepId] = useState(null);
  const [expandedPreparatorio, setExpandedPreparatorio] = useState(null);
  const [expandedDisciplina, setExpandedDisciplina] = useState(null);
  const [expandedModulo, setExpandedModulo] = useState(null);
  
  // ========== SELEÇÃO PARA VÍNCULO ==========
  const [selectedCarreira, setSelectedCarreira] = useState('');
  const [expandedPrepVinculo, setExpandedPrepVinculo] = useState(null);
  const [expandedDiscVinculo, setExpandedDiscVinculo] = useState(null);
  
  // ========== FORMULÁRIOS ==========
  const [novaCategoria, setNovaCategoria] = useState({ nome: '', icone: '' });
  const [novaCarreira, setNovaCarreira] = useState({ nome: '', icone: '', capa: '', categoriaId: '' });
  const [novoPreparatorio, setNovoPreparatorio] = useState({ nome: '', logo: '', capa: '', cor: '#1a237e' });
  const [editandoPreparatorio, setEditandoPreparatorio] = useState(null);
  const [novaDisciplina, setNovaDisciplina] = useState({ nome: '', icone: '🎬', preparatorioId: '' });
  const [novoModulo, setNovoModulo] = useState({ nome: '', disciplinaId: '' });
  const [novaAula, setNovaAula] = useState({ titulo: '', videoId: '', ordem: 1 });
  const [nivelNovaAula, setNivelNovaAula] = useState('basico');
  const [editandoAula, setEditandoAula] = useState(null);
  const [dragAulaId, setDragAulaId] = useState(null);
  const [dragOverAulaId, setDragOverAulaId] = useState(null);
  const [editandoCarreira, setEditandoCarreira] = useState(null);
  const [draggedCarreira, setDraggedCarreira] = useState(null);
  const [draggedDisciplina, setDraggedDisciplina] = useState(null);
  const [draggedModulo, setDraggedModulo] = useState(null);
  const [editandoCategoria, setEditandoCategoria] = useState(null);

  // ========== DOCUMENTOS ==========
  const [documentos, setDocumentos] = useState([]);
  const [novoDocumento, setNovoDocumento] = useState({ titulo: '', descricao: '', categoria: 'Simulado', url: '' });
  const [editandoDocumento, setEditandoDocumento] = useState(null);

  // ========== CONTROLE DE ACESSO DE USUÁRIOS ==========
  const [usuarioEditandoAcesso, setUsuarioEditandoAcesso] = useState(null); // {id, email, preparatorios_liberados: []}

  // ========== FUNÇÕES DE USUÁRIOS ==========
  const buscarUsuarios = async () => {
    setCarregandoUsuarios(true);
    console.log("[Admin] Buscando usuários...");
    console.log("[Admin] Buscando usuários com select resiliente...");
    
    // Tenta buscar primeiro apenas o essencial para garantir que a lista apareça
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, created_at') 
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("[Admin] Erro crítico ao buscar usuários:", error);
      alert("Erro ao carregar usuários: " + error.message);
      setUsuarios([]);
    } else {
      console.log("[Admin] Usuários básicos carregados:", data?.length);
      
      // Agora tenta buscar os detalhes separadamente para não quebrar a lista principal
      const { data: details } = await supabase
        .from('profiles')
        .select('*'); // Se isso falhar por causa do 'role', a gente ignora

      if (details) {
        setUsuarios(details);
      } else {
        setUsuarios(data || []);
      }

      const novosCount = (data || []).filter(u => !u.visto_admin).length;
      setNovosUsuariosBadge(novosCount);
    }
    setCarregandoUsuarios(false);
  };

  const atualizarPlano = async (userId, novoPlano) => {
    console.log(`[Admin] Tentando atualizar plano de ${userId} para ${novoPlano}...`);
    
    // Atualização otimista (na interface primeiro)
    const backupUsuarios = [...usuarios];
    setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, plano: novoPlano, data_expiracao: null } : u));

    const { error } = await supabase
      .from('profiles')
      .update({ 
        plano: novoPlano,
        data_expiracao: null 
      })
      .eq('id', userId);
    
    if (!error) {
      console.log(`[Admin] Plano de ${userId} atualizado com sucesso!`);
      alert(`✅ Plano alterado para ${novoPlano.toUpperCase()}!`);
    } else {
      console.error("[Admin] Erro ao atualizar plano no Supabase:", error);
      setUsuarios(backupUsuarios); // Reverte em caso de erro
      alert('❌ Erro ao atualizar plano: ' + error.message);
    }
  };

  const excluirUsuario = async (userId, email) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${email}? Esta ação não pode ser desfeita.`)) return;
    // Remove o perfil (a conta de auth requer admin API, mas removemos o perfil)
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (!error) {
      setUsuarios(prev => prev.filter(u => u.id !== userId));
      alert('✅ Usuário removido com sucesso!');
    } else {
      alert('❌ Erro ao excluir: ' + error.message);
    }
  };

  const atualizarExpiracao = async (userId, tempo, unidade = 'dias') => {
    let dataFinal = null;
    if (tempo !== null) {
      const d = new Date();
      if (unidade === 'minutos') {
        // Adiciona o tempo + 1 minuto de margem de erro para sincronia de relógios
        d.setMinutes(d.getMinutes() + tempo + 1);
      } else {
        d.setDate(d.getDate() + tempo);
      }
      dataFinal = d.toISOString();
    }
    
    const updates = { data_expiracao: dataFinal };
    
    // REGRA: Apenas o botão de 15 minutos (degustação) força o plano PREMIUM
    // Os outros botões (+1d, +30d) apenas definem o tempo do plano que o usuário já tem
    if (unidade === 'minutos' && tempo !== null) {
      updates.plano = 'premium';
    }
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
      
    if (!error) {
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      const msg = dataFinal 
        ? `${unidade === 'minutos' ? 'Degustação PREMIUM' : 'Validade'} até: ${new Date(dataFinal).toLocaleString('pt-BR')}` 
        : 'Acesso Vitalício!';
      alert(`✅ Sucesso! ${msg}`);
    } else {
      alert('❌ Erro ao atualizar: ' + error.message);
    }
  };

  const toggleAdmin = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Deseja alterar o cargo deste usuário para ${newRole.toUpperCase()}?`)) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    
    if (!error) {
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      alert(`✅ Usuário agora é ${newRole.toUpperCase()}!`);
    } else {
      alert('❌ Erro ao alterar cargo: ' + error.message);
    }
  };

  const abrirGerenciarAcesso = (usuario) => {
    setUsuarioEditandoAcesso({
      ...usuario,
      preparatorios_liberados: usuario.preparatorios_liberados || []
    });
  };

  const toggleAcessoPrep = (prepId) => {
    setUsuarioEditandoAcesso(prev => {
      const atual = prev.preparatorios_liberados || [];
      const jatem = atual.includes(prepId);
      return {
        ...prev,
        preparatorios_liberados: jatem ? atual.filter(id => id !== prepId) : [...atual, prepId]
      };
    });
  };

  const salvarAcessoUsuario = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({ preparatorios_liberados: usuarioEditandoAcesso.preparatorios_liberados })
      .eq('id', usuarioEditandoAcesso.id);
    if (!error) {
      setUsuarios(prev => prev.map(u => u.id === usuarioEditandoAcesso.id ? { ...u, preparatorios_liberados: usuarioEditandoAcesso.preparatorios_liberados } : u));
      setUsuarioEditandoAcesso(null);
      alert('✅ Acesso atualizado com sucesso!');
    } else {
      alert('❌ Erro ao salvar acesso: ' + error.message);
    }
  };

  // Checar badge de novos usuários ao carregar
  useEffect(() => {
    const checarNovos = async () => {
      const { data } = await supabase.from('profiles').select('id').eq('visto_admin', false);
      setNovosUsuariosBadge((data || []).length);
    };
    checarNovos();
  }, []);

  // Carregar quando abrir a aba
  useEffect(() => {
    if (activeMenu === 'usuarios') {
      buscarUsuarios();
    }
  }, [activeMenu]);

  // ========== AUTENTICAÇÃO E PROTEÇÃO DE ACESSO ==========
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
      setAuthChecked(true);
    }
    checkAuth();
  }, []);

  // ========== CARREGAR DADOS (SUPABASE) EM PARALELO ========== 
  useEffect(() => {
    async function carregarDados() {
      console.log("[Admin] Carregando dados do sistema...");
      const startTime = Date.now();
      
      try {
        const [
          { data: cat }, 
          { data: carr }, 
          { data: prep }, 
          { data: disc }, 
          { data: mods }, 
          { data: aulasData },
          { data: vData },
          { data: docsData }
        ] = await Promise.all([
          supabase.from('categorias').select('*'),
          supabase.from('carreiras').select('*'),
          supabase.from('preparatorios').select('*'),
          supabase.from('disciplinas').select('*'),
          supabase.from('modulos').select('*'),
          supabase.from('aulas').select('*'),
          supabase.from('vinculos').select('*'),
          supabase.from('documentos').select('*').order('created_at', { ascending: false })
        ]);

        setCategorias(cat || []);
        setCarreiras(carr || []);
        setPreparatorios(prep || []);
        setDisciplinas((disc || []).map(d => ({ ...d, preparatorioId: d.preparatorioId || d.preparatorio_id })));
        setModulos((mods || []).map(m => ({ ...m, disciplinaId: m.disciplinaId || m.disciplina_id })));
        setAulas((aulasData || []).map(a => ({ ...a, moduloId: a.moduloId || a.modulo_id, videoId: a.videoId || a.video_id })));
        setDocumentos(docsData || []);

        if (vData) {
          const obj = {};
          vData.forEach(row => {
            if (row.data) Object.assign(obj, row.data);
            else if (row.carreira_id && row.preparatorio_id) {
              if (!obj[row.carreira_id]) obj[row.carreira_id] = {};
              if (!obj[row.carreira_id][row.preparatorio_id]) obj[row.carreira_id][row.preparatorio_id] = { modulos: {} };
              if (row.modulo_id) {
                if (!obj[row.carreira_id][row.preparatorio_id].modulos[row.modulo_id]) obj[row.carreira_id][row.preparatorio_id].modulos[row.modulo_id] = { aulas: {} };
                if (row.aula_id) obj[row.carreira_id][row.preparatorio_id].modulos[row.modulo_id].aulas[row.aula_id] = true;
              }
            }
          });
          setVinculos(obj);
        }

        console.log(`[Admin] Dados carregados em ${Date.now() - startTime}ms`);
      } catch (err) {
        console.error("[Admin] Erro crítico ao carregar dados:", err);
      }
    }
    carregarDados();
  }, []);

  const salvarTudo = async () => {
    // Salva todos os dados nas tabelas do Supabase
    await supabase.from('categorias').upsert(categorias);
    await supabase.from('carreiras').upsert(carreiras);
    await supabase.from('preparatorios').upsert(preparatorios);
    await supabase.from('disciplinas').upsert(disciplinas.map(d => ({
      id: d.id,
      nome: d.nome,
      icone: d.icone,
      preparatorio_id: d.preparatorioId || d.preparatorio_id
    })));
    await supabase.from('modulos').upsert(modulos.map(m => ({
      id: m.id,
      nome: m.nome,
      disciplina_id: m.disciplinaId || m.disciplina_id
    })));
    await supabase.from('aulas').upsert(aulas.map(a => ({
      id: a.id,
      titulo: a.titulo,
      duracao: a.duracao,
      video_id: a.videoId || a.video_id,
      modulo_id: a.moduloId || a.modulo_id,
      pdf_url: a.pdf_url || null,
      nivel: a.nivel || 'basico',
      ordem: a.ordem || 0
    })));
    // Como agora salvamos de forma normalizada, o "Salvar Tudo" não precisa mais upsertar o JSON blob
    // Mas para manter compatibilidade com o botão, vamos apenas avisar que os vínculos são salvos em tempo real
    alert('✅ Dados salvos com sucesso! (Os vínculos são atualizados automaticamente ao clicar)');
  };

  const importarDados = async () => {
    if (window.confirm('Isso vai importar TODOS os dados locais (Categorias, Carreiras, Preparatórios e Vínculos) para o Supabase. Deseja continuar?')) {
      let storedCat = JSON.parse(localStorage.getItem('app_categorias') || '[]');
      let storedCar = JSON.parse(localStorage.getItem('app_carreiras') || '[]');
      const storedPreps = JSON.parse(localStorage.getItem('app_preparatorios') || '[]');
      const storedDisc = JSON.parse(localStorage.getItem('app_disciplinas') || '[]');
      const storedMods = JSON.parse(localStorage.getItem('app_modulos') || '[]');
      const storedAulas = JSON.parse(localStorage.getItem('app_aulas') || '[]');
      const storedVinculos = JSON.parse(localStorage.getItem('app_vinculos') || '{}');

      if (storedCat.length === 0) {
        storedCat = [
          { id: 'policiais', nome: 'Carreiras Policiais', icone: '👮' },
          { id: 'fiscais', nome: 'Área Fiscal', icone: '💰' },
          { id: 'tribunais', nome: 'Tribunais', icone: '⚖️' }
        ];
      }
      if (storedCar.length === 0) {
        storedCar = [
          { id: 'pf', nome: 'Polícia Federal', icone: '🔫', capa: 'https://concursos.adv.br/wp-content/uploads/2022/05/Concurso-Agente-da-Policia-Federal.jpeg', categoriaId: 'policiais' },
          { id: 'prf', nome: 'Polícia Rodoviária Federal', icone: '🚔', capa: 'https://www.gov.br/prf/pt-br/noticias/estaduais/piaui/anteriores/abril-2022/prf-divulga-balanco-final-da-operacao-semana-santa-no-piaui/whatsapp-image-2021-11-02-at-17-17-11.jpeg/@@images/84916131-eb33-481e-b737-3924fbce52a8.jpeg', categoriaId: 'policiais' },
          { id: 'pc', nome: 'Polícia Civil', icone: '🕵️', capa: 'https://blogs.correiobraziliense.com.br/cbpoder/wp-content/uploads/sites/5/2024/07/Reprodu%C3%A7%C3%A3o-PCDF-.jpg', categoriaId: 'policiais' },
          { id: 'pm', nome: 'Polícia Militar', icone: '👮‍♂️', capa: 'https://scontent.frec38-1.fna.fbcdn.net/v/t1.6435-9/183442705_4145240842165162_4708866907158417749_n.jpg?_nc_cat=109&ccb=1-7&_nc_sid=7b2446&_nc_ohc=jaPb1lXnOtYQ7kNvwFd2w4h&_nc_oc=AdqRAdi18-lRsosZMClAHVixemUKN8_BLaJgseVZ9L0zqev80ANzYEJ6xaw-d3k7SBA&_nc_zt=23&_nc_ht=scontent.frec38-1.fna&_nc_gid=zQNq8NCuLOj7CZ5WAYm8NA&oh=00_Af2EepkR6UGkChXVY8TfY-_NxMegodD3-70kq7CsAcepTg&oe=6A12F568', categoriaId: 'policiais' },
          { id: 'bombeiros', nome: 'Corpo de Bombeiros Militar', icone: '🚒', capa: 'https://i.pinimg.com/1200x/85/a6/6c/85a66c7c0d717b1629dfc314673e6e87.jpg', categoriaId: 'policiais' },
          { id: 'policia_penal', nome: 'Polícia Penal', icone: '🔒', capa: 'https://agencia.ac.gov.br/wp-content/uploads/2024/10/42.jpg', categoriaId: 'policiais' },
          { id: 'gm', nome: 'Guarda Municipal', icone: '🏛️', capa: 'https://boavista.rr.gov.br/storage/Noticias/2023/ABRIL/gcm.jpg', categoriaId: 'policiais' },
          { id: 'receita_federal', nome: 'Receita Federal', icone: '💰', capa: 'https://via.placeholder.com/300x450?text=RFB', categoriaId: 'fiscais' },
          { id: 'sefaz', nome: 'SEFAZ', icone: '💰', capa: 'https://via.placeholder.com/300x450?text=SEFAZ', categoriaId: 'fiscais' },
          { id: 'tj_sp', nome: 'TJ SP', icone: '⚖️', capa: 'https://via.placeholder.com/300x450?text=TJSP', categoriaId: 'tribunais' },
          { id: 'trt', nome: 'TRT', icone: '⚖️', capa: 'https://via.placeholder.com/300x450?text=TRT', categoriaId: 'tribunais' },
          { id: 'stf', nome: 'STF', icone: '⚖️', capa: 'https://via.placeholder.com/300x450?text=STF', categoriaId: 'tribunais' }
        ];
      }

      if (storedCat.length > 0) await supabase.from('categorias').upsert(storedCat);
      if (storedCar.length > 0) await supabase.from('carreiras').upsert(storedCar);
      if (storedPreps.length > 0) await supabase.from('preparatorios').upsert(storedPreps);
      if (storedDisc.length > 0) await supabase.from('disciplinas').upsert(storedDisc.map(d => ({ ...d, preparatorio_id: d.preparatorio_id || d.preparatorioId })));
      if (storedMods.length > 0) await supabase.from('modulos').upsert(storedMods.map(m => ({ ...m, disciplina_id: m.disciplina_id || m.disciplinaId })));
      if (storedAulas.length > 0) await supabase.from('aulas').upsert(storedAulas.map(a => ({ ...a, video_id: a.video_id || a.videoId, modulo_id: a.modulo_id || a.moduloId })));
      setVinculos(storedVinculos);

      // Opcional: Migrar dados do localStorage para o Supabase de forma normalizada
      // Aqui poderíamos iterar sobre storedVinculos e inserir cada linha
      alert('✅ Todos os dados sincronizados com sucesso!');
    }
  };


  // ========== CRUD CATEGORIAS (SUPABASE) ========== 
  const addCategoria = async () => {
    if (!novaCategoria.nome) return alert('Digite o nome');
    const id = novaCategoria.nome.toLowerCase().replace(/ /g, '_');
    const nova = { id, nome: novaCategoria.nome, icone: novaCategoria.icone || '📁' };
    const { error } = await supabase.from('categorias').upsert([nova]);
    if (!error) {
      setCategorias([...categorias, nova]);
      setNovaCategoria({ nome: '', icone: '' });
    } else {
      alert('Erro ao adicionar categoria');
    }
  };

  const removeCategoria = async (id) => {
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (!error) {
      setCategorias(categorias.filter(c => c.id !== id));
    } else {
      alert('Erro ao remover categoria');
    }
  };

  const saveEditCategoria = async () => {
    if (!editandoCategoria.nome) return alert('Preencha o nome');
    const { error } = await supabase.from('categorias').upsert([editandoCategoria]);
    if (!error) {
      setCategorias(categorias.map(c => c.id === editandoCategoria.id ? editandoCategoria : c));
      setEditandoCategoria(null);
    } else {
      alert('Erro ao editar categoria');
    }
  };

  const cancelEditCategoria = () => {
    setEditandoCategoria(null);
  };


  // ========== CRUD CARREIRAS (SUPABASE) ========== 
  const addCarreira = async () => {
    if (!novaCarreira.nome || !novaCarreira.categoriaId) return alert('Preencha todos os campos');
    const id = novaCarreira.nome.toLowerCase().replace(/ /g, '_');
    const nova = {
      id,
      nome: novaCarreira.nome,
      icone: novaCarreira.icone || '📌',
      capa: novaCarreira.capa || '',
      categoriaId: novaCarreira.categoriaId
    };
    const { error } = await supabase.from('carreiras').upsert([nova]);
    if (!error) {
      setCarreiras([...carreiras, nova]);
      setNovaCarreira({ nome: '', icone: '', capa: '', categoriaId: '' });
    } else {
      alert('Erro ao adicionar carreira');
    }
  };

  const removeCarreira = async (id) => {
    const { error } = await supabase.from('carreiras').delete().eq('id', id);
    if (!error) {
      setCarreiras(carreiras.filter(c => c.id !== id));
    } else {
      alert('Erro ao remover carreira');
    }
  };

  const editCarreira = (carreira) => {
    setEditandoCarreira({ ...carreira });
  };


  const saveEditCarreira = async () => {
    if (!editandoCarreira.nome) return alert('Preencha o nome');
    const { error } = await supabase.from('carreiras').upsert([editandoCarreira]);
    if (!error) {
      setCarreiras(carreiras.map(c => c.id === editandoCarreira.id ? editandoCarreira : c));
      setEditandoCarreira(null);
    } else {
      alert('Erro ao editar carreira');
    }
  };

  const cancelEditCarreira = () => {
    setEditandoCarreira(null);
  };

  const handleDragStartCarreira = (e, index) => {
    setDraggedCarreira(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnterCarreira = (e, index) => {
    if (draggedCarreira === index || draggedCarreira === null) return;
    const items = [...carreiras];
    const draggedItemContent = items[draggedCarreira];
    items.splice(draggedCarreira, 1);
    items.splice(index, 0, draggedItemContent);
    setDraggedCarreira(index);
    setCarreiras(items);
  };

  const handleDragEndCarreira = async () => {
    setDraggedCarreira(null);
    // Atualizar no banco (se a coluna existir, senão só ordena localmente por hora)
    const updates = carreiras.map((c, i) => ({ 
      id: c.id, nome: c.nome, icone: c.icone, capa: c.capa, categoria_id: c.categoriaId, ordem: i + 1 
    }));
    await supabase.from('carreiras').upsert(updates);
  };


  const handleFileUpload = (e, target) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'novo') {
          setNovoPreparatorio({ ...novoPreparatorio, logo: reader.result });
        } else {
          setEditandoPreparatorio({ ...editandoPreparatorio, logo: reader.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addPreparatorio = async () => {
    if (!novoPreparatorio.nome) return alert('Digite o nome');
    const id = novoPreparatorio.nome.toLowerCase().replace(/ /g, '_');
    // Como a coluna 'capa' não existe, usamos 'logo' para armazenar a imagem (URL ou Base64)
    const novo = { 
      id, 
      nome: novoPreparatorio.nome, 
      logo: novoPreparatorio.logo || '📚', 
      cor: novoPreparatorio.cor || '#1a237e' 
    };
    const { error } = await supabase.from('preparatorios').upsert([novo]);
    if (!error) {
      setPreparatorios([...preparatorios, novo]);
      setNovoPreparatorio({ nome: '', logo: '', capa: '', cor: '#1a237e' });
    } else {
      console.error('Erro ao adicionar preparatório:', error);
      alert('Erro ao adicionar preparatório: ' + (error.message || 'Verifique o console'));
    }
  };

  const editPreparatorio = (prep) => {
    setEditandoPreparatorio({ ...prep });
  };

  const cancelEditPreparatorio = () => {
    setEditandoPreparatorio(null);
  };

  const saveEditPreparatorio = async () => {
    if (!editandoPreparatorio.nome) return alert('Preencha o nome');
    const dadosParaSalvar = {
      id: editandoPreparatorio.id,
      nome: editandoPreparatorio.nome,
      logo: editandoPreparatorio.logo,
      cor: editandoPreparatorio.cor
    };
    const { error } = await supabase.from('preparatorios').upsert([dadosParaSalvar]);
    if (!error) {
      setPreparatorios(preparatorios.map(p => p.id === editandoPreparatorio.id ? editandoPreparatorio : p));
      setEditandoPreparatorio(null);
    } else {
      alert('Erro ao editar preparatório');
    }
  };

  const removePreparatorio = async (id) => {
    const { error } = await supabase.from('preparatorios').delete().eq('id', id);
    if (!error) {
      setPreparatorios(preparatorios.filter(p => p.id !== id));
    } else {
      alert('Erro ao remover preparatório');
    }
  };


  // ========== CRUD DISCIPLINAS (SUPABASE) ========== 
  const addDisciplina = async (prepId) => {
    if (!novaDisciplina.nome || !prepId) return alert('Preencha o nome');
    const id = `${prepId}_${novaDisciplina.nome.toLowerCase().replace(/ /g, '_')}`;
    const nova = { id, nome: novaDisciplina.nome, icone: novaDisciplina.icone, preparatorioId: prepId };
    const dbNova = { id, nome: novaDisciplina.nome, icone: novaDisciplina.icone, preparatorio_id: prepId };
    const { error } = await supabase.from('disciplinas').upsert([dbNova]);
    if (!error) {
      setDisciplinas([...disciplinas, nova]);
      setNovaDisciplina({ nome: '', icone: '📚', preparatorioId: '' });
    } else {
      alert('Erro ao adicionar disciplina');
    }
  };

  const removeDisciplina = async (id) => {
    // Remove módulos e aulas relacionados
    const modulosDaDisc = modulos.filter(m => String(m.disciplinaId || m.disciplina_id) === String(id));
    for (const mod of modulosDaDisc) {
      await supabase.from('aulas').delete().eq('modulo_id', mod.id);
    }
    await supabase.from('modulos').delete().eq('disciplina_id', id);
    await supabase.from('disciplinas').delete().eq('id', id);
    
    setDisciplinas(disciplinas.filter(d => d.id !== id));
    setModulos(modulos.filter(m => String(m.disciplinaId || m.disciplina_id) !== String(id)));
    setAulas(aulas.filter(a => !modulosDaDisc.some(mod => mod.id === (a.moduloId || a.modulo_id))));
  };


  // ========== CRUD MÓDULOS (SUPABASE) ========== 
  const handleDropModulo = async (e, targetId, discId) => {
    e.preventDefault();
    if (!draggedModulo || draggedModulo === targetId) return;

    const modsList = [...getModulosPorDisciplina(discId)];
    const draggedIdx = modsList.findIndex(m => m.id === draggedModulo);
    const targetIdx = modsList.findIndex(m => m.id === targetId);
    
    if (draggedIdx === -1 || targetIdx === -1) return;

    const [draggedItem] = modsList.splice(draggedIdx, 1);
    modsList.splice(targetIdx, 0, draggedItem);

    const updates = modsList.map((m, i) => ({ id: m.id, ordem: i + 1 }));

    setModulos(prev => prev.map(m => {
      const update = updates.find(u => u.id === m.id);
      return update ? { ...m, ordem: update.ordem } : m;
    }));

    await Promise.all(updates.map(u => supabase.from('modulos').update({ ordem: u.ordem }).eq('id', u.id)));
    setDraggedModulo(null);
  };
  const handleDropDisciplina = async (e, targetId, prepId) => {
    e.preventDefault();
    if (!draggedDisciplina || draggedDisciplina === targetId) return;

    const discList = [...getDisciplinasPorPrep(prepId)];
    const draggedIdx = discList.findIndex(d => d.id === draggedDisciplina);
    const targetIdx = discList.findIndex(d => d.id === targetId);
    
    if (draggedIdx === -1 || targetIdx === -1) return;

    const [draggedItem] = discList.splice(draggedIdx, 1);
    discList.splice(targetIdx, 0, draggedItem);

    const updates = discList.map((d, i) => ({ id: d.id, ordem: i + 1 }));

    setDisciplinas(prev => prev.map(d => {
      const update = updates.find(u => u.id === d.id);
      return update ? { ...d, ordem: update.ordem } : d;
    }));

    await Promise.all(updates.map(u => supabase.from('disciplinas').update({ ordem: u.ordem }).eq('id', u.id)));
    setDraggedDisciplina(null);
  };

  const addModulo = async (discId) => {
    if (!novoModulo.nome || !discId) return alert('Preencha o nome do módulo');
    const id = `mod_${Date.now()}`;
    const novo = { id, nome: novoModulo.nome, disciplinaId: discId };
    const dbNovo = { id, nome: novoModulo.nome, disciplina_id: discId };
    const { error } = await supabase.from('modulos').upsert([dbNovo]);
    if (!error) {
      setModulos([...modulos, novo]);
      setNovoModulo({ nome: '', disciplinaId: '' });
    } else {
      alert('Erro ao adicionar módulo');
    }
  };

  const removeModulo = async (id) => {
    await supabase.from('aulas').delete().eq('modulo_id', id);
    const { error } = await supabase.from('modulos').delete().eq('id', id);
    if (!error) {
      setAulas(aulas.filter(a => String(a.moduloId || a.modulo_id) !== String(id)));
      setModulos(modulos.filter(m => m.id !== id));
    } else {
      alert('Erro ao remover módulo');
    }
  };


  // ========== CRUD AULAS (SUPABASE) ==========
  const addAula = async (modId) => {
    if (!novaAula.titulo || !novaAula.videoId || !modId) return alert('Preencha título e ID do YouTube');
    
    let extractedVideoId = novaAula.videoId;
    // Extrai o ID se o usuário colou o link completo do Youtube
    if (extractedVideoId.includes('youtube.com') || extractedVideoId.includes('youtu.be')) {
      const match = extractedVideoId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^"&?\/\s]{11})/);
      if (match && match[1]) {
        extractedVideoId = match[1];
      } else {
        return alert('Link do YouTube inválido. Cole apenas o ID do vídeo ou o link padrão.');
      }
    }

    const id = `aula_${Date.now()}`;
    const nivelFinal = nivelNovaAula;
    const ordemFinal = parseInt(novaAula.ordem) || 1;
    const dbNova = {
      id,
      titulo: novaAula.titulo,
      duracao: novaAula.duracao || null,
      video_id: extractedVideoId,
      modulo_id: modId,
      pdf_url: novaAula.pdf_url || null,
      nivel: nivelFinal,
      ordem: ordemFinal
    };
    console.log('[addAula] nivel:', nivelFinal, '| ordem:', ordemFinal);
    const { data, error } = await supabase.from('aulas').insert([dbNova]).select();
    if (!error) {
      const nova = { id, titulo: novaAula.titulo, duracao: novaAula.duracao || null, videoId: extractedVideoId, pdf_url: novaAula.pdf_url || null, moduloId: modId, nivel: nivelFinal, ordem: ordemFinal };
      setAulas(prev => [...prev, nova].sort((a, b) => (a.ordem || 1) - (b.ordem || 1)));
      setNovaAula({ titulo: '', videoId: '', ordem: 1 });
      // Não reseta nivelNovaAula para manter confortável ao adicionar várias aulas do mesmo nível
    } else {
      alert('Erro ao adicionar aula: ' + (error.message || JSON.stringify(error)));
    }
  };

  const updateAula = async () => {
    if (!editandoAula) return;
    const nivelFinal = editandoAula.nivel || 'basico';
    const ordemFinal = parseInt(editandoAula.ordem) || 1;
    const dbUpdate = {
      titulo: editandoAula.titulo,
      video_id: editandoAula.videoId,
      duracao: editandoAula.duracao,
      pdf_url: editandoAula.pdf_url || null,
      nivel: nivelFinal,
      ordem: ordemFinal
    };
    const { error } = await supabase
      .from('aulas')
      .update(dbUpdate)
      .eq('id', editandoAula.id);
    if (!error) {
      setAulas(prev => prev
        .map(a => a.id === editandoAula.id ? { ...editandoAula, nivel: nivelFinal, ordem: ordemFinal } : a)
        .sort((a, b) => (a.ordem || 1) - (b.ordem || 1)));
      setEditandoAula(null);
    } else {
      alert('Erro ao editar aula: ' + (error.message || ''));
    }
  };

  // ========== DRAG AND DROP DE AULAS ==========
  const handleDragStart = (e, aulaId) => {
    setDragAulaId(aulaId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, aulaId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (aulaId !== dragAulaId) setDragOverAulaId(aulaId);
  };

  const handleDrop = async (e, aulaAlvoId, modId) => {
    e.preventDefault();
    if (!dragAulaId || dragAulaId === aulaAlvoId) {
      setDragAulaId(null);
      setDragOverAulaId(null);
      return;
    }

    // Pegar lista do módulo ordenada
    const aulasDoMod = aulas
      .filter(a => (a.moduloId || a.modulo_id) === modId)
      .sort((a, b) => (a.ordem || 1) - (b.ordem || 1));

    const idxDrag = aulasDoMod.findIndex(a => a.id === dragAulaId);
    const idxAlvo = aulasDoMod.findIndex(a => a.id === aulaAlvoId);
    if (idxDrag === -1 || idxAlvo === -1) return;

    // Reordenar a lista localmente
    const novaLista = [...aulasDoMod];
    const [removida] = novaLista.splice(idxDrag, 1);
    novaLista.splice(idxAlvo, 0, removida);

    // Atribuir novas ordens 1,2,3...
    const updates = novaLista.map((a, i) => ({ id: a.id, ordem: i + 1 }));

    // Salvar no banco (atualiza cada uma)
    await Promise.all(
      updates.map(u => supabase.from('aulas').update({ ordem: u.ordem }).eq('id', u.id))
    );

    // Atualiza estado local
    setAulas(prev => {
      const outros = prev.filter(a => (a.moduloId || a.modulo_id) !== modId);
      const atualizadas = updates.map(u => {
        const original = prev.find(a => a.id === u.id);
        return { ...original, ordem: u.ordem };
      });
      return [...outros, ...atualizadas].sort((a, b) => (a.ordem || 1) - (b.ordem || 1));
    });

    setDragAulaId(null);
    setDragOverAulaId(null);
  };

  const removeAula = async (id) => {
    const { error } = await supabase.from('aulas').delete().eq('id', id);
    if (!error) {
      setAulas(aulas.filter(a => a.id !== id));
    } else {
      alert('Erro ao remover aula');
    }
  };


  // ========== VÍNCULOS (SUPABASE) ========== 
  const salvarVinculos = async (novoVinculos) => {
    setVinculos(novoVinculos);
    try {
      const { error } = await supabase.from('vinculos').upsert([{ id: 1, data: novoVinculos }]);
      if (error) console.error('Erro ao salvar vínculos no Supabase:', error);
    } catch (err) {
      console.error('Erro inesperado ao salvar vínculos:', err);
    }
  };

  const togglePrepVinculo = async (carreiraId, prepId) => {
    const carrVinculos = vinculos[carreiraId] || {};
    let novoVinculos;
    if (carrVinculos[prepId]) {
      const newVinculos = { ...carrVinculos };
      delete newVinculos[prepId];
      novoVinculos = { ...vinculos, [carreiraId]: newVinculos };
      await supabase.from('vinculos').delete().eq('carreira_id', carreiraId).eq('preparatorio_id', prepId);
    } else {
      novoVinculos = { ...vinculos, [carreiraId]: { ...carrVinculos, [prepId]: { modulos: {} } } };
      await supabase.from('vinculos').insert([{ carreira_id: carreiraId, preparatorio_id: prepId }]);
    }
    setVinculos(novoVinculos);
  };

  const isPrepVinculado = (carreiraId, prepId) => !!vinculos[carreiraId]?.[prepId];


  const toggleModuloVinculo = async (carreiraId, prepId, moduloId) => {
    const carrVinculos = vinculos[carreiraId] || {};
    const prepVinculos = carrVinculos[prepId] || { modulos: {} };
    if (!prepVinculos.modulos) prepVinculos.modulos = {};
    
    const modsAtual = prepVinculos.modulos;
    let novoVinculos;
    if (modsAtual[moduloId]) {
      const newMods = { ...modsAtual };
      delete newMods[moduloId];
      novoVinculos = { ...vinculos, [carreiraId]: { ...carrVinculos, [prepId]: { ...prepVinculos, modulos: newMods } } };
      await supabase.from('vinculos').delete().eq('carreira_id', carreiraId).eq('preparatorio_id', prepId).eq('modulo_id', moduloId);
    } else {
      novoVinculos = { ...vinculos, [carreiraId]: { ...carrVinculos, [prepId]: { ...prepVinculos, modulos: { ...modsAtual, [moduloId]: { aulas: {} } } } } };
      await supabase.from('vinculos').insert([{ carreira_id: carreiraId, preparatorio_id: prepId, modulo_id: moduloId }]);
    }
    setVinculos(novoVinculos);
  };

  const isModuloVinculado = (carreiraId, prepId, moduloId) => !!vinculos[carreiraId]?.[prepId]?.modulos?.[moduloId];


  const toggleAulaVinculo = async (carreiraId, prepId, moduloId, aulaId) => {
    const carrVinculos = vinculos[carreiraId] || {};
    const prepVinculos = carrVinculos[prepId] || { modulos: {} };
    if (!prepVinculos.modulos) prepVinculos.modulos = {};
    const modulo = prepVinculos.modulos[moduloId] || { aulas: {} };
    if (!modulo.aulas) modulo.aulas = {};
    
    const aulasAtual = modulo.aulas;
    let novoVinculos;
    if (aulasAtual[aulaId]) {
      const newAulas = { ...aulasAtual };
      delete newAulas[aulaId];
      novoVinculos = {
        ...vinculos,
        [carreiraId]: {
          ...carrVinculos,
          [prepId]: {
            ...prepVinculos,
            modulos: {
              ...prepVinculos.modulos,
              [moduloId]: { ...modulo, aulas: newAulas }
            }
          }
        }
      };
      await supabase.from('vinculos').delete().eq('carreira_id', carreiraId).eq('preparatorio_id', prepId).eq('modulo_id', moduloId).eq('aula_id', aulaId);
    } else {
      novoVinculos = {
        ...vinculos,
        [carreiraId]: {
          ...carrVinculos,
          [prepId]: {
            ...prepVinculos,
            modulos: {
              ...prepVinculos.modulos,
              [moduloId]: { ...modulo, aulas: { ...aulasAtual, [aulaId]: true } }
            }
          }
        }
      };
      await supabase.from('vinculos').insert([{ carreira_id: carreiraId, preparatorio_id: prepId, modulo_id: moduloId, aula_id: aulaId }]);
    }
    setVinculos(novoVinculos);
  };

  const isAulaVinculada = (carreiraId, prepId, moduloId, aulaId) => !!vinculos[carreiraId]?.[prepId]?.modulos?.[moduloId]?.aulas?.[aulaId];

  const selecionarTudoVinculo = async (carreiraId, prepId) => {
    const carrVinculos = vinculos[carreiraId] || {};
    const discDoPrep = getDisciplinasPorPrep(prepId);
    
    const novosModulos = {};
    const inserts = [];
    
    discDoPrep.forEach(disc => {
      const mods = getModulosPorDisciplina(disc.id);
      mods.forEach(mod => {
        const aulasDoMod = getAulasPorModulo(mod.id);
        const aulasObj = {};
        aulasDoMod.forEach(aula => {
          aulasObj[aula.id] = true;
          if (!isAulaVinculada(carreiraId, prepId, mod.id, aula.id)) {
            inserts.push({ carreira_id: carreiraId, preparatorio_id: prepId, modulo_id: mod.id, aula_id: aula.id });
          }
        });
        novosModulos[mod.id] = { aulas: aulasObj };
        if (!isModuloVinculado(carreiraId, prepId, mod.id)) {
          inserts.push({ carreira_id: carreiraId, preparatorio_id: prepId, modulo_id: mod.id });
        }
      });
    });
    
    const novoVinculos = {
      ...vinculos,
      [carreiraId]: {
        ...carrVinculos,
        [prepId]: { modulos: novosModulos }
      }
    };
    setVinculos(novoVinculos);
    
    if (inserts.length > 0) {
      if (!isPrepVinculado(carreiraId, prepId)) {
        inserts.push({ carreira_id: carreiraId, preparatorio_id: prepId });
      }
      // Insert all in chunks or single request
      await supabase.from('vinculos').upsert(inserts);
    }
    alert('✅ Todos os módulos e aulas selecionados!');
  };

  // Helpers
  const getPreparatorioNome = (id) => preparatorios.find(p => p.id === id)?.nome || '?';
  const getDisciplinaNome = (id) => disciplinas.find(d => d.id === id)?.nome || '?';
  const getModuloNome = (id) => modulos.find(m => m.id === id)?.nome || '?';
  const getDisciplinasPorPrep = (prepId) => disciplinas.filter(d => (d.preparatorioId || d.preparatorio_id) === prepId).sort((a,b) => (a.ordem || 999) - (b.ordem || 999));
  const getModulosPorDisciplina = (discId) => modulos.filter(m => (m.disciplinaId || m.disciplina_id) === discId).sort((a,b) => (a.ordem || 999) - (b.ordem || 999));
  const getAulasPorModulo = (modId) => aulas.filter(a => (a.moduloId || a.modulo_id) === modId).sort((a,b) => (a.ordem || 999) - (b.ordem || 999));

  const menuItems = [
    { id: 'categorias', nome: '📁 Categorias', icone: '📁' },
    { id: 'carreiras', nome: '🎯 Carreiras', icone: '🎯' },
    { id: 'preparatorios', nome: '🎓 Preparatórios', icone: '🎓' },
    { id: 'vincular', nome: '🔗 Vincular', icone: '🔗' },
    { id: 'documentos', nome: '📄 Documentos', icone: '📄' },
    { id: 'usuarios', nome: '👥 Usuários', icone: '👥' },
  ];

  if (!authChecked) {
    return <div style={{ color: '#fff', padding: 40 }}>Verificando autenticação...</div>;
  }
  if (userEmail !== 'rodrigoalmeidja@gmail.com') {
    return <div style={{ color: '#fff', padding: 40 }}>Acesso restrito ao proprietário.</div>;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={{...styles.backButton, padding: '8px 16px', borderRadius: '8px', backgroundColor: 'transparent', border: `1px solid ${isDarkMode ? '#333' : '#CCC'}`, color: isDarkMode ? '#FFF' : '#333', cursor: 'pointer'}}>← Voltar ao Site</button>
        <h1 style={styles.title}>👑 Painel Administrativo</h1>
        <div style={{display: 'flex', gap: '12px'}}>
          <button onClick={() => setIsDarkMode(!isDarkMode)} style={{padding: '8px 16px', borderRadius: '8px', backgroundColor: isDarkMode ? '#333' : '#E0E0E0', border: 'none', color: isDarkMode ? '#FFF' : '#333', cursor: 'pointer'}}>
            {isDarkMode ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
          </button>
          <button onClick={importarDados} style={{...styles.saveButtonSmall, backgroundColor: '#FF9800', padding: '8px 16px'}}>⬇ Sincronizar com a Home</button>
          <button onClick={salvarTudo} style={{...styles.saveButtonSmall, padding: '8px 16px'}}>💾 Salvar Tudo</button>
        </div>
      </header>
      <div style={styles.mainContainer}>
        <div style={styles.sidebar}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveMenu(item.id); setSelectedPrepId(null); }}
              style={{ ...styles.menuButton, ...(activeMenu === item.id ? styles.menuButtonActive : {}) }}
            >
              {item.icone} {item.nome}
            </button>
          ))}
        </div>
        <div style={styles.content}>
          {activeMenu === 'categorias' && (
            <div>
              <h2 style={{color: '#fff', marginBottom: 20}}>Gerenciar Categorias</h2>
              <div style={styles.formCard}>
                <h3 style={{color: '#F5F5F5', marginBottom: '12px'}}>Nova Categoria</h3>
                <div style={styles.addForm}>
                  <input style={styles.input} placeholder="Nome (Ex: Tribunais)" value={novaCategoria.nome} onChange={e => setNovaCategoria({...novaCategoria, nome: e.target.value})} />
                  <input style={styles.inputSmall} placeholder="Ícone (Ex: ⚖️)" value={novaCategoria.icone} onChange={e => setNovaCategoria({...novaCategoria, icone: e.target.value})} />
                  <button style={styles.addButton} onClick={addCategoria}>Adicionar</button>
                </div>
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {categorias.map(cat => (
                  <div key={cat.id} style={styles.item}>
                    {editandoCategoria?.id === cat.id ? (
                      <div style={{display: 'flex', gap: '8px', flex: 1, alignItems: 'center'}}>
                        <input style={styles.inputSmall} value={editandoCategoria.icone} onChange={e => setEditandoCategoria({...editandoCategoria, icone: e.target.value})} placeholder="Ícone" />
                        <input style={styles.input} value={editandoCategoria.nome} onChange={e => setEditandoCategoria({...editandoCategoria, nome: e.target.value})} placeholder="Nome" />
                        <div style={{display: 'flex', gap: '8px'}}>
                          <button style={styles.saveButton} onClick={saveEditCategoria}>Salvar</button>
                          <button style={styles.deleteButton} onClick={cancelEditCategoria}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span style={{color: '#F5F5F5', fontWeight: 'bold'}}>{cat.icone} {cat.nome}</span>
                        <div style={styles.actionButtons}>
                          <button style={styles.editButton} onClick={() => setEditandoCategoria(cat)}>Editar</button>
                          <button style={styles.deleteButton} onClick={() => removeCategoria(cat.id)}>Excluir</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeMenu === 'carreiras' && (
            <div>
              <h2 style={{color: '#fff', marginBottom: 20}}>Gerenciar Carreiras</h2>
              <div style={styles.formCard}>
                <h3 style={{color: '#F5F5F5', marginBottom: '12px'}}>Nova Carreira</h3>
                <div style={styles.addForm}>
                  <input style={styles.input} placeholder="Nome" value={novaCarreira.nome} onChange={e => setNovaCarreira({...novaCarreira, nome: e.target.value})} />
                  <input style={styles.inputSmall} placeholder="Ícone" value={novaCarreira.icone} onChange={e => setNovaCarreira({...novaCarreira, icone: e.target.value})} />
                  <input style={styles.input} placeholder="URL da Capa" value={novaCarreira.capa} onChange={e => setNovaCarreira({...novaCarreira, capa: e.target.value})} />
                  <select style={styles.select} value={novaCarreira.categoriaId} onChange={e => setNovaCarreira({...novaCarreira, categoriaId: e.target.value})}>
                    <option value="">Selecione a Categoria</option>
                    {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                  </select>
                  <button style={styles.addButton} onClick={addCarreira}>Adicionar</button>
                </div>
              </div>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {carreiras.map((carr, index) => (
                  <div 
                    key={carr.id} 
                    style={{...styles.item, cursor: 'grab', opacity: draggedCarreira === index ? 0.5 : 1}}
                    draggable
                    onDragStart={(e) => handleDragStartCarreira(e, index)}
                    onDragEnter={(e) => handleDragEnterCarreira(e, index)}
                    onDragEnd={handleDragEndCarreira}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {editandoCarreira?.id === carr.id ? (
                      <div style={styles.editForm}>
                        <input style={styles.inputSmall} value={editandoCarreira.icone} onChange={e => setEditandoCarreira({...editandoCarreira, icone: e.target.value})} />
                        <input style={styles.input} value={editandoCarreira.nome} onChange={e => setEditandoCarreira({...editandoCarreira, nome: e.target.value})} />
                        <input style={styles.input} value={editandoCarreira.capa} placeholder="URL da Capa" onChange={e => setEditandoCarreira({...editandoCarreira, capa: e.target.value})} />
                        <select style={styles.select} value={editandoCarreira.categoriaId} onChange={e => setEditandoCarreira({...editandoCarreira, categoriaId: e.target.value})}>
                           {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                        </select>
                        <button style={styles.saveButtonSmall} onClick={saveEditCarreira}>Salvar</button>
                        <button style={styles.cancelButtonSmall} onClick={cancelEditCarreira}>Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                          <span style={{cursor: 'grab', fontSize: '18px', color: '#888'}}>☰</span>
                          {renderIcon(carr.icone)}
                          <span style={{color: '#fff', fontWeight: 'bold'}}>{carr.nome}</span>
                          <span style={styles.itemDetail}>({categorias.find(cat => cat.id === carr.categoriaId)?.nome})</span>
                        </div>
                        <div style={styles.actionButtons}>
                          <button style={styles.editButton} onClick={() => editCarreira(carr)}>Editar</button>
                          <button style={styles.deleteButton} onClick={() => removeCarreira(carr.id)}>Excluir</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeMenu === 'preparatorios' && (
            <div>
              {!selectedPrepId ? (
                <>
                  <h2 style={{color: '#fff', marginBottom: 20}}>Gerenciar Cursos (Preparatórios)</h2>
                  <div style={styles.formCard}>
                    <h3 style={{color: '#F5F5F5', marginBottom: '12px'}}>Novo Curso</h3>
                    <div style={styles.addForm}>
                      <input style={styles.input} placeholder="Nome do Curso" value={novoPreparatorio.nome} onChange={e => setNovoPreparatorio({...novoPreparatorio, nome: e.target.value})} />
                      <div style={{display: 'flex', gap: '8px', flex: 1}}>
                        <input style={styles.input} placeholder="URL da Imagem ou Emoji" value={novoPreparatorio.logo} onChange={e => setNovoPreparatorio({...novoPreparatorio, logo: e.target.value})} />
                        <label style={{...styles.addButton, padding: '8px', fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer'}}>
                          📁 Desktop
                          <input type="file" style={{display: 'none'}} accept="image/*" onChange={(e) => handleFileUpload(e, 'novo')} />
                        </label>
                      </div>
                      <input style={styles.inputSmall} type="color" value={novoPreparatorio.cor} onChange={e => setNovoPreparatorio({...novoPreparatorio, cor: e.target.value})} title="Cor do Card" />
                      <button style={styles.addButton} onClick={addPreparatorio}>Adicionar Curso</button>
                    </div>
                  </div>

                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {preparatorios.map(prep => {
                      const discDoPrep = getDisciplinasPorPrep(prep.id);
                      return (
                        <div key={prep.id} style={{...styles.treeItem, padding: '16px', cursor: 'pointer'}} onClick={() => setSelectedPrepId(prep.id)}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                              {renderIcon(prep.logo)}
                              <span style={styles.treeName}>{prep.nome}</span>
                              <span style={styles.treeCount}>{discDoPrep.length} disciplinas</span>
                            </div>
                            <div style={{display: 'flex', gap: '8px'}}>
                              <button style={{...styles.editButton, padding: '6px 12px'}} onClick={(e) => { e.stopPropagation(); setSelectedPrepId(prep.id); }}>Conteúdo →</button>
                              <button style={{...styles.editButton, padding: '6px 12px', backgroundColor: '#4CAF50'}} onClick={(e) => { e.stopPropagation(); editPreparatorio(prep); }}>Editar</button>
                              <button style={styles.deleteButtonSmall} onClick={(e) => { e.stopPropagation(); removePreparatorio(prep.id); }}>Excluir</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                // ABA ISOLADA DO PREPARATÓRIO SELECIONADO
                <div style={{backgroundColor: '#1E1E1E', padding: '24px', borderRadius: '12px', border: '1px solid #333'}}>
                  {(() => {
                    const prep = preparatorios.find(p => p.id === selectedPrepId);
                    if (!prep) {
                      setSelectedPrepId(null);
                      return null;
                    }
                    const discDoPrep = getDisciplinasPorPrep(prep.id);
                    
                    return (
                      <>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                            <button onClick={() => setSelectedPrepId(null)} style={styles.backButton}>← Voltar</button>
                            {renderIcon(prep.logo)}
                            <h2 style={{color: '#fff', margin: 0}}>{prep.nome}</h2>
                          </div>
                          <span style={styles.treeCount}>{discDoPrep.length} disciplinas</span>
                        </div>

                        <div style={{...styles.formCard, marginBottom: '24px'}}>
                          <h3 style={{color: '#F5F5F5', marginBottom: '12px'}}>Nova Disciplina</h3>
                          <div style={styles.addForm}>
                            <input style={styles.inputSmall} placeholder="Ícone (🎬)" value={novaDisciplina.icone} onChange={e => setNovaDisciplina({...novaDisciplina, icone: e.target.value})} />
                            <input style={styles.input} placeholder="Nome da Disciplina" value={novaDisciplina.nome} onChange={e => setNovaDisciplina({...novaDisciplina, nome: e.target.value})} />
                            <button style={styles.addButton} onClick={() => addDisciplina(prep.id)}>Adicionar</button>
                          </div>
                        </div>

                        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                          {discDoPrep.map(disc => {
                            const modsDaDisc = getModulosPorDisciplina(disc.id);
                            const isDiscExpanded = expandedDisciplina === disc.id;
                            
                            return (
                              <div 
                                key={disc.id} 
                                style={{...styles.treeSubItem, borderLeft: '4px solid #2196F3', cursor: 'grab', opacity: draggedDisciplina === disc.id ? 0.5 : 1}}
                                draggable
                                onDragStart={(e) => {
                                  setDraggedDisciplina(disc.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDropDisciplina(e, disc.id, prep.id)}
                              >
                                <div style={styles.treeSubHeader} onClick={() => setExpandedDisciplina(isDiscExpanded ? null : disc.id)}>
                                  <span style={{cursor: 'grab', fontSize: '18px', color: '#888'}}>☰</span>
                                  <span>{disc.icone}</span>
                                  <span style={{...styles.treeName, fontSize: '16px'}}>{disc.nome}</span>
                                  <span style={styles.treeCount}>{modsDaDisc.length} módulos</span>
                                  <button style={styles.deleteButtonSmall} onClick={(e) => { e.stopPropagation(); removeDisciplina(disc.id); }}>Excluir</button>
                                  <span style={styles.treeArrow}>{isDiscExpanded ? '▼' : '▶'}</span>
                                </div>
                                
                                {isDiscExpanded && (
                                  <div style={styles.treeSubChildren}>
                                    <div style={{...styles.addForm, backgroundColor: '#252525', padding: '12px', borderRadius: '8px'}}>
                                      <input style={styles.input} placeholder="Nome do Módulo (Ex: Acentuação)" value={novoModulo.nome} onChange={e => setNovoModulo({...novoModulo, nome: e.target.value})} />
                                      <button style={styles.smallButton} onClick={() => addModulo(disc.id)}>Add Módulo</button>
                                    </div>
                                    
                                    {modsDaDisc.map(mod => {
                                      const aulasDoMod = getAulasPorModulo(mod.id);
                                      const isModExpanded = expandedModulo === mod.id;
                                      
                                      return (
                                        <div 
                                          key={mod.id} 
                                          style={{...styles.treeSubSubItem, cursor: 'grab', opacity: draggedModulo === mod.id ? 0.5 : 1}}
                                          draggable
                                          onDragStart={(e) => {
                                            e.stopPropagation();
                                            setDraggedModulo(mod.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                          }}
                                          onDragOver={(e) => e.preventDefault()}
                                          onDrop={(e) => {
                                            e.stopPropagation();
                                            handleDropModulo(e, mod.id, disc.id);
                                          }}
                                        >
                                          <div style={styles.treeSubSubHeader} onClick={() => setExpandedModulo(isModExpanded ? null : mod.id)}>
                                            <span style={{cursor: 'grab', fontSize: '16px', color: '#888'}}>☰</span>
                                            <span style={{...styles.treeName, fontSize: '14px', color: '#FFF'}}>📁 {mod.nome}</span>
                                            <span style={styles.treeCount}>{aulasDoMod.length} aulas</span>
                                            <button style={styles.deleteButtonSmall} onClick={(e) => { e.stopPropagation(); removeModulo(mod.id); }}>Excluir</button>
                                            <span style={styles.treeArrow}>{isModExpanded ? '▼' : '▶'}</span>
                                          </div>
                                          
                                          {isModExpanded && (
                                            <div style={styles.treeSubSubChildren}>
                                              <div style={{...styles.addForm, backgroundColor: '#2A2A2A', padding: '12px', borderRadius: '8px'}}>
                                                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                                  <label style={{fontSize: '11px', color: '#AAA'}}>Título</label>
                                                  <input style={styles.inputSmall} placeholder="Título da Aula" value={novaAula.titulo} onChange={e => setNovaAula(prev => ({...prev, titulo: e.target.value}))} />
                                                </div>
                                                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                                  <label style={{fontSize: '11px', color: '#AAA'}}>ID YouTube</label>
                                                  <input style={styles.inputSmall} placeholder="ID do YouTube" value={novaAula.videoId} onChange={e => setNovaAula(prev => ({...prev, videoId: e.target.value}))} />
                                                </div>
                                                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                                  <label style={{fontSize: '11px', color: '#AAA'}}>Duração</label>
                                                  <input style={styles.inputSmall} placeholder="Ex: 10:00" value={novaAula.duracao || ''} onChange={e => setNovaAula(prev => ({...prev, duracao: e.target.value}))} />
                                                </div>
                                                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                                  <label style={{fontSize: '11px', color: '#AAA'}}>Nível</label>
                                                  <select
                                                    style={{...styles.inputSmall, cursor: 'pointer',
                                                      backgroundColor: nivelNovaAula === 'premium' ? 'rgba(229,9,20,0.15)' : nivelNovaAula === 'medio' ? 'rgba(33,150,243,0.15)' : 'rgba(76,175,80,0.15)'
                                                    }}
                                                    value={nivelNovaAula}
                                                    onChange={e => setNivelNovaAula(e.target.value)}
                                                  >
                                                    <option value="basico">📘 Básico (livre)</option>
                                                    <option value="medio">🥈 Médio</option>
                                                    <option value="premium">🔒 Premium</option>
                                                  </select>
                                                </div>
                                                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                                  <label style={{fontSize: '11px', color: '#AAA'}}>Material PDF (Link)</label>
                                                  <input style={styles.inputSmall} placeholder="URL do PDF" value={novaAula.pdf_url || ''} onChange={e => setNovaAula(prev => ({...prev, pdf_url: e.target.value}))} />
                                                </div>
                                                <button style={{...styles.smallButton, backgroundColor: '#4CAF50', alignSelf: 'flex-end'}} onClick={() => addAula(mod.id)}>+ Add Aula</button>
                                              </div>
                                              
                                              <div style={{marginTop: '12px'}}>
                                                {[...aulasDoMod].sort((a,b) => (a.ordem||999) - (b.ordem||999)).map((aula, aulaIdx) => (
                                                  <div
                                                    key={aula.id}
                                                    draggable={!editandoAula}
                                                    onDragStart={e => handleDragStart(e, aula.id)}
                                                    onDragOver={e => handleDragOver(e, aula.id)}
                                                    onDrop={e => handleDrop(e, aula.id, mod.id)}
                                                    onDragEnd={() => { setDragAulaId(null); setDragOverAulaId(null); }}
                                                    style={{
                                                      ...styles.aulaItem,
                                                      opacity: dragAulaId === aula.id ? 0.35 : 1,
                                                      border: dragOverAulaId === aula.id && dragAulaId !== aula.id
                                                        ? '2px dashed #2196F3'
                                                        : '1px solid transparent',
                                                      borderRadius: '6px',
                                                      transition: 'border 0.15s, opacity 0.15s',
                                                      backgroundColor: dragOverAulaId === aula.id && dragAulaId !== aula.id
                                                        ? 'rgba(33,150,243,0.06)' : 'transparent'
                                                    }}
                                                  >
                                                    {editandoAula?.id === aula.id ? (
                                                      <div style={styles.editForm}>
                                                        <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                                                          <label style={{fontSize: '10px', color: '#AAA'}}>Título</label>
                                                          <input style={styles.inputSmall} value={editandoAula.titulo} onChange={e => setEditandoAula(prev => ({...prev, titulo: e.target.value}))} />
                                                        </div>
                                                        <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                                                          <label style={{fontSize: '10px', color: '#AAA'}}>ID YouTube</label>
                                                          <input style={styles.inputSmall} placeholder="ID YouTube" value={editandoAula.videoId} onChange={e => setEditandoAula(prev => ({...prev, videoId: e.target.value}))} />
                                                        </div>
                                                        <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                                                          <label style={{fontSize: '10px', color: '#AAA'}}>Duração</label>
                                                          <input style={styles.inputSmall} placeholder="Duração" value={editandoAula.duracao || ''} onChange={e => setEditandoAula(prev => ({...prev, duracao: e.target.value}))} />
                                                        </div>
                                                        <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                                                          <label style={{fontSize: '10px', color: '#AAA'}}>Nível</label>
                                                          <select style={{...styles.inputSmall, cursor: 'pointer'}} value={editandoAula.nivel || 'basico'} onChange={e => setEditandoAula(prev => ({...prev, nivel: e.target.value}))}>
                                                            <option value="basico">📘 Básico</option>
                                                            <option value="medio">🥈 Médio</option>
                                                            <option value="premium">🔒 Premium</option>
                                                          </select>
                                                        </div>
                                                        <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                                                          <label style={{fontSize: '10px', color: '#AAA'}}>Material PDF</label>
                                                          <input style={styles.inputSmall} placeholder="URL do PDF" value={editandoAula.pdf_url || ''} onChange={e => setEditandoAula(prev => ({...prev, pdf_url: e.target.value}))} />
                                                        </div>
                                                        <div style={{display: 'flex', gap: '4px', alignSelf: 'flex-end'}}>
                                                          <button style={styles.saveButtonSmall} onClick={updateAula}>Salvar</button>
                                                          <button style={styles.cancelButtonSmall} onClick={() => setEditandoAula(null)}>Cancelar</button>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <>
                                                        <div style={{display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', flex: 1}}>
                                                          {/* Grip handle */}
                                                          <span style={{cursor: 'grab', color: '#555', fontSize: '16px', padding: '0 4px', userSelect: 'none'}} title="Arrastar para reordenar">⠿</span>
                                                          <span style={{color: '#555', fontSize: '11px', minWidth: '18px'}}>#{aulaIdx+1}</span>
                                                          <span style={{color: '#EEE', fontSize: '14px'}}>{aula.titulo}</span>
                                                          <span style={{fontSize: '11px', color: '#AAA'}}>🕒 {aula.duracao || '--:--'}</span>
                                                          {aula.pdf_url && <span style={{fontSize: '10px', backgroundColor: '#4CAF50', color: '#FFF', padding: '1px 5px', borderRadius: '4px'}}>PDF</span>}
                                                          <span style={{
                                                            fontSize: '10px', padding: '2px 7px', borderRadius: '999px', fontWeight: 'bold',
                                                            backgroundColor: aula.nivel === 'premium' ? 'rgba(229,9,20,0.2)' : aula.nivel === 'medio' ? 'rgba(33,150,243,0.2)' : 'rgba(76,175,80,0.2)',
                                                            color: aula.nivel === 'premium' ? '#E50914' : aula.nivel === 'medio' ? '#2196F3' : '#4CAF50',
                                                            border: `1px solid ${aula.nivel === 'premium' ? '#E50914' : aula.nivel === 'medio' ? '#2196F3' : '#4CAF50'}`
                                                          }}>
                                                            {aula.nivel === 'premium' ? '🔒 Premium' : aula.nivel === 'medio' ? '🥈 Médio' : '📘 Básico'}
                                                          </span>
                                                          <span style={{fontSize: '11px', color: '#888', backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px'}}>ID: {aula.videoId}</span>
                                                        </div>
                                                        <div style={{display: 'flex', gap: '4px'}}>
                                                          <button style={styles.editButtonSmall} onClick={() => setEditandoAula(aula)}>Editar</button>
                                                          <button style={styles.deleteButtonSmall} onClick={() => removeAula(aula.id)}>X</button>
                                                        </div>
                                                      </>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {activeMenu === 'vincular' && (
            <div>
              <h2 style={{color: '#fff', marginBottom: 20}}>Vincular Conteúdos às Carreiras</h2>
              <div style={styles.formCard}>
                <label style={{color: '#AAA'}}>Selecione a Carreira para configurar seus vínculos:</label>
                <select style={{...styles.select, width: '100%', marginTop: '8px'}} value={selectedCarreira} onChange={e => setSelectedCarreira(e.target.value)}>
                  <option value="">-- Escolha uma Carreira --</option>
                  {carreiras.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                </select>
              </div>

              {selectedCarreira && (
                <div>
                  <h3 style={{color: '#F5F5F5', marginBottom: '16px'}}>Cursos Disponíveis</h3>
                  {preparatorios.map(prep => {
                    const vinculado = isPrepVinculado(selectedCarreira, prep.id);
                    const isExpanded = expandedPrepVinculo === prep.id;
                    
                    return (
                      <div key={prep.id} style={styles.vinculoPrepCard}>
                        <div style={styles.vinculoPrepHeader}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <label style={styles.checkboxLabel}>
                              <input type="checkbox" checked={vinculado} onChange={() => togglePrepVinculo(selectedCarreira, prep.id)} style={{width: '18px', height: '18px'}} />
                              <span style={styles.prepLogo}>{renderIcon(prep.logo)}</span>
                              <span style={styles.prepNome}>{prep.nome}</span>
                            </label>
                            {vinculado && (
                              <button style={{...styles.smallButton, backgroundColor: '#4CAF50', marginLeft: '12px'}} onClick={(e) => { e.stopPropagation(); selecionarTudoVinculo(selectedCarreira, prep.id); }}>
                                ☑️ Selecionar Tudo
                              </button>
                            )}
                          </div>
                          {vinculado && (
                            <button style={styles.expandButton} onClick={() => setExpandedPrepVinculo(isExpanded ? null : prep.id)}>
                              {isExpanded ? 'Esconder Módulos' : 'Ver Módulos'}
                            </button>
                          )}
                        </div>

                        {vinculado && isExpanded && (
                          <div style={styles.vinculoDetails}>
                            {getDisciplinasPorPrep(prep.id).map(disc => {
                              const isDiscExp = expandedDiscVinculo === disc.id;
                              const modulosDaDisc = getModulosPorDisciplina(disc.id);
                              
                              return (
                                <div key={disc.id} style={styles.vinculoDisciplina}>
                                  <div style={styles.vinculoDisciplinaHeader} onClick={() => setExpandedDiscVinculo(isDiscExp ? null : disc.id)}>
                                    <span>{disc.icone} {disc.nome}</span>
                                    <span>{isDiscExp ? '▼' : '▶'}</span>
                                  </div>
                                  
                                  {isDiscExp && (
                                    <div style={styles.vinculoModulos}>
                                      {modulosDaDisc.map(mod => {
                                        const modVinc = isModuloVinculado(selectedCarreira, prep.id, mod.id);
                                        
                                        return (
                                          <div key={mod.id} style={styles.vinculoModulo}>
                                            <label style={styles.checkboxLabel}>
                                              <input type="checkbox" checked={modVinc} onChange={() => toggleModuloVinculo(selectedCarreira, prep.id, mod.id)} />
                                              <span style={{color: '#FFF', fontWeight: 'bold'}}>Módulo: {mod.nome}</span>
                                            </label>
                                            
                                            {modVinc && (
                                              <div style={styles.vinculoAulas}>
                                                {getAulasPorModulo(mod.id).map(aula => (
                                                  <label key={aula.id} style={styles.checkboxLabelAula}>
                                                    <input type="checkbox" checked={isAulaVinculada(selectedCarreira, prep.id, mod.id, aula.id)} onChange={() => toggleAulaVinculo(selectedCarreira, prep.id, mod.id, aula.id)} />
                                                    <span style={{color: '#CCC', fontSize: '13px'}}>{aula.titulo} ({aula.duracao})</span>
                                                  </label>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Modal global de edição de preparatório */}
          {editandoPreparatorio && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{...styles.formCard, width: '420px', padding: '28px'}}>
                <h3 style={{color: '#FFF', marginBottom: '20px', fontSize: '18px'}}>✏️ Editar Curso</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
                  <div>
                    <label style={{color: '#AAA', fontSize: '12px', display: 'block', marginBottom: '6px'}}>Nome do Curso</label>
                    <input style={{...styles.input, width: '100%', boxSizing: 'border-box'}} placeholder="Nome" value={editandoPreparatorio.nome || ''} onChange={e => setEditandoPreparatorio({...editandoPreparatorio, nome: e.target.value})} />
                  </div>
                  <div>
                    <label style={{color: '#AAA', fontSize: '12px', display: 'block', marginBottom: '6px'}}>Imagem / Logo</label>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <input style={{...styles.input, flex: 1}} placeholder="URL ou Emoji" value={editandoPreparatorio.logo || ''} onChange={e => setEditandoPreparatorio({...editandoPreparatorio, logo: e.target.value})} />
                      <label style={{...styles.addButton, padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
                        📁 Desktop
                        <input type="file" style={{display: 'none'}} accept="image/*" onChange={(e) => handleFileUpload(e, 'edit')} />
                      </label>
                    </div>
                    {editandoPreparatorio.logo && (typeof editandoPreparatorio.logo === 'string') && (editandoPreparatorio.logo.startsWith('http') || editandoPreparatorio.logo.startsWith('data:')) && (
                      <img src={editandoPreparatorio.logo} alt="preview" style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', marginTop: '8px', border: '1px solid #444'}} />
                    )}
                  </div>
                  <div>
                    <label style={{color: '#AAA', fontSize: '12px', display: 'block', marginBottom: '6px'}}>Cor do Card</label>
                    <input style={{...styles.input, height: '44px', padding: '4px', cursor: 'pointer'}} type="color" value={editandoPreparatorio.cor || '#1a237e'} onChange={e => setEditandoPreparatorio({...editandoPreparatorio, cor: e.target.value})} />
                  </div>
                  <div style={{display: 'flex', gap: '10px', marginTop: '4px'}}>
                    <button style={{...styles.addButton, flex: 1, padding: '12px'}} onClick={saveEditPreparatorio}>✅ Salvar</button>
                    <button style={{...styles.deleteButton, flex: 1, padding: '12px'}} onClick={cancelEditPreparatorio}>❌ Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'documentos' && (
            <div>
              <h2 style={{color: '#fff', marginBottom: 20}}>Gerenciar Documentos Complementares</h2>
              
              <div style={styles.formCard}>
                <h3 style={{color: '#FFF', marginBottom: '15px'}}>➕ Adicionar Novo Documento</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  <input style={styles.input} placeholder="Título do Documento" value={novoDocumento.titulo} onChange={e => setNovoDocumento({...novoDocumento, titulo: e.target.value})} />
                  <input style={styles.input} placeholder="Descrição curta" value={novoDocumento.descricao} onChange={e => setNovoDocumento({...novoDocumento, descricao: e.target.value})} />
                  <div style={{display: 'flex', gap: '10px'}}>
                    <select style={{...styles.select, flex: 1}} value={novoDocumento.categoria} onChange={e => setNovoDocumento({...novoDocumento, categoria: e.target.value})}>
                      <option value="Simulado">Simulado</option>
                      <option value="Apostila">Apostila</option>
                      <option value="Edital">Edital</option>
                      <option value="Outros">Outros</option>
                    </select>
                    <div style={{flex: 2, display: 'flex', gap: '8px'}}>
                      <input style={{...styles.input, flex: 1}} placeholder="URL ou Upload ->" value={novoDocumento.url} onChange={e => setNovoDocumento({...novoDocumento, url: e.target.value})} />
                      <label style={{...styles.addButton, padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', backgroundColor: '#4CAF50'}}>
                        📁 Desktop
                        <input 
                          type="file" 
                          style={{display: 'none'}} 
                          accept=".pdf,.doc,.docx,.png,.jpg" 
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            
                            const fileExt = file.name.split('.').pop();
                            const fileName = `${Math.random()}.${fileExt}`;
                            const filePath = `${fileName}`;

                            const { data, error } = await supabase.storage
                              .from('documentos')
                              .upload(filePath, file);

                            if (error) {
                              alert('Erro no upload: ' + error.message);
                            } else {
                              const { data: { publicUrl } } = supabase.storage
                                .from('documentos')
                                .getPublicUrl(filePath);
                              setNovoDocumento({...novoDocumento, url: publicUrl});
                              alert('✅ Arquivo carregado com sucesso!');
                            }
                          }} 
                        />
                      </label>
                    </div>
                  </div>
                  <button style={styles.addButton} onClick={async () => {
                    if(!novoDocumento.titulo || !novoDocumento.url) return alert('Preencha título e selecione um arquivo');
                    const { error } = await supabase.from('documentos').insert([novoDocumento]);
                    if(!error) {
                      const { data } = await supabase.from('documentos').select('*').order('created_at', { ascending: false });
                      setDocumentos(data || []);
                      setNovoDocumento({ titulo: '', descricao: '', categoria: 'Simulado', url: '' });
                      alert('✅ Documento adicionado à Central!');
                    }
                  }}>
                    Adicionar à Central
                  </button>
                </div>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                {documentos.map(doc => (
                  <div key={doc.id} style={styles.item}>
                    {editandoDocumento?.id === doc.id ? (
                      <div style={styles.editForm}>
                        <input style={{...styles.input, flex: 1}} value={editandoDocumento.titulo} onChange={e => setEditandoDocumento({...editandoDocumento, titulo: e.target.value})} />
                        <select style={styles.select} value={editandoDocumento.categoria} onChange={e => setEditandoDocumento({...editandoDocumento, categoria: e.target.value})}>
                          <option value="Simulado">Simulado</option>
                          <option value="Apostila">Apostila</option>
                          <option value="Edital">Edital</option>
                          <option value="Outros">Outros</option>
                        </select>
                        <button style={styles.saveButtonSmall} onClick={async () => {
                           const { error } = await supabase.from('documentos').update(editandoDocumento).eq('id', doc.id);
                           if(!error) {
                             setDocumentos(documentos.map(d => d.id === doc.id ? editandoDocumento : d));
                             setEditandoDocumento(null);
                           }
                        }}>Salvar</button>
                        <button style={styles.cancelButtonSmall} onClick={() => setEditandoDocumento(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                          <span style={{fontSize: '24px'}}>{doc.categoria === 'Simulado' ? '📝' : doc.categoria === 'Apostila' ? '📚' : '📎'}</span>
                          <div>
                            <div style={{fontWeight: 'bold', color: '#FFF'}}>{doc.titulo}</div>
                            <div style={{fontSize: '12px', color: '#888'}}>{doc.categoria} • {doc.descricao}</div>
                          </div>
                        </div>
                        <div style={styles.actionButtons}>
                          <button style={styles.editButtonSmall} onClick={() => setEditandoDocumento(doc)}>Editar</button>
                          <button style={styles.deleteButton} onClick={async () => {
                            if(window.confirm('Excluir este documento?')) {
                              const { error } = await supabase.from('documentos').delete().eq('id', doc.id);
                              if(!error) setDocumentos(documentos.filter(d => d.id !== doc.id));
                            }
                          }}>Excluir</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeMenu === 'usuarios' && (
            <div>
              <h2 style={{color: '#fff', marginBottom: 20}}>Gerenciar Usuários</h2>
              {carregandoUsuarios ? (
                <div style={{color: '#AAA'}}>Carregando usuários...</div>
              ) : (
                <div style={{overflowX: 'auto', backgroundColor: '#1A1A1A', borderRadius: '12px', padding: '16px'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', color: '#FFF'}}>
                    <thead>
                      <tr style={{borderBottom: '1px solid #333', textAlign: 'left'}}>
                        <th style={{padding: '12px', color: '#AAA', fontWeight: '500'}}>Email</th>
                        <th style={{padding: '12px', color: '#AAA', fontWeight: '500'}}>Data de Criação</th>
                        <th style={{padding: '12px', color: '#AAA', fontWeight: '500'}}>Plano</th>
                        <th style={{padding: '12px', color: '#AAA', fontWeight: '500'}}>Acesso</th>
                        <th style={{padding: '12px', color: '#AAA', fontWeight: '500'}}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map(u => (
                        <tr key={u.id} style={{borderBottom: '1px solid #333', transition: 'background 0.2s'}}>
                          <td style={{padding: '20px 12px'}}>
                            <div style={{display: 'flex', flexDirection: 'column'}}>
                              <span style={{fontWeight: '600', fontSize: '15px'}}>{u.email}</span>
                              <span style={{color: '#888', fontSize: '11px', marginTop: '4px'}}>Criado em: {new Date(u.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </td>
                          
                          <td style={{padding: '20px 12px'}}>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                              <span style={{
                                padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', width: 'fit-content',
                                backgroundColor: u.plano === 'premium' ? 'rgba(76,175,80,0.15)' : u.plano === 'medio' ? 'rgba(33,150,243,0.15)' : 'rgba(255,152,0,0.15)',
                                color: u.plano === 'premium' ? '#4CAF50' : u.plano === 'medio' ? '#2196F3' : '#FF9800',
                                border: `1px solid ${u.plano === 'premium' ? '#4CAF50' : u.plano === 'medio' ? '#2196F3' : '#FF9800'}`
                              }}>
                                {u.plano === 'premium' ? '⭐ PREMIUM' : u.plano === 'medio' ? '🥈 MÉDIO' : '🔒 BÁSICO'}
                              </span>
                              <div style={{display: 'flex', gap: '6px'}}>
                                <button title="Premium" style={{...styles.smallButton, backgroundColor: '#4CAF50', padding: '4px 10px'}} onClick={() => atualizarPlano(u.id, 'premium')}>⭐</button>
                                <button title="Médio" style={{...styles.smallButton, backgroundColor: '#2196F3', padding: '4px 10px'}} onClick={() => atualizarPlano(u.id, 'medio')}>🥈</button>
                                <button title="Básico" style={{...styles.smallButton, backgroundColor: '#FF9800', padding: '4px 10px'}} onClick={() => atualizarPlano(u.id, 'basico')}>🔒</button>
                              </div>
                            </div>
                          </td>

                          <td style={{padding: '20px 12px'}}>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px'}}>
                              <div style={{
                                fontSize: '13px', fontWeight: '600', 
                                color: u.data_expiracao ? (new Date(u.data_expiracao) < new Date() ? '#E50914' : '#4CAF50') : '#FFD700',
                                display: 'flex', alignItems: 'center', gap: '6px'
                              }}>
                                {u.data_expiracao ? `📅 Expira: ${new Date(u.data_expiracao).toLocaleString('pt-BR')}` : '✨ Acesso Vitalício'}
                              </div>
                              <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
                                <button onClick={() => atualizarExpiracao(u.id, 15, 'minutos')} style={{...styles.smallButton, fontSize: '10px', backgroundColor: '#9C27B0', padding: '2px 6px'}}>⏱️ 15m</button>
                                <button onClick={() => atualizarExpiracao(u.id, 1)} style={{...styles.smallButton, fontSize: '10px', padding: '2px 6px'}}>+1d</button>
                                <button onClick={() => atualizarExpiracao(u.id, 7)} style={{...styles.smallButton, fontSize: '10px', padding: '2px 6px'}}>+7d</button>
                                <button onClick={() => atualizarExpiracao(u.id, 30)} style={{...styles.smallButton, fontSize: '10px', padding: '2px 6px'}}>+30d</button>
                                <button onClick={() => atualizarExpiracao(u.id, null)} style={{...styles.smallButton, fontSize: '10px', backgroundColor: '#FFD700', color: '#000', padding: '2px 6px'}}>∞ Vitalício</button>
                                <button 
                                  onClick={() => {
                                    if(window.confirm(`Deseja realmente BLOQUEAR o acesso de ${u.email}?`)) {
                                      atualizarPlano(u.id, 'basico');
                                      atualizarExpiracao(u.id, null);
                                    }
                                  }} 
                                  style={{...styles.smallButton, fontSize: '10px', backgroundColor: '#E53935', padding: '2px 6px'}}
                                >
                                  🚫 Bloquear
                                </button>
                                <input 
                                  type="date" 
                                  style={{backgroundColor: '#222', border: '1px solid #444', color: '#FFF', fontSize: '11px', padding: '2px 4px', borderRadius: '4px'}}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                      const d = new Date(val);
                                      atualizarExpiracao(u.id, Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24)));
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td style={{padding: '20px 12px'}}>
                            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                              <button 
                                onClick={() => abrirGerenciarAcesso(u)}
                                style={{...styles.editButtonSmall, padding: '4px 8px', fontSize: '11px'}}
                              >
                                📂 Acessos
                              </button>
                              <button 
                                onClick={() => {
                                  if (u.email === 'rodrigoalmeidja@gmail.com') {
                                     alert('Você já é o Super Admin por e-mail!');
                                  } else {
                                     alert('Para tornar outros usuários Admin, adicione a coluna "role" no seu Supabase Dashboard.');
                                  }
                                }}
                                style={{
                                  ...styles.editButtonSmall, 
                                  backgroundColor: u.email === 'rodrigoalmeidja@gmail.com' ? '#FFD700' : '#444',
                                  color: u.email === 'rodrigoalmeidja@gmail.com' ? '#000' : '#FFF',
                                  padding: '4px 8px', 
                                  fontSize: '11px',
                                  border: 'none'
                                }}
                              >
                                {u.email === 'rodrigoalmeidja@gmail.com' ? '👑 Super Admin' : '👤 Usuário'}
                              </button>
                              <button 
                                onClick={() => excluirUsuario(u.id, u.email)}
                                style={{...styles.deleteButton, padding: '4px 8px', fontSize: '11px'}}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal global de acesso do usuário */}
      {usuarioEditandoAcesso && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1A1A1A', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '560px', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column', gap: '16px',
            border: '1px solid #333'
          }}>
            <div>
              <h3 style={{color: '#FFF', margin: 0, fontSize: '18px'}}>🔑 Gerenciar Acesso</h3>
              <p style={{color: '#AAA', margin: '6px 0 0', fontSize: '13px'}}>{usuarioEditandoAcesso.email}</p>
            </div>

            <div style={{
              backgroundColor: '#222', borderRadius: '8px', padding: '12px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{color: '#CCC', fontSize: '13px'}}>
                {(usuarioEditandoAcesso.preparatorios_liberados?.length || 0) === 0
                  ? '✅ Acesso livre a todos os cursos'
                  : `${usuarioEditandoAcesso.preparatorios_liberados.length} curso(s) liberado(s)`
                }
              </span>
              <button
                style={{...styles.smallButton, backgroundColor: '#555', fontSize: '11px'}}
                onClick={() => setUsuarioEditandoAcesso(prev => ({...prev, preparatorios_liberados: []}))}
              >
                Liberar Todos
              </button>
            </div>

            <div style={{overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {preparatorios.map(prep => {
                const liberado = (usuarioEditandoAcesso.preparatorios_liberados || []).includes(prep.id);
                return (
                  <label key={prep.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                    backgroundColor: liberado ? 'rgba(21, 101, 192, 0.2)' : '#222',
                    border: `1px solid ${liberado ? '#1565C0' : '#333'}`,
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="checkbox"
                      checked={liberado}
                      onChange={() => toggleAcessoPrep(prep.id)}
                      style={{width: '16px', height: '16px', accentColor: '#1565C0'}}
                    />
                    {renderIcon(prep.logo)}
                    <span style={{color: '#FFF', fontWeight: '500', flex: 1}}>{prep.nome}</span>
                    {liberado && <span style={{color: '#1565C0', fontSize: '12px', fontWeight: 'bold'}}>✓ Liberado</span>}
                  </label>
                );
              })}
            </div>

            <div style={{display: 'flex', gap: '10px'}}>
              <button style={{...styles.addButton, flex: 1, padding: '12px'}} onClick={salvarAcessoUsuario}>✅ Salvar Acesso</button>
              <button style={{...styles.deleteButton, flex: 1, padding: '12px'}} onClick={() => setUsuarioEditandoAcesso(null)}>❌ Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStyles(isDark) {
  const bg = isDark ? '#121212' : '#F5F5F5';
  const text = isDark ? '#F5F5F5' : '#121212';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const inputBg = isDark ? '#222' : '#EAEAEA';
  const border = isDark ? '#333' : '#CCC';
  const headerBg = isDark ? '#111' : '#FFFFFF';
  const sidebarBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const textMuted = isDark ? '#AAA' : '#666';

  return {
    container: { minHeight: '100vh', backgroundColor: bg, fontFamily: 'Inter, sans-serif', color: text },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 40px', backgroundColor: headerBg, borderBottom: `1px solid ${border}` },
    title: { color: text, margin: 0, fontSize: '24px' },
    mainContainer: { display: 'flex' },
    sidebar: { width: '220px', backgroundColor: sidebarBg, minHeight: 'calc(100vh - 70px)', padding: '20px 0', borderRight: `1px solid ${border}` },
    menuButton: { width: '100%', padding: '14px 20px', backgroundColor: 'transparent', border: 'none', color: textMuted, cursor: 'pointer', textAlign: 'left', fontSize: '14px', transition: 'all 0.2s' },
    menuButtonActive: { backgroundColor: '#E50914', color: '#FFF' },
    content: { flex: 1, padding: '32px 40px', maxWidth: 'calc(100% - 220px)' },
    formCard: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', backgroundColor: cardBg, padding: '20px', borderRadius: '12px', border: `1px solid ${border}` },
    input: { padding: '12px', backgroundColor: inputBg, border: `1px solid ${border}`, color: text, borderRadius: '8px' },
    inputSmall: { padding: '8px', backgroundColor: inputBg, border: `1px solid ${border}`, color: text, borderRadius: '6px', fontSize: '12px' },
    inputMedium: { padding: '8px', backgroundColor: inputBg, border: `1px solid ${border}`, color: text, borderRadius: '6px', fontSize: '12px', width: '200px' },
    select: { padding: '12px', backgroundColor: inputBg, border: `1px solid ${border}`, color: text, borderRadius: '8px' },
    addButton: { padding: '12px', backgroundColor: '#2196F3', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
    smallButton: { padding: '8px 16px', backgroundColor: '#4CAF50', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    miniButton: { padding: '4px 8px', backgroundColor: '#555', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
    saveButtonSmall: { padding: '8px 12px', backgroundColor: '#2196F3', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer' },
    cancelButtonSmall: { padding: '8px 12px', backgroundColor: '#666', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer' },
    editButtonSmall: { padding: '4px 8px', backgroundColor: '#FF9800', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', marginRight: '4px' },
    deleteButton: { padding: '4px 12px', backgroundColor: '#E53935', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' },
    deleteButtonSmall: { padding: '2px 8px', backgroundColor: '#E53935', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', marginLeft: '8px' },
    item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: cardBg, borderRadius: '8px', border: `1px solid ${border}`, marginBottom: '8px', flexWrap: 'wrap', gap: '8px' },
    itemDetail: { fontSize: '12px', color: textMuted },
    actionButtons: { display: 'flex', gap: '4px' },
    moveButton: { padding: '4px 8px', backgroundColor: '#666', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
    editButton: { padding: '4px 8px', backgroundColor: '#FF9800', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' },
    editForm: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: '100%' },
    infoText: { color: textMuted, marginBottom: '20px' },
    prepTitle: { color: text, fontSize: '16px', margin: '20px 0 16px', borderLeft: '3px solid #E50914', paddingLeft: '12px' },
    treeItem: { marginBottom: '16px', border: `1px solid ${border}`, borderRadius: '8px', overflow: 'hidden' },
    treeHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: inputBg, cursor: 'pointer' },
    treeIcon: { fontSize: '20px' },
    treeName: { flex: 1, fontWeight: 'bold', color: text },
    treeCount: { fontSize: '12px', color: textMuted },
    treeArrow: { fontSize: '12px', color: textMuted },
    treeChildren: { padding: '16px', backgroundColor: cardBg, borderTop: `1px solid ${border}` },
    treeSubItem: { marginBottom: '12px', border: `1px solid ${border}`, borderRadius: '6px', overflow: 'hidden' },
    treeSubHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: inputBg, cursor: 'pointer' },
    treeSubChildren: { padding: '12px', backgroundColor: cardBg, borderTop: `1px solid ${border}` },
    treeSubSubItem: { marginBottom: '8px', border: `1px solid ${border}`, borderRadius: '4px', overflow: 'hidden' },
    treeSubSubHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: inputBg, cursor: 'pointer' },
    treeSubSubChildren: { padding: '10px', backgroundColor: cardBg, borderTop: `1px solid ${border}` },
    addForm: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' },
    aulaItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: inputBg, borderRadius: '4px', marginBottom: '4px' },
    carreirasGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' },
    carreiraCard: { display: 'flex', alignItems: 'center', gap: '16px', padding: '18px', backgroundColor: cardBg, borderRadius: '18px', border: `1px solid ${border}`, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 14px 24px rgba(0,0,0,0.1)' },
    carreiraCardSelected: { borderColor: '#E50914', backgroundColor: isDark ? '#1f131f' : '#ffebee', boxShadow: '0 18px 30px rgba(229,9,20,0.18)' },
    carreiraIcon: { fontSize: '30px', width: '40px', textAlign: 'center' },
    carreiraCardBody: { display: 'flex', flexDirection: 'column', gap: '4px' },
    carreiraNome: { fontSize: '16px', color: text, fontWeight: '700' },
    carreiraCapaLabel: { fontSize: '12px', color: textMuted, backgroundColor: inputBg, padding: '4px 8px', borderRadius: '999px', alignSelf: 'flex-start' },
    carreiraGroup: { marginBottom: '28px', paddingBottom: '16px', borderBottom: `1px solid ${border}` },
    carreiraGroupHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
    carreiraGroupIcon: { fontSize: '20px' },
    carreiraGroupTitle: { color: text, fontSize: '18px', fontWeight: '700', margin: 0 },
    vinculoPrepCard: { backgroundColor: cardBg, borderRadius: '12px', marginBottom: '16px', border: `1px solid ${border}`, overflow: 'hidden' },
    vinculoPrepHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: inputBg },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: text },
    prepLogo: { fontSize: '24px', marginRight: '4px' },
    prepNome: { fontSize: '16px', fontWeight: 'bold', color: text },
    expandButton: { padding: '6px 12px', backgroundColor: border, border: 'none', color: text, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    vinculoDetails: { padding: '20px', borderTop: `1px solid ${border}` },
    vinculoDisciplina: { marginBottom: '16px', backgroundColor: inputBg, borderRadius: '8px', overflow: 'hidden' },
    vinculoDisciplinaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: cardBg, cursor: 'pointer', fontWeight: 'bold', color: text },
    vinculoModulos: { padding: '12px' },
    vinculoModulo: { marginLeft: '16px', marginBottom: '12px', padding: '8px', backgroundColor: cardBg, borderRadius: '6px' },
    vinculoAulas: { marginLeft: '24px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' },
    checkboxLabelAula: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '4px 0', marginLeft: '16px', color: text }
  };
}

export default AdminPage;