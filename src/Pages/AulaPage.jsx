import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

// Mapeamento dos vídeos (SUBSTITUA PELOS SEUS IDs SE NECESSÁRIO)
// Agora usaremos preferencialmente o videoId que vem do banco de dados
const videosPorAula = {
  'projeto_caveira_portugues_aula1': 'Uph9feF6C38',
};

function AulaPage() {
  const { carreiraId, preparatorioId, disciplinaId, moduloId, aulaId } = useParams();
  const navigate = useNavigate();
  
  // Estados do Player
  const [player, setPlayer] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [tempoAtual, setTempoAtual] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  // Estados de Dados
  const [user, setUser] = useState(null);
  const [planoUsuario, setPlanoUsuario] = useState(null);
  const [temAcesso, setTemAcesso] = useState(true);
  const [carregandoAcesso, setCarregandoAcesso] = useState(true);
  
  // Novos Estados para a Barra Lateral
  const [disciplina, setDisciplina] = useState(null);
  const [listaDisciplinas, setListaDisciplinas] = useState([]); // Todas as disciplinas do curso
  const [modulo, setModulo] = useState(null);
  const [listaModulos, setListaModulos] = useState([]); // Lista de todos os módulos da disciplina
  const [listaAulas, setListaAulas] = useState([]);
  const [progressoAulas, setProgressoAulas] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('curso'); // 'curso' ou 'cronograma'
  const [activeSubTab, setActiveSubTab] = useState('video'); // 'video', 'pdf', 'anotacoes'
  const [showModulosMenu, setShowModulosMenu] = useState(false);
  const [showDisciplinasMenu, setShowDisciplinasMenu] = useState(false);

  // Estados de navegação local (para explorar sem trocar o vídeo)
  const [browsingDisciplinaId, setBrowsingDisciplinaId] = useState(disciplinaId);
  const [browsingModuloId, setBrowsingModuloId] = useState(moduloId);
  const [browsingDisciplina, setBrowsingDisciplina] = useState(null);
  const [browsingModulo, setBrowsingModulo] = useState(null);
  const [anotacao, setAnotacao] = useState('');
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false);

  const timerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const playerRef = useRef(null);
  const containerRef = useRef(null);

  const [aulaPlaying, setAulaPlaying] = useState(null); // Dados da aula que está SENDO ASSISTIDA
  const videoKey = `${preparatorioId}_${disciplinaId}_${aulaId}`;
  
  // Só definimos o videoId se tivermos os dados ou se for um ID conhecido
  const [videoId, setVideoId] = useState(null);

  useEffect(() => {
    const id = aulaPlaying?.video_id || aulaPlaying?.videoId || videosPorAula[videoKey];
    if (id) {
      setVideoId(id);
    } else if (aulaPlaying) {
      // Se carregou a aula e não tem ID, fallback final
      setVideoId('dQw4w9WgXcQ');
    }
  }, [aulaPlaying, videoKey]);


  const velocidades = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // Pegar usuário logado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  // Buscar anotações da aula
  useEffect(() => {
    if (!user || !aulaId) return;

    const carregarAnotacao = async () => {
      const { data, error } = await supabase
        .from('anotacoes')
        .select('conteudo')
        .eq('user_id', user.id)
        .eq('aula_id', aulaId)
        .single();
      
      if (data) {
        setAnotacao(data.conteudo);
      } else {
        setAnotacao('');
      }
    };

    carregarAnotacao();
  }, [user, aulaId]);

  const salvarAnotacao = async (novoConteudo) => {
    if (!user || !aulaId) return;
    setSalvandoAnotacao(true);

    const { error } = await supabase
      .from('anotacoes')
      .upsert({ 
        user_id: user.id, 
        aula_id: aulaId, 
        conteudo: novoConteudo,
        updated_at: new Date()
      }, { onConflict: 'user_id, aula_id' });

    if (error) {
      console.error('Erro ao salvar anotação:', error);
    }
    setSalvandoAnotacao(false);
  };

  // Debounce para auto-salvamento
  useEffect(() => {
    if (anotacao === '') return;
    const delayDebounceFn = setTimeout(() => {
      salvarAnotacao(anotacao);
    }, 2000); // Salva após 2 segundos de inatividade

    return () => clearTimeout(delayDebounceFn);
  }, [anotacao]);

  // Buscar plano do usuário na tabela profiles
  useEffect(() => {
    if (!user) return;
    
    const buscarPlano = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setPlanoUsuario(data.plano);
      }
    };
    
    buscarPlano();
  }, [user]);

 // Verificar acesso do aluno baseado no plano
