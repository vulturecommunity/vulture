-- =====================================================================================
-- PAINEL DE USO — os números que decidem quando o projeto começa a custar
--
-- O monitor já media o bucket do R2. Faltavam duas métricas que também têm teto no plano
-- gratuito e que o projeto não enxergava: o tamanho do banco e o número de contas.
--
-- O QUE DÁ PARA MEDIR DAQUI DE DENTRO
--
--   Armazenamento no R2 ....... exato, pela listagem do bucket (10 GB grátis)
--   Operações Classe A ........ estimado pelos objetos criados no mês (1 M grátis)
--   Tamanho do banco .......... exato, pg_database_size (500 MB grátis)
--   Contas .................... exato (50.000 MAU grátis)
--
-- O QUE NÃO DÁ, E POR QUÊ
--
--   Egress da Supabase ........ o tráfego sai pelo gateway, não passa pelo Postgres
--   Invocações de função ...... idem
--   Operações Classe B do R2 .. o download vai do celular direto para o R2
--
-- Esses três só existem no painel de cada provedor. O painel avisa isso na cara, em vez
-- de mostrar um número inventado — métrica errada é pior que métrica ausente, porque dá
-- confiança falsa.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Limites que faltavam. A tabela nasceu só para mídia; agora guarda o plano inteiro.
-- -------------------------------------------------------------------------------------

alter table public.plano_de_midia
  add column if not exists banco_bytes  bigint  not null default 524288000,  -- 500 MB
  add column if not exists contas_limite integer not null default 50000;     -- 50k MAU

comment on table public.plano_de_midia is
  'Limites do plano gratuito usados pelo monitor e pelo painel de uso. '
  'Ajuste com UPDATE quando mudar de plano — nenhuma migration necessária.';

-- -------------------------------------------------------------------------------------
-- Snapshot passa a registrar banco e contas junto
-- -------------------------------------------------------------------------------------

alter table public.uso_do_bucket
  add column if not exists banco_bytes bigint,
  add column if not exists contas      integer;

/**
 * Tudo que o painel precisa, numa chamada só.
 *
 * Banco e contas são medidos AGORA (são baratos de contar); o R2 vem do último snapshot,
 * porque listar o bucket a cada abertura do painel gastaria operação à toa.
 */
create or replace function public.painel_de_uso()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  plano record;
  ultimo record;
  banco bigint;
  qtd_contas integer;
  historico jsonb;
  alertas jsonb;
begin
  select * into plano from public.plano_de_midia where id = 1;
  select * into ultimo from public.uso_do_bucket order by medido_em desc limit 1;

  banco := pg_database_size(current_database());
  select count(*) into qtd_contas from public.profiles;

  select coalesce(jsonb_agg(h order by h.medido_em), '[]'::jsonb) into historico
    from (
      select medido_em, bytes, objetos, banco_bytes
        from public.uso_do_bucket
       order by medido_em desc
       limit 30
    ) h;

  select coalesce(jsonb_agg(a order by a.criado_em desc), '[]'::jsonb) into alertas
    from (
      select nivel, tipo, mensagem, criado_em
        from public.alertas_de_infra
       order by criado_em desc
       limit 10
    ) a;

  return jsonb_build_object(
    'geradoEm', now(),
    'medidoEm', ultimo.medido_em,
    'metricas', jsonb_build_array(
      jsonb_build_object(
        'chave', 'armazenamento',
        'nome', 'Armazenamento no R2',
        'usado', coalesce(ultimo.bytes, 0),
        'limite', plano.armazenamento_bytes,
        'unidade', 'bytes',
        'detalhe', coalesce(ultimo.objetos, 0) || ' arquivos',
        'exato', true
      ),
      jsonb_build_object(
        'chave', 'operacoes',
        'nome', 'Escritas no R2 (mês)',
        'usado', coalesce(ultimo.novos_no_mes, 0),
        'limite', plano.operacoes_a_mes,
        'unidade', 'contagem',
        'detalhe', 'estimado pelos arquivos novos',
        'exato', false
      ),
      jsonb_build_object(
        'chave', 'banco',
        'nome', 'Tamanho do banco',
        'usado', banco,
        'limite', plano.banco_bytes,
        'unidade', 'bytes',
        'detalhe', 'Postgres da Supabase',
        'exato', true
      ),
      jsonb_build_object(
        'chave', 'contas',
        'nome', 'Contas cadastradas',
        'usado', qtd_contas,
        'limite', plano.contas_limite,
        'unidade', 'contagem',
        'detalhe', 'limite do plano é por usuário ativo no mês',
        'exato', true
      )
    ),
    'naoMedido', jsonb_build_array(
      jsonb_build_object('nome', 'Egress da Supabase', 'limite', '5 GB/mês',
        'motivo', 'o tráfego sai pelo gateway, não passa pelo banco',
        'onde', 'painel da Supabase → Reports → Usage'),
      jsonb_build_object('nome', 'Leituras no R2 (Classe B)', 'limite', '10 M/mês',
        'motivo', 'o download vai do celular direto para o R2',
        'onde', 'painel da Cloudflare → R2 → Metrics')
    ),
    'limiares', jsonb_build_object(
      'aviso', plano.aviso_em, 'alerta', plano.alerta_em, 'critico', plano.critico_em
    ),
    'historico', historico,
    'alertas', alertas
  );
end;
$$;

revoke execute on function public.painel_de_uso() from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- Autoteste
-- -------------------------------------------------------------------------------------

do $$
declare
  p jsonb;
  metricas jsonb;
begin
  p := public.painel_de_uso();

  if p->>'geradoEm' is null then
    raise exception 'painel nao devolveu geradoEm';
  end if;

  metricas := p->'metricas';
  if jsonb_array_length(metricas) <> 4 then
    raise exception 'esperava 4 metricas, veio %', jsonb_array_length(metricas);
  end if;

  -- o tamanho do banco tem que ser um numero real, nao zero nem nulo
  if (metricas->2->>'usado')::bigint <= 0 then
    raise exception 'tamanho do banco veio invalido: %', metricas->2->>'usado';
  end if;

  -- limite nunca pode ser zero: o painel divide por ele
  if exists (
    select 1 from jsonb_array_elements(metricas) m where (m->>'limite')::bigint = 0
  ) then
    raise exception 'alguma metrica veio com limite zero (divisao por zero no painel)';
  end if;

  raise notice 'autoteste do painel de uso: OK (4 metricas, banco = % bytes)',
    metricas->2->>'usado';
end $$;
