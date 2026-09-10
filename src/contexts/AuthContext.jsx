import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [planoUsuario, setPlanoUsuario] = useState('carregando');
  const [userName, setUserName] = useState('Aluno');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [preparatoriosLiberados, setPreparatoriosLiberados] = useState([]);
  const [dataExpiracao, setDataExpiracao] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Semáforo para evitar requisições concorrentes idênticas
  const carregandoPerfilRef = useRef(false);

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
      return;
    }

    if (!profile) {
      console.warn('[AuthContext] Perfil não encontrado, usando basico.');
      setPlanoUsuario('basico');
      setAuthLoading(false);
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
      return;
    }

    if (carregandoPerfilRef.current) return;
    carregandoPerfilRef.current = true;

    try {
      // 1. Tenta buscar pelo ID (padrão Supabase)
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, plano, plano_anterior, avatar_url, display_name, data_expiracao, preparatorios_liberados')
        .eq('id', userObj.id)
        .maybeSingle();

      // Se deu erro de token expirado (401 / JWT), renova a sessão e tenta novamente
      if (error && (String(error.message).toLowerCase().includes('jwt') || String(error.code) === '401' || String(error.code) === 'PGRST301' || error.status === 401)) {
        console.warn('[AuthContext] Token expirado ao buscar perfil. Renovando sessão...');
        const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr && refreshData?.session) {
          const retry = await supabase
            .from('profiles')
            .select('id, email, plano, plano_anterior, avatar_url, display_name, data_expiracao, preparatorios_liberados')
            .eq('id', userObj.id)
            .maybeSingle();
          profile = retry.data;
          error = retry.error;
        }
      }

      // 2. Se não achou por ID, tenta por e-mail (sincronização de contas órfãs ou recriadas)
      if (!profile && userEmail) {
        const { data: profileByEmail, error: emailErr } = await supabase
          .from('profiles')
          .select('id, email, plano, plano_anterior, avatar_url, display_name, data_expiracao, preparatorios_liberados')
          .eq('email', userEmail)
          .maybeSingle();

        if (profileByEmail && !emailErr) {
          profile = profileByEmail;
        }
      }

      if (profile) {
        aplicarPerfil(profile, userObj);
      } else {
        console.warn('[AuthContext] Perfil não encontrado para o usuário, usando básico.');
        setPlanoUsuario('basico');
        setAuthLoading(false);
      }
    } catch (e) {
      console.error('[AuthContext] Erro ao carregar perfil:', e);
      setAuthLoading(false);
    } finally {
      carregandoPerfilRef.current = false;
    }
  }, [aplicarPerfil]);

  useEffect(() => {
    let mounted = true;

    // Segurança: se após 6s ainda estiver carregando, libera forçadamente
    const timeout = setTimeout(() => {
      if (!mounted) return;
      setAuthLoading(prev => {
        if (prev) {
          console.warn('[AuthContext] Timeout de segurança: liberando auth após 6s.');
          setPlanoUsuario(p => p === 'carregando' ? 'basico' : p);
          return false;
        }
        return prev;
      });
    }, 6000);

    const init = async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        // Se houver sessão mas o token expirou (ou está prestes a expirar), renova proativamente
        if (session) {
          const agoraSegundos = Math.floor(Date.now() / 1000);
          if (session.expires_at && session.expires_at <= agoraSegundos + 60) {
            console.log('[AuthContext] Sessão com token vencido detectada no init. Renovando credencial...');
            const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
            if (!refreshErr && refreshData?.session) {
              session = refreshData.session;
            } else if (refreshErr) {
              console.warn('[AuthContext] Erro ao renovar token no init:', refreshErr.message);
              await supabase.auth.signOut();
              session = null;
            }
          }
        }

        if (session?.user) {
          setUser(session.user);
          await carregarPerfil(session.user);
        } else {
          setUser(null);
          setPlanoUsuario('basico');
          setAuthLoading(false);
        }
      } catch (err) {
        console.error('[AuthContext] Erro no init:', err);
        if (mounted) {
          setPlanoUsuario('basico');
          setAuthLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log(`[AuthContext] Evento: ${event}`, session?.user?.email || 'sem usuário');

      if (event === 'SIGNED_IN') {
        if (session?.user) {
          setUser(session.user);
          await carregarPerfil(session.user);
        }
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[AuthContext] Token renovado com sucesso:', session?.user?.email);
        if (session?.user) {
          setUser(session.user);
          // Recarrega o perfil garantindo que dados pós-renovação reflitam o plano correto
          await carregarPerfil(session.user);
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

      // 2. Limpa todas as chaves do Supabase no localStorage
      try {
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
