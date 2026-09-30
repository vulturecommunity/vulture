-- =====================================================================================
-- MONITOR DE USO DO R2 — avisar ANTES de virar fatura
--
-- O projeto já foi bloqueado uma vez por estourar cota sem aviso nenhum: 27 GB servidos a
-- partir de 65 MB de arquivos, descobertos só quando o app parou de funcionar. O plano
-- gratuito do R2 tem limites diferentes dos da Supabase, mas a lição é a mesma — o que
-- não é medido vira surpresa.
--
-- COMO A MEDIÇÃO É FEITA
--
-- A Edge Function `monitorar-midia` lista o bucket inteiro pela API S3 (as mesmas
-- credenciais que já usamos para assinar upload — nenhum token novo) e grava um snapshot
-- aqui. Daí sai o número real de bytes e de objetos, sem depender de contabilidade
-- própria, que erra sempre que um upload falha no meio.
--
-- O QUE DÁ E O QUE NÃO DÁ PARA MEDIR ASSIM
--
--   Armazenamento (10 GB grátis) ...... medido com precisão pela listagem
--   Operações Classe A (1 M grátis) ... estimado pelos objetos criados no mês
--   Operações Classe B (10 M grátis) .. NÃO medível daqui (o download vai do celular
--                                        direto para o R2, sem passar por nós)
--
-- Para um app de vídeo isso é aceitável, porque o limite que aperta é o armazenamento:
-- arquivos são grandes, então 10 M de leituras/mês é muito mais folgado que 10 GB. Se um
-- dia as leituras importarem, o número exato exige a API de Analytics da Cloudflare, que
-- precisa de um token com permissão de leitura de analytics (ver ESCALA.md).
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- LIMITES DO PLANO — em tabela, para ajustar sem migration quando o plano mudar
-- -------------------------------------------------------------------------------------

create table if not exists public.plano_de_midia (
  id                  smallint primary key default 1 check (id = 1),
  armazenamento_bytes bigint  not null default 10737418240,  -- 10 GB do plano gratuito
  operacoes_a_mes     integer not null default 1000000,      -- escritas/mês
  -- frações em que cada nível dispara
  aviso_em            numeric not null default 0.70 check (aviso_em   between 0 and 1),
  alerta_em           numeric not null default 0.85 check (alerta_em  between 0 and 1),
  critico_em          numeric not null default 0.95 check (critico_em between 0 and 1),
  atualizado_em       timestamptz not null default now()
);

insert into public.plano_de_midia (id) values (1) on conflict (id) do nothing;

-- -------------------------------------------------------------------------------------
-- SNAPSHOTS DO BUCKET
-- -------------------------------------------------------------------------------------

create table if not exists public.uso_do_bucket (
  id        bigserial primary key,
  medido_em timestamptz not null default now(),
  objetos   integer not null default 0,
  bytes     bigint  not null default 0,
  -- {"videos": {"objetos": 5, "bytes": 67108864}, "thumbnails": {...}}
  por_pasta jsonb   not null default '{}'::jsonb,
  -- objetos criados no mês corrente, para estimar operações Classe A
  novos_no_mes integer not null default 0
);

create index if not exists uso_do_bucket_medido_idx on public.uso_do_bucket (medido_em desc);

-- -------------------------------------------------------------------------------------
-- QUEM RECEBE OS AVISOS
-- -------------------------------------------------------------------------------------

create table if not exists public.administradores (
  usuario_id uuid primary key references public.profiles (id) on delete cascade,
  criado_em  timestamptz not null default now()
);

comment on table public.administradores is
  'Quem recebe alerta de infraestrutura por push. Cadastre com: '
  'insert into public.administradores (usuario_id) select id from public.profiles where apelido = ''seu_apelido'';';

-- -------------------------------------------------------------------------------------
-- ALERTAS
-- -------------------------------------------------------------------------------------

