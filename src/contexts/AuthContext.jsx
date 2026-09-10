import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [planoUsuario, setPlanoUsuario] = useState(() => {
    try {
      const cached = localStorage.getItem('papirando_plano_cache');
      if (cached && cached !== 'carregando') return cached;
    } catch (e) {}
    return 'basico';
  });
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem('papirando_nome_cache') || 'Aluno';
    } catch (e) {
      return 'Aluno';
    }
  });
  const [avatarUrl, setAvatarUrl] = useState(() => {
    try {
      return localStorage.getItem('papirando_avatar_cache') || null;
    } catch (e) {
      return null;
    }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [preparatoriosLiberados, setPreparatoriosLiberados] = useState(() => {
    try {
      const cached = localStorage.getItem('papirando_preps_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [dataExpiracao, setDataExpiracao] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => {
    try {
      const hasSbSession = Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      return !hasSbSession;
    } catch (e) {
      return true;
    }
  });

  // Semáforo para evitar requisições concorrentes idênticas
  const carregandoPerfilRef = useRef(false);

  // Helper com timeout para renovação de token não travar o app em conexões frias
  const refreshSessionComTimeout = useCallback(async () => {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de renovação')), 3500)
      );
      const refreshPromise = supabase.auth.refreshSession();
      return await Promise.race([refreshPromise, timeoutPromise]);
    } catch (err) {
      console.warn('[AuthContext] Falha ou timeout ao renovar token:', err?.message || err);
      return { data: { session: null }, error: err };
    }
  }, []);

  const aplicarPerfil = useCallback((profile, userObj) => {
    if (!userObj) return;

    const userEmail = userObj.email?.toLowerCase() || '';

    // Atalho Admin — sem precisar buscar no banco
    if (userEmail.includes('rodrigoalmeidja')) {
      const nome = userEmail.split('@')[0] || 'Admin';
      setIsAdmin(true);
      setPlanoUsuario('premium');
      setUserName(nome);
      setAuthLoading(false);
      try {
        localStorage.setItem('papirando_plano_cache', 'premium');
        localStorage.setItem('papirando_nome_cache', nome);
      } catch (e) {}
      return;
    }

    if (!profile) {
      console.warn('[AuthContext] Perfil não encontrado, usando basico.');
      setPlanoUsuario('basico');
      setAuthLoading(false);
      try {
        localStorage.setItem('papirando_plano_cache', 'basico');
      } catch (e) {}
      return;
    }

    let planoNormalizado = String(profile.plano || 'basico')
      .toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let dataExp = profile.data_expiracao || null;
    if (dataExp) {
      const expirou = new Date(dataExp) < new Date();
      const gracePeriodMs = 5 * 60 * 1000;
      const dentroDaTolerancia = (new Date() - new Date(dataExp)) < gracePeriodMs;
      if (expirou && !dentroDaTolerancia) {
        const targetId = profile.id || userObj.id;
        
        // REGRA DE SEGURANÇA CRÍTICA:
        // A expiração de data só pode REBAIXAR um plano pago (premium/medio) para basico.
        // NUNCA pode transformar um plano basico em premium!
        if (planoNormalizado !== 'basico') {
          const planoRevertido = (profile.plano_anterior && profile.plano_anterior !== 'premium') 
            ? profile.plano_anterior 
            : 'basico';
          planoNormalizado = planoRevertido;
          dataExp = null;
          supabase.from('profiles')
            .update({ plano: planoRevertido, data_expiracao: null, plano_anterior: null })
            .eq('id', targetId);
        } else {
          // Se o plano já é basico, apenas limpa a data expirada e o histórico para não haver conflitos
          dataExp = null;
          supabase.from('profiles')
            .update({ data_expiracao: null, plano_anterior: null })
            .eq('id', targetId);
        }
      }
    }

    let liberados = profile.preparatorios_liberados || [];
    if (typeof liberados === 'string') {
      try { liberados = JSON.parse(liberados); }
      catch (e) { liberados = liberados.split(',').map(s => s.trim()); }
    }
    if (!Array.isArray(liberados)) liberados = [];

    const nomeFinal = profile.display_name || userEmail.split('@')[0] || 'Aluno';

    setPlanoUsuario(planoNormalizado);
    setUserName(nomeFinal);
    setDataExpiracao(dataExp);
    setPreparatoriosLiberados(liberados);
    setAvatarUrl(profile.avatar_url || null);
    setIsAdmin(false);
    setAuthLoading(false);

    try {
      localStorage.setItem('papirando_plano_cache', planoNormalizado);
      localStorage.setItem('papirando_nome_cache', nomeFinal);
      localStorage.setItem('papirando_preps_cache', JSON.stringify(liberados));
      if (profile.avatar_url) localStorage.setItem('papirando_avatar_cache', profile.avatar_url);
    } catch (e) {}
  }, []);

  const carregarPerfil = useCallback(async (userObj) => {
    if (!userObj) {
      setPlanoUsuario('basico');
      setAuthLoading(false);
      return;
    }

    const userEmail = userObj.email?.toLowerCase() || '';

    // Atalho Admin — sem precisar buscar no banco
    if (userEmail.includes('rodrigoalmeidja')) {
      const nome = userEmail.split('@')[0] || 'Admin';
      setIsAdmin(true);
      setPlanoUsuario('premium');
      setUserName(nome);
      setAuthLoading(false);
      try {
        localStorage.setItem('papirando_plano_cache', 'premium');
        localStorage.setItem('papirando_nome_cache', nome);
      } catch (e) {}
      return;
    }

    if (carregandoPerfilRef.current) return;
    carregandoPerfilRef.current = true;

    try {
      const fetchWithTimeout = (promise, ms = 5000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de consulta')), ms))
        ]);
      };

      let profile = null;
      let error = null;

      // 1. Tenta buscar pelo ID com timeout de 5s
      try {
        const res = await fetchWithTimeout(
          supabase
            .from('profiles')
            .select('id, email, plano, plano_anterior, avatar_url, display_name, data_expiracao, preparatorios_liberados')
            .eq('id', userObj.id)
            .maybeSingle(),
          5000
        );
        profile = res?.data;
        error = res?.error;
      } catch (e) {
        error = e;
      }

      // Se deu erro de token expirado (401 / JWT / PGRST301), renova a sessão e tenta novamente
      if (error && (String(error?.message).toLowerCase().includes('jwt') || String(error?.code) === '401' || String(error?.code) === 'PGRST301' || error?.status === 401)) {
        console.warn('[AuthContext] Token expirado ao buscar perfil. Renovando sessão...');
        try {
          const { data: refreshData, error: refreshErr } = await refreshSessionComTimeout();
          if (!refreshErr && refreshData?.session) {
            const retry = await fetchWithTimeout(
              supabase
                .from('profiles')
                .select('id, email, plano, plano_anterior, avatar_url, display_name, data_expiracao, preparatorios_liberados')
                .eq('id', userObj.id)
                .maybeSingle(),
              5000
            );
            profile = retry?.data;
            error = retry?.error;
          }
        } catch (e) {
          error = e;
        }
      }

      // 2. Se não achou por ID, tenta por e-mail (sincronização de contas com ID diferente)
      if (!profile && userEmail) {
        try {
          const resEmail = await fetchWithTimeout(
            supabase
              .from('profiles')
              .select('id, email, plano, plano_anterior, avatar_url, display_name, data_expiracao, preparatorios_liberados')
              .eq('email', userEmail)
              .maybeSingle(),
            5000
          );
          if (resEmail?.data) {
            profile = resEmail.data;
            error = null;
          }
        } catch (e) {}
      }

      if (profile) {
        aplicarPerfil(profile, userObj);
      } else if (!error) {
        console.warn('[AuthContext] Perfil não encontrado no banco, usando básico.');
        setPlanoUsuario('basico');
        setAuthLoading(false);
        try {
          localStorage.setItem('papirando_plano_cache', 'basico');
        } catch (e) {}
      } else {
        console.warn('[AuthContext] Instabilidade temporária ao consultar perfil. Mantendo cache seguro:', error?.message);
        setPlanoUsuario(prev => (prev && prev !== 'carregando') ? prev : (localStorage.getItem('papirando_plano_cache') || 'basico'));
        setAuthLoading(false);
      }
    } catch (e) {
      console.error('[AuthContext] Erro ao carregar perfil:', e);
      setPlanoUsuario(prev => (prev && prev !== 'carregando') ? prev : (localStorage.getItem('papirando_plano_cache') || 'basico'));
      setAuthLoading(false);
    } finally {
      carregandoPerfilRef.current = false;
    }
  }, [aplicarPerfil, refreshSessionComTimeout]);

  useEffect(() => {
    let mounted = true;

    // Segurança: se após 4s ainda estiver com authLoading, libera forçadamente
    const timeout = setTimeout(() => {
      if (!mounted) return;
      setAuthLoading(false);
      setPlanoUsuario(p => (p === 'carregando' || !p) ? (localStorage.getItem('papirando_plano_cache') || 'basico') : p);
    }, 4000);

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          carregarPerfil(session.user);
        } else {
          // Só limpa os dados se o localStorage NÃO contiver token de autenticação
          const hasSbSession = Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
          if (!hasSbSession) {
            setUser(null);
            setPlanoUsuario('basico');
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Erro no init:', err);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log(`[AuthContext] Evento: ${event}`, session?.user?.email || 'sem usuário');

      // CRÍTICO: INITIAL_SESSION é o evento disparado no F5/recarregamento com sessão ativa
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          setUser(session.user);
          carregarPerfil(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserName('Aluno');
        setIsAdmin(false);
        setPlanoUsuario('basico');
        setPreparatoriosLiberados([]);
        setDataExpiracao(null);
        setAvatarUrl(null);
        setAuthLoading(false);
        try {
          localStorage.removeItem('papirando_plano_cache');
          localStorage.removeItem('papirando_nome_cache');
          localStorage.removeItem('papirando_preps_cache');
        } catch (e) {}
      }
    });

    init();

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [carregarPerfil]);

  // =========================================================================
  // 1. VERIFICAÇÃO EM TODAS AS ALAS (AO NAVEGAR ENTRE ROTAS/PÁGINAS)
  // Sempre que o aluno entra em qualquer ala (/carreira, /preparatorio, /aula, /, etc.),
  // revalida imediatamente o plano com o Supabase em segundo plano.
  // =========================================================================
  useEffect(() => {
    if (user?.id) {
      carregarPerfil(user);
    }
  }, [location.pathname, user, carregarPerfil]);

  // =========================================================================
  // 2. SINCRONIZAÇÃO INSTANTÂNEA EM TEMPO REAL (< 200ms) + HEARTBEAT DE 1.5s
  // =========================================================================
  useEffect(() => {
    if (!user?.id) return;

    // A. Canal Realtime Broadcast ultra-rápido (<200ms)
    const channel = supabase
      .channel('global-user-sync', {
        config: { broadcast: { ack: false } }
      })
      .on(
        'broadcast',
        { event: 'sync-user' },
        (payload) => {
          const data = payload?.payload;
          if (!data) return;

          const isTargetUser = 
            (data.userId && String(data.userId) === String(user.id)) ||
            (data.email && user.email && String(data.email).toLowerCase() === String(user.email).toLowerCase());

          if (isTargetUser) {
            console.log('[AuthContext] ⚡ Alteração instantânea recebida do Admin:', data.novoPlano);
            if (data.novoPlano) {
              setPlanoUsuario(data.novoPlano);
              try {
                localStorage.setItem('papirando_plano_cache', data.novoPlano);
              } catch (e) {}
            }
            carregarPerfil(user);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          const changedId = payload.new?.id || payload.old?.id;
          if (changedId === user.id || payload.new?.email === user.email) {
            console.log('[AuthContext] ⚡ Postgres change detectada para este usuário:', payload);
            if (payload.new) {
              aplicarPerfil(payload.new, user);
            } else {
              carregarPerfil(user);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`[AuthContext] Status Realtime: ${status}`);
      });

    // B. Revalidação ao focar na aba ou retornar ao app
    const handleRevalidate = () => {
      if (document.visibilityState === 'visible') {
        carregarPerfil(user);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    window.addEventListener('visibilitychange', handleRevalidate);

    // C. Heartbeat periódico a cada 1.5s para sincronismo automático permanente
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        carregarPerfil(user);
      }
    }, 1500);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleRevalidate);
      window.removeEventListener('visibilitychange', handleRevalidate);
      clearInterval(interval);
    };
  }, [user, carregarPerfil, aplicarPerfil]);

  const handleLogout = async () => {
    console.log('[AuthContext] Executando logout completo...');
    try {
      // 1. Limpa todas as informações da sessão
      sessionStorage.clear();

      // 2. Limpa todas as chaves do Supabase e do Papirando no localStorage
      try {
        localStorage.removeItem('papirando_plano_cache');
        localStorage.removeItem('papirando_nome_cache');
        localStorage.removeItem('papirando_avatar_cache');
        localStorage.removeItem('papirando_preps_cache');
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase') || key.includes('papirando')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn('[AuthContext] Erro ao limpar localStorage:', e);
      }

      // 3. Reseta estados React imediatamente
      setUser(null);
      setUserName('Aluno');
      setIsAdmin(false);
      setPlanoUsuario('basico');
      setPreparatoriosLiberados([]);
      setDataExpiracao(null);
      setAvatarUrl(null);
      setAuthLoading(false);

      // 4. Dispara signOut no Supabase com limite de 1.5s para não travar a interface
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);
    } catch (err) {
      console.warn('[AuthContext] Aviso durante logout:', err);
    } finally {
      // 5. Força redirecionamento limpo para a tela de login
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    planoUsuario,
    userName,
    avatarUrl,
    isAdmin,
    preparatoriosLiberados,
    dataExpiracao,
    authLoading,
    // Setters expostos para páginas que precisam atualizar dados (ex: Home ao trocar avatar)
    setUserName,
    setAvatarUrl,
    setPlanoUsuario,
    refreshAuth: () => carregarPerfil(user),
    handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