useEffect(() => {
  if (!user || !planoUsuario) return;
  
  const verificarAcesso = async () => {
    setCarregandoAcesso(true);
    
    // ADMIN (plano premium) sempre tem acesso liberado
    if (planoUsuario === 'premium') {
      setTemAcesso(true);
      setCarregandoAcesso(false);
      return;
    }
    
    let planoId = 1; // padrão básico
    if (planoUsuario === 'medio') planoId = 2;
    
    const { data, error } = await supabase
      .from('aulas_liberadas')
      .select('id')
      .eq('plano_id', planoId)
      .eq('aula_id', videoKey)
      .single();
    
    setTemAcesso(!!data);
    setCarregandoAcesso(false);
  };
  
  verificarAcesso();
}, [user, planoUsuario, videoKey]);

  // Buscar dados da disciplina, módulo e aulas
  useEffect(() => {
    const carregarDados = async () => {
      try {
        // Disciplina Atual (para o cabeçalho)
        if (!disciplina) {
          const { data: d } = await supabase.from('disciplinas').select('*').eq('id', disciplinaId).single();
          setDisciplina(d);
        }

        // Dados de Navegação (Módulos e Aulas) baseados no que o usuário está "explorando"
        const { data: discExplora } = await supabase.from('disciplinas').select('*').eq('id', browsingDisciplinaId).single();
        setBrowsingDisciplina(discExplora);

        const { data: modExplora } = await supabase.from('modulos').select('*').eq('id', browsingModuloId).single();
        setBrowsingModulo(modExplora);

        // Todas as Disciplinas do Preparatório
        const { data: todasDisciplinas } = await supabase
          .from('disciplinas')
          .select('*')
          .eq('preparatorio_id', preparatorioId)
          .order('nome', { ascending: true });
        setListaDisciplinas(todasDisciplinas || []);

        // BUSCA DE AULAS DO MÓDULO EXPLORADO
        let aulasFinais = [];
        const normalizar = (lista) => (lista || []).map(a => ({
          ...a,
          moduloId: a.moduloId || a.modulo_id,
          videoId: a.videoId || a.video_id,
          video_id: a.video_id || a.videoId,
          duracao: a.duracao || a.duracao_str || null,
          pdf_url: a.pdf_url || null
        }));


        // Todos os Módulos da Disciplina que está sendo explorada
        const { data: todosModulos } = await supabase
          .from('modulos')
          .select('*')
          .eq('disciplina_id', browsingDisciplinaId)
          .order('id', { ascending: true });
        setListaModulos(todosModulos || []);

        if (todosModulos && todosModulos.length > 0) {
          const { data: aulasData } = await supabase
            .from('aulas')
            .select('*')
            .eq('modulo_id', browsingModuloId)
            .order('ordem', { ascending: true });
          
          aulasFinais = normalizar(aulasData);
        }
        setListaAulas(aulasFinais);

        // BUSCAR DADOS DA AULA QUE ESTÁ SENDO ASSISTIDA (PLAYER)
        const fetchPlaying = async () => {
          const normalizar = (lista) => (lista || []).map(a => ({
            ...a,
            moduloId: a.moduloId || a.modulo_id,
            videoId: a.videoId || a.video_id,
            video_id: a.video_id || a.videoId
          }));

          if (aulaId === 'primeira_aula') {
              const { data: realModAulas } = await supabase.from('aulas').select('*').eq('modulo_id', moduloId).order('ordem', { ascending: true }).limit(1);
              if (realModAulas && realModAulas.length > 0) {
                const aulaReal = normalizar(realModAulas)[0];
                setAulaPlaying(aulaReal);
                navigate(`/aula/${carreiraId}/${preparatorioId}/${disciplinaId}/${moduloId}/${aulaReal.id}`, { replace: true });
              }
          } else {
              const { data: aulaSolo } = await supabase.from('aulas').select('*').eq('id', aulaId).single();
              if (aulaSolo) setAulaPlaying(normalizar([aulaSolo])[0]);
          }
        };
        fetchPlaying();

      } catch (err) {
        console.error('Erro inesperado no carregarDados:', err);
      }
    };
    carregarDados();
  }, [disciplinaId, moduloId, browsingDisciplinaId, browsingModuloId, aulaId]);

  // Sincronizar o estado de browsing quando a URL mudar de verdade (ex: usuário clicou em uma aula)
  useEffect(() => {
    setBrowsingDisciplinaId(disciplinaId);
    setBrowsingModuloId(moduloId);
  }, [disciplinaId, moduloId]);

  // Carregar progresso do Supabase
  useEffect(() => {
    if (!user || listaAulas.length === 0) return;
    
    const carregarProgressoModulo = async () => {
      try {
        const idsAulas = listaAulas.map(a => a.id);
        const { data, error } = await supabase
          .from('progresso')
          .select('aula_id, tempo_assistido, concluida')
          .eq('user_id', user.id)
          .in('aula_id', idsAulas);
        
        if (data && !error) {
          const progressoMap = {};
          data.forEach(p => {
            progressoMap[p.aula_id] = p;
          });
          setProgressoAulas(progressoMap);
          
          // Se a aula atual tiver progresso salvo e for o primeiro carregamento do vídeo
          const progressoAtual = progressoMap[aulaId];
          if (progressoAtual && player && playerReady && tempoAtual === 0) {
            player.seekTo(progressoAtual.tempo_assistido || 0, true);
            setTempoAtual(progressoAtual.tempo_assistido || 0);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar progresso:', err);
      }
    };
    
    carregarProgressoModulo();
  }, [user, listaAulas, aulaId, playerReady]);

  // Salvar progresso no Supabase
  const salvarProgresso = async (tempo) => {
    if (!user || !temAcesso) return;
    
    const isConcluida = tempo > (duracao * 0.9); // Marca como concluída se assistiu 90%

    await supabase
      .from('progresso')
      .upsert({
        user_id: user.id,
        aula_id: aulaId,
        tempo_assistido: Math.floor(tempo),
        concluida: isConcluida,
        ultimo_acesso: new Date()
      }, {
        onConflict: 'user_id, aula_id'
      });
      
    if (isConcluida) {
      setProgressoAulas(prev => ({
        ...prev,
        [aulaId]: { ...prev[aulaId], concluida: true }
      }));
    }
  };

  const salvarPdfUrl = async (novaUrl) => {
    if (planoUsuario !== 'premium') return;
    const { error } = await supabase.from('aulas').update({ pdf_url: novaUrl }).eq('id', aulaId);
    if (!error) {
      setAulaPlaying(prev => ({ ...prev, pdf_url: novaUrl }));
      setListaAulas(prev => prev.map(a => a.id === aulaId ? { ...a, pdf_url: novaUrl } : a));
      alert('PDF atualizado com sucesso!');
    } else {
      alert('Erro ao salvar PDF: ' + error.message);
    }
  };

  useEffect(() => {
    // Carregar a API do YouTube se ainda não estiver carregada
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    const stopProgressTracking = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };

    const startProgressTracking = (currentPlayer) => {
      stopProgressTracking();
      progressIntervalRef.current = setInterval(() => {
        if (currentPlayer && typeof currentPlayer.getCurrentTime === 'function') {
          try {
            const tempo = currentPlayer.getCurrentTime();
            setTempoAtual(tempo);
            salvarProgresso(tempo);
          } catch (e) {
            console.error('Erro no tracking de progresso:', e);
            stopProgressTracking();
          }
        }
      }, 5000);
    };

    const initPlayer = () => {
      if (!videoId) return; // Não inicializa sem ID real
      
      setPlayerReady(false);
      stopProgressTracking();
      
      if (player) {
        try { player.destroy(); } catch (e) {}
      }

      const newPlayer = new window.YT.Player(playerRef.current, {
        videoId: videoId,
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          autoplay: 1,
          playsinline: 1
        },
        events: {
          onReady: (event) => {
            setPlayerReady(true);
            const videoDur = event.target.getDuration();
            setDuracao(videoDur);
            
            // Salvar duração no banco se ainda não tiver (para aparecer na barra lateral depois)
            if (aulaId && (!aulaPlaying?.duracao)) {
              supabase
                .from('aulas')
                .update({ duracao: videoDur })
                .eq('id', aulaId)
                .then(({ error }) => {
                  if (!error) {
                    // Atualiza a lista local para refletir na barra lateral imediatamente
                    setListaAulas(prev => prev.map(a => a.id === aulaId ? { ...a, duracao: videoDur } : a));
                  }
                });
            }

            // Se o tempo atual for > 0 (progresso), seek logo no início
            if (tempoAtual > 0) event.target.seekTo(tempoAtual, true);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              startProgressTracking(event.target);
            } else {
              if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              }
              if (event.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                salvarProgresso(duracao); // Marca como concluída no final
              }
              stopProgressTracking();
            }
          }
        }
      });
      setPlayer(newPlayer);
    };

    if (videoId) {
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }
    }

    return () => {
      stopProgressTracking();
      if (player) {
        try { player.destroy(); } catch (e) {}
      }
    };
  }, [videoId === null]); // Só inicializa na primeira vez que o videoId deixa de ser null
  
  // Efeito para trocar de vídeo sem destruir o player (mais rápido)
  useEffect(() => {
    if (player && playerReady && videoId && typeof player.loadVideoById === 'function') {
      player.loadVideoById(videoId);
      setIsPlaying(true);
    }
  }, [videoId, player, playerReady]);


  // Aplicar volume quando o player estiver pronto
  useEffect(() => {
    if (player && playerReady && typeof player.setVolume === 'function') {
      try {
        player.setVolume(volume);
      } catch (e) {
        console.error('Erro ao definir volume:', e);
      }
    }
  }, [volume, player, playerReady]);

  // Botão Play/Pause unificado
  const togglePlayPause = () => {
    if (!player || typeof player.pauseVideo !== 'function') return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  const handleBackward = () => {
    if (!player || typeof player.getCurrentTime !== 'function') return;
    const novoTempo = Math.max(0, player.getCurrentTime() - 10);
    player.seekTo(novoTempo, true);
    setTempoAtual(novoTempo);
    salvarProgresso(novoTempo);
  };

  const handleForward = () => {
    if (!player || typeof player.getCurrentTime !== 'function') return;
    const novoTempo = Math.min(duracao, player.getCurrentTime() + 10);
    player.seekTo(novoTempo, true);
    setTempoAtual(novoTempo);
    salvarProgresso(novoTempo);
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekChange = (e) => {
    const novoTempo = parseFloat(e.target.value);
    setTempoAtual(novoTempo);
  };

  const handleSeekEnd = () => {
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(tempoAtual, true);
      salvarProgresso(tempoAtual);
    }
    setIsSeeking(false);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (newVolume === 0) setMuted(true);
    else setMuted(false);
  };

  const handleMute = () => {
    if (muted) {
      setVolume(100);
      setMuted(false);
    } else {
      setVolume(0);
      setMuted(true);
    }
  };

  const mudarVelocidade = (novaVelocidade) => {
    setVelocidade(novaVelocidade);
    if (player && typeof player.setPlaybackRate === 'function') {
      player.setPlaybackRate(novaVelocidade);
    }
  };

  const entrarTelaCheia = () => {
    const elem = containerRef.current;
    if (elem?.requestFullscreen) elem.requestFullscreen();
    else if (elem?.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    setIsFullscreen(true);
    setShowControls(true);
  };

  const sairTelaCheia = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    setIsFullscreen(false);
    setShowControls(true);
  };

  const handleMouseMove = () => {
    if (isFullscreen) {
      setShowControls(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    if (isFullscreen) {
      timerRef.current = setTimeout(() => setShowControls(false), 3000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setShowControls(true);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement || !!document.webkitFullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) setShowControls(true);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const formatarTempo = (segundos) => {
    if (!segundos || isNaN(segundos)) return '0:00';
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = Math.floor(segundos % 60);
    if (horas > 0) return `${horas}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  };

  const progressoPercentual = duracao > 0 ? (tempoAtual / duracao) * 100 : 0;

// Tela de carregamento (desabilitado temporariamente)
// if (carregandoAcesso) {
//   return (
//     <div style={styles.appContainer}>
//       <div style={styles.loadingContainer}>
//         Verificando seu acesso...
//       </div>
//     </div>
//   );
// }

// Tela de acesso negado (desabilitado temporariamente)
// if (!temAcesso) {
//   return (
//     <div style={styles.appContainer}>
//       <div style={styles.acessoNegadoContainer}>
//         <h2>🔒 Acesso Bloqueado</h2>
//         <p>Esta aula não está disponível no seu plano atual.</p>
//         <button onClick={() => navigate('/planos')} style={styles.botaoUpgrade}>
//           Ver Planos Disponíveis →
//         </button>
//         <button onClick={() => navigate(-1)} style={styles.botaoVoltar}>
//           Voltar para o curso
//         </button>
//       </div>
//     </div>
//   );
// }
  return (
    <div style={styles.appContainer} className="aula-app-container" onMouseMove={handleMouseMove}>
      <header style={styles.header} className="aula-header">
        {/* Branding Papirando Concursos no canto esquerdo (padrão) */}
        <div style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', paddingLeft: '10px'}} onClick={() => navigate('/')} className="aula-brand">
          <img src="/logos/PNG.png" alt="Logo Papirando" style={{width: '35px', height: '35px', borderRadius: '50%'}} />
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <span style={{fontSize: '16px', color: '#9e040c', fontWeight: 'bold', letterSpacing: '1px'}}>PAPIRANDO</span>
            <span style={{fontSize: '6px', color: '#FFF', letterSpacing: '7px', marginTop: '-3px'}}>CONCURSOS</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }} className="aula-header-right">
          <div style={{...styles.headerInfo, marginRight: '20px', textAlign: 'right'}} className="aula-header-title">
            <h1 style={styles.headerTitle}>{disciplina?.nome || disciplinaId?.replace('_', ' ').toUpperCase()}</h1>
            <p style={styles.headerSubtitulo}>{preparatorioId?.replace('_', ' ').toUpperCase()}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }} className="aula-header-buttons">
            <div style={{marginRight: '15px', display: 'flex', alignItems: 'center', gap: '10px'}}>
               {userName === 'Aluno' || !user ? (
                 <button 
                  onClick={() => navigate('/login')} 
                  style={{backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '7px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', boxShadow: '0 2px 10px rgba(229,9,20,0.3)'}}
                 >
                  ENTRAR
                 </button>
               ) : (
                 <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{color: '#EEE', fontSize: '12px'}}>Olá, {userName}</span>
                    <button onClick={handleLogout} style={{backgroundColor: 'transparent', border: '1px solid #E50914', color: '#E50914', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px'}}>Sair</button>
                 </div>
               )}
            </div>
            <button 
              onClick={() => navigate(`/preparatorio/${carreiraId}/${preparatorioId}`)} 
              style={styles.backButton}
              className="back-btn"
            >
              ← Voltar
            </button>
            <button 
              onClick={() => navigate('/')} 
              style={styles.backButton}
              className="back-btn"
            >
              🏠
            </button>
          </div>
        </div>
      </header>

      <div style={styles.mainContainer} className="aula-main-container">
        <div style={styles.playerSection} className="player-section">
          <div 
            ref={containerRef} 
            style={styles.playerContainer}
            className="player-container"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => !isFullscreen && setShowControls(false)}
          >
            <div ref={playerRef} style={styles.player}></div>
            
            {/* Camadas de bloqueio para evitar saída para o YouTube */}
            <div style={isFullscreen ? styles.blockTopFullscreen : styles.blockTop}></div>
            <div style={styles.blockBottomRight}></div>
            <div style={styles.blockFull} onClick={togglePlayPause}></div>
            
            {/* Overlay de Controles Moderno */}
            <div 
              style={{
                ...styles.controlsOverlay,
                opacity: showControls || !isPlaying ? 1 : 0,
                pointerEvents: showControls || !isPlaying ? 'auto' : 'none'
              }}
              onClick={(e) => {
                // Se clicar no fundo do overlay (não em um botão), dá play/pause
                if (e.target === e.currentTarget) togglePlayPause();
              }}
            >
              {/* Botão Central de Play/Pause (opcional, dá um toque premium) */}
              <div style={styles.centerPlayButton} onClick={togglePlayPause}>
                {isPlaying ? null : <span style={styles.centerPlayIcon}>▶</span>}
              </div>

              {/* Barra de Controles Inferior */}
              <div style={styles.bottomControlsBar}>
                {/* Barra de Progresso */}
                <div style={styles.modernProgressContainer}>
                  <input
                    type="range"
                    min="0"
                    max={duracao || 0}
                    value={tempoAtual}
                    onMouseDown={handleSeekStart}
                    onChange={handleSeekChange}
                    onMouseUp={handleSeekEnd}
                    style={styles.modernProgressSlider}
                    step="0.1"
                  />
                  <div style={styles.modernProgressBase}>
                    <div style={{ ...styles.modernProgressFill, width: `${progressoPercentual}%` }} />
                    <div style={{ ...styles.modernProgressHandle, left: `${progressoPercentual}%` }} />
                  </div>
                </div>

                <div style={styles.controlsRow}>
                  <div style={styles.controlsGroupLeft}>
                    <button onClick={togglePlayPause} style={styles.modernControlButton} title={isPlaying ? 'Pausar' : 'Reproduzir'}>
                      {isPlaying ? '⏸' : '▶'}
                    </button>
                    
                    <button onClick={handleBackward} style={styles.modernControlButton} title="-10 segundos">↺</button>
                    <button onClick={handleForward} style={styles.modernControlButton} title="+10 segundos">↻</button>

                    <div 
                      style={styles.modernVolumeGroup}
                      onMouseEnter={() => setIsVolumeHovered(true)}
                      onMouseLeave={() => setIsVolumeHovered(false)}
                    >
                      <button onClick={handleMute} style={styles.modernControlButton}>
                        {muted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
                      </button>
                      <div style={{
                        ...styles.volumeSliderWrapper,
                        width: isVolumeHovered ? '80px' : '0px',
                        opacity: isVolumeHovered ? 1 : 0
                      }}>
                        <input type="range" min="0" max="100" value={volume} onChange={handleVolumeChange} style={styles.modernVolumeSlider} />
                      </div>
                    </div>

                    <div style={styles.modernTimeDisplay}>
                      <span style={styles.timeCurrent}>{formatarTempo(tempoAtual)}</span>
                      <span style={styles.timeDivider}>/</span>
                      <span style={styles.timeTotal}>{formatarTempo(duracao)}</span>
                    </div>
                  </div>

                  <div style={styles.controlsGroupRight}>
                    <div style={styles.speedSelectorWrapper}>
                      <span style={styles.speedLabel}>{velocidade}x</span>
                      <select 
                        value={velocidade} 
                        onChange={(e) => mudarVelocidade(parseFloat(e.target.value))} 
                        style={styles.hiddenSpeedSelect}
                      >
                        {velocidades.map(v => <option key={v} value={v}>{v}x</option>)}
                      </select>
                    </div>

                    {!isFullscreen ? (
                      <button onClick={entrarTelaCheia} style={styles.modernControlButton} title="Tela Cheia">⛶</button>
                    ) : (
                      <button onClick={sairTelaCheia} style={styles.modernControlButton} title="Sair da Tela Cheia">❐</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.listaSection}>
          <div style={styles.sidebarHeader}>
            <h2 style={styles.sidebarTitle}>Selecione o conteúdo</h2>
            
            <div style={styles.tabsContainer}>
              <button 
                onClick={() => setActiveTab('curso')} 
                style={{...styles.tabButton, ...(activeTab === 'curso' ? styles.tabButtonActive : {})}}
              >
                Aulas Curso
              </button>
              <button 
                onClick={() => setActiveTab('cronograma')} 
                style={{...styles.tabButton, ...(activeTab === 'cronograma' ? styles.tabButtonActive : {})}}
              >
                Aulas Cronograma
              </button>
            </div>

            <div style={styles.subTabsContainer}>
              <button 
                onClick={() => setActiveSubTab('video')} 
                style={{...styles.subTabButton, ...(activeSubTab === 'video' ? styles.subTabActive : {})}}
              >
                <span style={styles.subTabIcon}>▶</span> Vídeo
              </button>
              <button 
                onClick={() => setActiveSubTab('pdf')} 
                style={{...styles.subTabButton, ...(activeSubTab === 'pdf' ? styles.subTabActive : {})}}
              >
                PDF
              </button>
              <button 
                onClick={() => setActiveSubTab('anotacoes')} 
                style={{...styles.subTabButton, ...(activeSubTab === 'anotacoes' ? styles.subTabActive : {})}}
              >
                Anotações
              </button>
            </div>
          </div>

          <div style={{...styles.infoBox, cursor: 'pointer'}} onClick={() => setShowDisciplinasMenu(!showDisciplinasMenu)}>
            <div style={styles.infoRow}>
              <div style={styles.infoLabel}>DISCIPLINA</div>
              <button style={styles.verTudo}>{showDisciplinasMenu ? 'fechar' : 'ver todas'} <span>›</span></button>
            </div>
            <div style={styles.infoValue}>{browsingDisciplina?.nome || 'Carregando...'}</div>
          </div>

          {showDisciplinasMenu && (
            <div style={styles.modulosMenu}>
              {listaDisciplinas.map(d => (
                <div 
                  key={d.id} 
                  style={{...styles.moduloItem, ...(d.id === browsingDisciplinaId ? styles.moduloItemActive : {})}}
                  onClick={async () => {
                    setBrowsingDisciplinaId(d.id);
                    // Ao trocar disciplina, precisamos buscar o primeiro módulo dela para browsing também
                    const { data: firstM } = await supabase.from('modulos').select('id').eq('disciplina_id', d.id).order('id', { ascending: true }).limit(1).single();
                    if (firstM) setBrowsingModuloId(firstM.id);
                    setShowDisciplinasMenu(false);
                  }}
                >
                  {d.icone} {d.nome}
                </div>
              ))}
            </div>
          )}

          <div style={{...styles.infoBox, borderBottom: '1px solid #222', cursor: 'pointer'}} onClick={() => setShowModulosMenu(!showModulosMenu)}>
            <div style={styles.infoRow}>
              <div style={styles.infoLabel}>TÓPICO</div>
              <button style={styles.verTudo}>{showModulosMenu ? 'fechar' : 'ver todos'} <span>›</span></button>
            </div>
            <div style={styles.infoValue}>{browsingModulo?.nome || 'Carregando...'}</div>
          </div>

          {showModulosMenu && (
            <div style={styles.modulosMenu}>
              {listaModulos.map(m => (
                <div 
                  key={m.id} 
                  style={{...styles.moduloItem, ...(m.id === browsingModuloId ? styles.moduloItemActive : {})}}
                  onClick={() => {
                    setBrowsingModuloId(m.id);
                    setShowModulosMenu(false);
                  }}
                >
                  {m.nome}
                </div>
              ))}
            </div>
          )}

          <div style={styles.searchContainer}>
            <div style={styles.searchWrapper}>
              <input 
                type="text" 
                placeholder="Pesquisar por aula" 
                style={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span style={styles.searchIcon}>🔍</span>
            </div>
          </div>

          <div style={styles.listaAulas}>
            {activeSubTab === 'video' && listaAulas
              .filter(a => a.titulo.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((aula, index) => {
                const isSelected = String(aula.id) === String(aulaId);
                const progresso = progressoAulas[aula.id];
                const concluida = progresso?.concluida;

                return (
                  <div
                    key={aula.id}
                    style={{...styles.itemAula, ...(isSelected ? styles.itemAulaSelected : {})}}
                    onClick={() => {
                      // Ao clicar na aula, aí sim navegamos de verdade e mudamos o vídeo
                      navigate(`/aula/${carreiraId}/${preparatorioId}/${browsingDisciplinaId}/${browsingModuloId}/${aula.id}`);
                    }}
                  >
                    <div style={styles.itemAulaLeft}>
                      <div style={{...styles.checkCircle, ...(concluida ? styles.checkCircleActive : {})}}>
                        {concluida && '✓'}
                      </div>
                      <div style={styles.itemAulaInfo}>
                        <span style={{...styles.itemAulaTitulo, ...(isSelected ? styles.itemAulaTituloSelected : {})}}>
                          {index + 1} - {aula.titulo}
                        </span>
                        <span style={styles.itemAulaDuracao}>
                          {aula.duracao
                            ? (typeof aula.duracao === 'number'
                                ? formatarTempo(aula.duracao)
                                : aula.duracao)
                            : '--:--'}
                        </span>
                      </div>
                    </div>
                    <div style={styles.itemAulaRight}>
                      <button style={styles.moreButton}>⋮</button>
                    </div>
                  </div>
                );
              })}

            {activeSubTab === 'pdf' && (
              <div style={{padding: '20px'}}>
                <h3 style={{fontSize: '16px', marginBottom: '15px'}}>Material em PDF</h3>
                {aulaPlaying?.pdf_url ? (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    <a 
                      href={aulaPlaying.pdf_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        padding: '12px', backgroundColor: '#E50914', color: '#FFF', 
                        borderRadius: '8px', textDecoration: 'none', textAlign: 'center', fontWeight: 'bold'
                      }}
                    >
                      📄 Abrir PDF da Aula
                    </a>
                    {planoUsuario === 'premium' && (
                      <button 
                        onClick={() => {
                          const nova = prompt('Editar link do PDF:', aulaPlaying.pdf_url);
                          if (nova !== null) salvarPdfUrl(nova);
                        }}
                        style={{backgroundColor: 'transparent', border: '1px solid #444', color: '#AAA', padding: '8px', borderRadius: '4px', cursor: 'pointer'}}
                      >
                        Editar Link
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{textAlign: 'center', color: '#666', padding: '20px'}}>
                    <p>Nenhum PDF disponível para esta aula.</p>
                    {planoUsuario === 'premium' && (
                      <button 
                        onClick={() => {
                          const nova = prompt('Insira o link do PDF:');
                          if (nova) salvarPdfUrl(nova);
                        }}
                        style={{marginTop: '15px', padding: '10px 20px', backgroundColor: '#333', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer'}}
                      >
                        + Importar PDF
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'anotacoes' && (
              <div style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <h3 style={{color: '#FFF', fontSize: '14px', margin: 0}}>Suas Anotações</h3>
                  <span style={{fontSize: '10px', color: salvandoAnotacao ? '#FF9800' : '#4CAF50'}}>
                    {salvandoAnotacao ? 'Salvando...' : '✓ Salvo'}
                  </span>
                </div>
                <textarea 
                  style={styles.anotacoesTextArea}
                  value={anotacao}
                  onChange={(e) => setAnotacao(e.target.value)}
                  placeholder="Digite aqui suas observações sobre esta aula..."
                />
                <p style={{fontSize: '11px', color: '#666', margin: 0}}>
                  As anotações são salvas automaticamente enquanto você digita.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        iframe { width: 100% !important; height: 100% !important; position: absolute !important; top: 0 !important; left: 0 !important; }
        .ytp-gradient-top, .ytp-gradient-bottom, .ytp-chrome-top, .ytp-chrome-bottom, .ytp-title, .ytp-watermark, .ytp-youtube-button, .ytp-share-button { display: none !important; pointer-events: none !important; }
        .ytp-pause-overlay { display: none !important; } /* Esconde sugestões ao pausar */
      `}</style>
    </div>
  );
}

const styles = {
  appContainer: {
    minHeight: '100vh',
    backgroundColor: '#0A0A0A',
    fontFamily: 'Segoe UI, Roboto, sans-serif',
    color: '#F5F5F5'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    padding: '16px 32px',
    backgroundColor: '#1A1A1A',
    borderBottom: '1px solid #333',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: '#333',
    border: '1px solid #555',
    color: '#F5F5F5',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: '18px', margin: 0, fontWeight: 'bold', color: '#F5F5F5' },
  headerSubtitulo: { fontSize: '12px', color: '#AAA', marginTop: '4px' },
  mainContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: '0',
    padding: '0',
    width: '100%',
    height: 'calc(100vh - 80px)', // Altura fixa descontando o header
    overflow: 'hidden'
  },
  playerSection: { 
    flex: 3, 
    padding: '32px',
    backgroundColor: '#050505',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflowY: 'auto'
  },
  playerContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: '1000px',
    aspectRatio: '16 / 9',
    backgroundColor: '#000',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
    border: '1px solid #222'
  },
  player: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  blockTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '20%',
    backgroundColor: 'transparent',
    zIndex: 15,
  },
  blockTopFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '15%',
    backgroundColor: 'transparent',
    zIndex: 15,
  },
  blockBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '15%',
    height: '15%',
    backgroundColor: 'transparent',
    zIndex: 15,
  },
  blockFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 14, // Fica entre o vídeo e os controles
    cursor: 'pointer'
  },
  
  // Novos Estilos Premium
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 100%)',
    zIndex: 20, // Fica por cima de tudo
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    transition: 'opacity 0.3s ease',
    cursor: 'default'
  },
  bottomControlsBar: {
    padding: '20px',
    transition: 'opacity 0.3s ease',
  },
  centerPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80px',
    height: '80px',
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 30px rgba(229, 9, 20, 0.4)',
    transition: 'transform 0.2s ease, background-color 0.2s',
  },
  centerPlayIcon: {
    fontSize: '32px',
    color: '#FFF',
    marginLeft: '5px',
  },
  bottomControlsBar: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  modernProgressContainer: {
    position: 'relative',
    width: '100%',
    height: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  modernProgressBase: {
    position: 'absolute',
    width: '100%',
    height: '4px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '2px',
    overflow: 'visible',
  },
  modernProgressFill: {
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: '2px',
  },
  modernProgressHandle: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '14px',
    height: '14px',
    backgroundColor: '#E50914',
    borderRadius: '50%',
    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
    zIndex: 3,
  },
  modernProgressSlider: {
    position: 'absolute',
    width: '100%',
    height: '20px',
    margin: 0,
    opacity: 0,
    zIndex: 5,
    cursor: 'pointer',
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlsGroupLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  controlsGroupRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  modernControlButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#FFF',
    fontSize: '22px',
    cursor: 'pointer',
    padding: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.1s, color 0.2s',
    opacity: 0.9,
  },
  modernVolumeGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    groupHover: {
      width: '100px',
    }
  },
  volumeSliderWrapper: {
    width: '0px',
    overflow: 'hidden',
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    // Simulando hover no container para expandir o volume
    ':hover': {
      width: '80px',
    }
  },
  modernVolumeSlider: {
    width: '70px',
    height: '4px',
    WebkitAppearance: 'none',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: '2px',
    outline: 'none',
    cursor: 'pointer',
  },
  modernTimeDisplay: {
    display: 'flex',
    gap: '5px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#EEE',
  },
  timeCurrent: {},
  timeDivider: { color: '#888' },
  timeTotal: { color: '#AAA' },
  speedSelectorWrapper: {
    position: 'relative',
    padding: '4px 10px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  speedLabel: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#FFF',
  },
  hiddenSpeedSelect: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  
  modulosMenu: {
    backgroundColor: '#1A1A1A',
    maxHeight: '300px',
    overflowY: 'auto',
    borderBottom: '1px solid #333'
  },
  listaSection: { 
    flex: 1, 
    backgroundColor: '#000', 
    borderRadius: '0', 
    overflow: 'hidden', 
    alignSelf: 'stretch', 
    position: 'sticky', 
    top: '80px', 
    borderLeft: '1px solid #222',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 80px)'
  },
  sidebarHeader: {
    padding: '24px 20px 10px 20px',
  },
  sidebarTitle: {
    margin: '0 0 20px 0',
    fontSize: '22px',
    fontWeight: '700',
    color: '#FFF',
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: '1px solid #222',
    marginBottom: '20px',
  },
  tabButton: {
    flex: 1,
    padding: '12px 0',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    position: 'relative',
    transition: 'color 0.3s',
  },
  tabButtonActive: {
    color: '#FFF',
    borderBottom: '2px solid #2196F3',
  },
  subTabsContainer: {
    display: 'flex',
    gap: '30px',
    marginBottom: '10px',
  },
  subTabButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '8px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    position: 'relative',
  },
  subTabActive: {
    color: '#2196F3',
    borderBottom: '2px solid #2196F3',
  },
  subTabIcon: {
    fontSize: '12px',
  },
  infoBox: {
    padding: '16px 20px',
    backgroundColor: 'transparent',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  infoLabel: {
    fontSize: '11px',
    color: '#666',
    fontWeight: '700',
    letterSpacing: '1px',
  },
  verTudo: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#2196F3',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  infoValue: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#FFF',
    lineHeight: '1.4',
  },
  searchContainer: {
    padding: '10px 20px',
    marginBottom: '10px',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px 12px 16px',
    backgroundColor: '#1A1A1A',
    border: '1px solid #333',
    borderRadius: '12px',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none',
  },
  searchIcon: {
    position: 'absolute',
    right: '16px',
    color: '#666',
    fontSize: '16px',
  },
  listaAulas: { 
    flex: 1,
    overflowY: 'auto',
    padding: '0 10px',
  },
  itemAula: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    margin: '4px 0',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid transparent',
  },
  itemAulaSelected: {
    backgroundColor: '#1A1A1A',
    borderColor: '#333',
  },
  itemAulaLeft: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '16px',
    flex: 1,
  },
  checkCircle: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid #444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: 'transparent',
    flexShrink: 0,
  },
  checkCircleActive: {
    backgroundColor: '#00C853',
    borderColor: '#00C853',
    color: '#FFF',
  },
  itemAulaInfo: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '4px',
  },
  itemAulaTitulo: { 
    fontSize: '14px', 
    fontWeight: '500', 
    color: '#AAA',
    lineHeight: '1.4',
  },
  itemAulaTituloSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  itemAulaDuracao: { 
    fontSize: '12px', 
    color: '#666',
  },
  itemAulaRight: { 
    display: 'flex', 
    alignItems: 'center', 
  },
  moreButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#666',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px',
  },
  anotacoesTextArea: {
    width: '100%',
    flex: 1,
    minHeight: '200px',
    backgroundColor: '#0F0F0F',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#DDD',
    padding: '15px',
    fontSize: '14px',
    fontFamily: 'inherit',
    lineHeight: '1.6',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box'
  }
};

export default AulaPage;