create table if not exists public.alertas_de_infra (
  id        bigserial primary key,
  tipo      text not null,
  nivel     text not null check (nivel in ('aviso', 'alerta', 'critico')),
  -- "2026-09": o mesmo nível não repete dentro do mesmo mês, para não virar spam
  periodo   text not null,
  usado     numeric not null,
  limite    numeric not null,
  fracao    numeric not null,
  mensagem  text not null,
  criado_em timestamptz not null default now(),
  unique (tipo, nivel, periodo)
);

create index if not exists alertas_de_infra_recentes_idx on public.alertas_de_infra (criado_em desc);

alter table public.plano_de_midia   enable row level security;
alter table public.uso_do_bucket    enable row level security;
alter table public.administradores  enable row level security;
alter table public.alertas_de_infra enable row level security;
revoke all on public.plano_de_midia   from anon, authenticated;
revoke all on public.uso_do_bucket    from anon, authenticated;
revoke all on public.administradores  from anon, authenticated;
revoke all on public.alertas_de_infra from anon, authenticated;

-- -------------------------------------------------------------------------------------
-- LEITURA
-- -------------------------------------------------------------------------------------

/** Situação atual do bucket contra o plano. Base do alerta e do painel. */
create or replace function public.uso_do_r2()
returns table (
  medido_em          timestamptz,
  objetos            integer,
  bytes              bigint,
  bytes_limite       bigint,
  bytes_fracao       numeric,
  novos_no_mes       integer,
  operacoes_a_limite integer,
  operacoes_a_fracao numeric,
  por_pasta          jsonb
)
language sql
stable
security definer set search_path = public
as $$
  select s.medido_em,
         s.objetos,
         s.bytes,
         p.armazenamento_bytes,
         round(s.bytes::numeric / nullif(p.armazenamento_bytes, 0), 4),
         s.novos_no_mes,
         p.operacoes_a_mes,
         round(s.novos_no_mes::numeric / nullif(p.operacoes_a_mes, 0), 4),
         s.por_pasta
    from public.uso_do_bucket s
   cross join public.plano_de_midia p
   where p.id = 1
   order by s.medido_em desc
   limit 1;
$$;

revoke execute on function public.uso_do_r2() from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- VERIFICAÇÃO E ALERTA
-- -------------------------------------------------------------------------------------

create or replace function public.nivel_de_uso(p_fracao numeric)
returns text
language sql
stable
security definer set search_path = public
as $$
  select case
    when p_fracao >= (select critico_em from public.plano_de_midia where id = 1) then 'critico'
    when p_fracao >= (select alerta_em  from public.plano_de_midia where id = 1) then 'alerta'
    when p_fracao >= (select aviso_em   from public.plano_de_midia where id = 1) then 'aviso'
    else null
  end;
$$;

/**
 * Compara o último snapshot com o plano e registra alerta quando cruza um limiar.
 *
 * Deduplicado por (tipo, nível, mês): atravessar 70% dispara uma vez, e só volta a avisar
 * se subir para 85%. Alerta que repete todo dia é alerta que ninguém lê.
 */
create or replace function public.verificar_uso_de_midia()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  u record;
  mes text := public.periodo_mensal(now());
  novos integer := 0;
  -- "grau" e nao "nivel": o nome nivel colidiria com a coluna homonima na lista de
  -- colunas do INSERT em alertas_de_infra, que o plpgsql nao consegue desambiguar
  grau text;
  msg text;
  destinatarios uuid[];
