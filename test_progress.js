require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Pega as keys do .env
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  console.log("1. Efetuando login...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'teste@gmail.com',
    password: '123456'
  });

  if (authError) {
    console.error("Erro no login:", authError);
    return;
  }

  const user = authData.user;
  console.log("Login OK! User ID:", user.id);

  console.log("2. Buscando uma aula para testar...");
  const { data: aulas, error: aulasError } = await supabase.from('aulas').select('id, duracao').limit(1);
  
  if (aulasError || !aulas || aulas.length === 0) {
    console.error("Erro ao buscar aula:", aulasError);
    return;
  }

  const aula = aulas[0];
  console.log("Aula escolhida:", aula.id);

  console.log("3. Inserindo/Atualizando progresso...");
  const { error: upsertError } = await supabase
    .from('progresso')
    .upsert({
      user_id: user.id,
      aula_id: aula.id,
      tempo_assistido: 120, // Simulando 2 minutos
      concluida: true,
      ultimo_acesso: new Date()
    }, {
      onConflict: 'user_id,aula_id'
    });

  if (upsertError) {
    console.error("ERRO AO SALVAR PROGRESSO:", upsertError);
    return;
  } else {
    console.log("Progresso salvo com sucesso na tabela!");
  }

  console.log("4. Verificando dados reais salvos no banco...");
  const { data: progress, error: progError } = await supabase.from('progresso').select('*').eq('user_id', user.id);
  console.log("Registros de progresso deste usuário:");
  console.log(progress);
}

runTest();
