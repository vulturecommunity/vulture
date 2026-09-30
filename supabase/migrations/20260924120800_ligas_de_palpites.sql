-- =====================================================================================
-- LIGAS — a disputa que o torcedor realmente joga
--
-- Um Top 20 nacional premia 20 pessoas entre um milhão: 99,998% nunca vão se ver na lista,
-- e ranking inalcançável desengaja em vez de engajar. A liga privada resolve isso — no
-- grupo do trabalho, da família, da firma, alguém SEMPRE está em primeiro.
--
-- É também o motor de aquisição mais barato que existe neste formato: cada liga criada
-- vira um código circulando no WhatsApp, e cada convite é alguém baixando o app para não
-- ficar de fora da zoeira.
--
-- Custo técnico: zero cálculo novo. A liga só filtra o ranking que a apuração já produziu,
-- sobre no máximo 50 linhas.
-- =====================================================================================

create table if not exists public.ligas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(btrim(nome)) between 3 and 40),
  codigo      text not null unique check (codigo ~ '^[A-Z0-9]{6}$'),
  dono_id     uuid not null references public.profiles (id) on delete cascade,
  max_membros smallint not null default 50 check (max_membros between 2 and 200),
  criado_em   timestamptz not null default now()
);

create table if not exists public.liga_membros (
  liga_id    uuid not null references public.ligas (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  entrou_em  timestamptz not null default now(),
  primary key (liga_id, usuario_id)
);

create index if not exists liga_membros_usuario_idx on public.liga_membros (usuario_id);
create index if not exists ligas_dono_idx on public.ligas (dono_id);

-- -------------------------------------------------------------------------------------
-- CRIAR, ENTRAR, SAIR
-- -------------------------------------------------------------------------------------

/** Código de 6 caracteres sem as letras que confundem na hora de ditar (O/0, I/1). */
create or replace function public.gerar_codigo_de_liga()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tentativa integer := 0;
  codigo text;
begin
  loop
    codigo := '';
    for i in 1..6 loop
      codigo := codigo || substr(alfabeto, floor(random() * length(alfabeto) + 1)::integer, 1);
    end loop;
    exit when not exists (select 1 from public.ligas where ligas.codigo = codigo);
    tentativa := tentativa + 1;
    if tentativa > 50 then
      raise exception 'Não consegui gerar um código de liga. Tente de novo.';
    end if;
  end loop;
  return codigo;
end;
$$;

create or replace function public.criar_liga(p_nome text)
returns table (id uuid, nome text, codigo text, membros bigint, sou_dono boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  eu uuid := auth.uid();
  nova uuid;
  limpo text := btrim(coalesce(p_nome, ''));
begin
  if eu is null then
    raise exception 'Você precisa entrar para criar uma liga.' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where profiles.id = eu and anonimo) then
    raise exception 'Visitante não pode criar liga. Crie uma conta para disputar.'
      using errcode = '42501';
  end if;
  if char_length(limpo) < 3 or char_length(limpo) > 40 then
    raise exception 'O nome da liga precisa ter de 3 a 40 caracteres.' using errcode = '22023';
  end if;
  if (select count(*) from public.ligas where dono_id = eu) >= 10 then
    raise exception 'Você já criou 10 ligas.' using errcode = '22023';
  end if;

  insert into public.ligas (nome, codigo, dono_id)
  values (limpo, public.gerar_codigo_de_liga(), eu)
  returning ligas.id into nova;

  insert into public.liga_membros (liga_id, usuario_id) values (nova, eu);

  return query
    select l.id, l.nome, l.codigo, 1::bigint, true from public.ligas l where l.id = nova;
end;
$$;

create or replace function public.entrar_na_liga(p_codigo text)
returns table (id uuid, nome text, codigo text, membros bigint, sou_dono boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  eu uuid := auth.uid();
  liga record;
  quantos integer;
begin
  if eu is null then
    raise exception 'Você precisa entrar para participar de uma liga.' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where profiles.id = eu and anonimo) then
    raise exception 'Visitante não pode entrar em liga. Crie uma conta para disputar.'
      using errcode = '42501';
  end if;

  select l.id, l.nome, l.codigo, l.dono_id, l.max_membros into liga
    from public.ligas l where l.codigo = upper(btrim(coalesce(p_codigo, '')));
  if not found then
    raise exception 'Não existe liga com esse código.' using errcode = 'P0002';
  end if;

  select count(*) into quantos from public.liga_membros where liga_id = liga.id;
  if quantos >= liga.max_membros
     and not exists (select 1 from public.liga_membros
                      where liga_id = liga.id and usuario_id = eu) then
    raise exception 'Essa liga já está cheia (% membros).', liga.max_membros
      using errcode = '22023';
  end if;
  if (select count(*) from public.liga_membros where usuario_id = eu) >= 20 then
    raise exception 'Você já está em 20 ligas.' using errcode = '22023';
  end if;

  insert into public.liga_membros (liga_id, usuario_id) values (liga.id, eu)
  on conflict (liga_id, usuario_id) do nothing;

  return query
    select liga.id, liga.nome, liga.codigo,
           (select count(*) from public.liga_membros m where m.liga_id = liga.id),
           liga.dono_id = eu;
end;
$$;

/** Sair da liga. O dono saindo entrega a liga para o membro mais antigo; sem ninguém, some. */
create or replace function public.sair_da_liga(p_liga_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  eu uuid := auth.uid();
  herdeiro uuid;
begin
  if eu is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  delete from public.liga_membros where liga_id = p_liga_id and usuario_id = eu;

  if exists (select 1 from public.ligas where id = p_liga_id and dono_id = eu) then
    select usuario_id into herdeiro from public.liga_membros
     where liga_id = p_liga_id order by entrou_em limit 1;
    if herdeiro is null then
      delete from public.ligas where id = p_liga_id;
    else
      update public.ligas set dono_id = herdeiro where id = p_liga_id;
    end if;
  end if;
end;
$$;

-- -------------------------------------------------------------------------------------
-- LEITURA
-- -------------------------------------------------------------------------------------

create or replace function public.minhas_ligas(p_periodo text default null)
returns table (
  id uuid, nome text, codigo text, membros bigint, sou_dono boolean,
  minha_posicao integer, meus_pontos integer
)
language sql stable security definer set search_path = public as $$
  with per as (
    select coalesce(p_periodo, public.periodo_mensal(now())) as periodo
  )
  select l.id, l.nome, l.codigo,
         (select count(*) from public.liga_membros m2 where m2.liga_id = l.id),
         l.dono_id = auth.uid(),
         (select count(*)::integer + 1
            from public.liga_membros m3
            join public.ranking_palpiteiros r3
              on r3.usuario_id = m3.usuario_id and r3.periodo = (select periodo from per)
           where m3.liga_id = l.id
             and (r3.pontos, -r3.cravadas, r3.desvio) >
                 (coalesce(meu.pontos, 0), -coalesce(meu.cravadas, 0), coalesce(meu.desvio, 0))),
         coalesce(meu.pontos, 0)
    from public.liga_membros m
    join public.ligas l on l.id = m.liga_id
    left join public.ranking_palpiteiros meu
      on meu.usuario_id = auth.uid() and meu.periodo = (select periodo from per)
   where m.usuario_id = auth.uid()
   order by l.criado_em;
$$;

/** Ranking dentro da liga: mesmo critério do nacional, sobre no máximo 50 pessoas. */
create or replace function public.ranking_da_liga(p_liga_id uuid, p_periodo text default null)
returns table (
  posicao bigint, usuario_id uuid, apelido text, nome text, avatar_url text,
  pontos integer, palpites integer, cravadas integer, sequencia integer, sou_eu boolean
)
language sql stable security definer set search_path = public as $$
  select row_number() over (
           order by coalesce(r.pontos, 0) desc, coalesce(r.cravadas, 0) desc,
                    coalesce(r.desvio, 2147483647) asc, p.apelido
         ),
         p.id, p.apelido, p.nome, p.avatar_url,
         coalesce(r.pontos, 0), coalesce(r.palpites, 0), coalesce(r.cravadas, 0),
         coalesce(r.sequencia, 0),
         p.id = auth.uid()
    from public.liga_membros m
    join public.profiles p on p.id = m.usuario_id
    left join public.ranking_palpiteiros r
      on r.usuario_id = m.usuario_id
     and r.periodo = coalesce(p_periodo, public.periodo_mensal(now()))
   where m.liga_id = p_liga_id
     and exists (
       select 1 from public.liga_membros eu
        where eu.liga_id = p_liga_id and eu.usuario_id = auth.uid()
     )
   order by 1
   limit 200;
$$;

-- -------------------------------------------------------------------------------------
-- RLS — tudo passa pelas RPCs; leitura direta só para quem é membro
-- -------------------------------------------------------------------------------------

alter table public.ligas        enable row level security;
alter table public.liga_membros enable row level security;

drop policy if exists "ligas leitura de membro" on public.ligas;
create policy "ligas leitura de membro" on public.ligas for select using (
  exists (select 1 from public.liga_membros m
           where m.liga_id = ligas.id and m.usuario_id = auth.uid())
);

drop policy if exists "liga_membros leitura de membro" on public.liga_membros;
create policy "liga_membros leitura de membro" on public.liga_membros for select using (
  exists (select 1 from public.liga_membros meu
           where meu.liga_id = liga_membros.liga_id and meu.usuario_id = auth.uid())
);

revoke insert, update, delete on public.ligas from anon, authenticated;
revoke insert, update, delete on public.liga_membros from anon, authenticated;

revoke execute on function public.gerar_codigo_de_liga() from public, anon, authenticated;
grant execute on function public.criar_liga(text) to authenticated;
grant execute on function public.entrar_na_liga(text) to authenticated;
grant execute on function public.sair_da_liga(uuid) to authenticated;
grant execute on function public.minhas_ligas(text) to authenticated;
grant execute on function public.ranking_da_liga(uuid, text) to authenticated;