begin
  select * into u from public.uso_do_r2();
  if not found then
    return 0;                                   -- nenhum snapshot ainda
  end if;

  -- armazenamento
  grau := public.nivel_de_uso(u.bytes_fracao);
  if grau is not null then
    msg := format(
      'Armazenamento do R2 em %s%% do plano gratuito (%s de %s). Em %s objetos.',
      round(u.bytes_fracao * 100),
      pg_size_pretty(u.bytes),
      pg_size_pretty(u.bytes_limite),
      u.objetos
    );
    insert into public.alertas_de_infra (tipo, nivel, periodo, usado, limite, fracao, mensagem)
    values ('armazenamento', grau, mes, u.bytes, u.bytes_limite, u.bytes_fracao, msg)
    on conflict (tipo, nivel, periodo) do nothing;
    if found then novos := novos + 1; end if;
  end if;

  -- operações Classe A (estimativa pelos objetos novos no mês)
  grau := public.nivel_de_uso(u.operacoes_a_fracao);
  if grau is not null then
    msg := format(
      'Operações de escrita no R2 em %s%% do plano gratuito (%s de %s neste mês).',
      round(u.operacoes_a_fracao * 100), u.novos_no_mes, u.operacoes_a_limite
    );
    insert into public.alertas_de_infra (tipo, nivel, periodo, usado, limite, fracao, mensagem)
    values ('operacoes_a', grau, mes, u.novos_no_mes, u.operacoes_a_limite,
            u.operacoes_a_fracao, msg)
    on conflict (tipo, nivel, periodo) do nothing;
    if found then novos := novos + 1; end if;
  end if;

  -- avisa quem administra, pela fila de push que já existe
  if novos > 0 then
    select array_agg(usuario_id) into destinatarios from public.administradores;
    if destinatarios is not null then
      perform public.enfileirar_push(
        destinatarios,
        '⚠️ Uso do R2 subindo',
        (select mensagem from public.alertas_de_infra
          order by criado_em desc limit 1),
        jsonb_build_object('tipo', 'infra'),
        'default',
        86400
      );
    end if;
  end if;

  return novos;
end;
$$;

revoke execute on function public.nivel_de_uso(numeric) from public, anon, authenticated;
revoke execute on function public.verificar_uso_de_midia() from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- AGENDAMENTO: mede o bucket e verifica, uma vez por dia
-- -------------------------------------------------------------------------------------

select public.agendar(
  'monitorar-midia',
  '20 4 * * *',
  $$
  select net.http_post(
    url := 'https://mlajeudfsjymgaxjofya.supabase.co/functions/v1/monitorar-midia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sYWpldWRmc2p5bWdheGpvZnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzIzNDAsImV4cCI6MjEwNjM0ODM0MH0.5pyZz-AlrKzIH8SvnWJjK9NYg8ueauBj9uBIlYSZGto'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- roda logo depois da medição, para o alerta sair no mesmo ciclo
select public.agendar('verificar-uso-de-midia', '35 4 * * *',
                      'select public.verificar_uso_de_midia();');

-- -------------------------------------------------------------------------------------
-- Autoteste: simula um bucket quase cheio e confere que o alerta sai no nível certo.
-- -------------------------------------------------------------------------------------

do $$
declare
  grau text;
  gerados integer;
begin
  begin
    -- 9,2 GB de 10 GB = 92% -> deve cair em "alerta" (85%), nao em "critico" (95%)
    insert into public.uso_do_bucket (objetos, bytes, novos_no_mes)
    values (120, 9878424780, 40);

    select public.nivel_de_uso(0.92) into grau;
    if grau is distinct from 'alerta' then
      raise exception '92%% deveria ser "alerta", veio "%"', grau;
    end if;
    if public.nivel_de_uso(0.50) is not null then
      raise exception '50%% nao deveria gerar alerta nenhum';
    end if;
    if public.nivel_de_uso(0.99) is distinct from 'critico' then
      raise exception '99%% deveria ser "critico"';
    end if;

    select public.verificar_uso_de_midia() into gerados;
    if gerados < 1 then
      raise exception 'bucket a 92%% deveria ter gerado alerta, gerou %', gerados;
    end if;

    -- rodar de novo no mesmo mês não pode duplicar o aviso
    if public.verificar_uso_de_midia() <> 0 then
      raise exception 'alerta duplicou na segunda verificacao do mesmo mes';
    end if;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste do monitor de midia: OK (dados de teste desfeitos)';
  end;
end $$;
