-- Tabela para notificações de documentos novos (aparece no sino da Home)
-- Execute este script no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS notificacoes_documentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'Outros',
  fonte text NOT NULL DEFAULT 'Avulso',
  emoji text DEFAULT '📄',
  mensagem text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE notificacoes_documentos ENABLE ROW LEVEL SECURITY;

-- Política: qualquer usuário autenticado pode LER as notificações
CREATE POLICY "Notificações visíveis para usuários autenticados"
  ON notificacoes_documentos
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política: somente service_role ou admin pode INSERIR/DELETAR
-- (O insert é feito via supabase client com a chave anon, então liberamos para autenticados também)
CREATE POLICY "Admin pode inserir notificações"
  ON notificacoes_documentos
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin pode deletar notificações"
  ON notificacoes_documentos
  FOR DELETE
  USING (auth.role() = 'authenticated');
