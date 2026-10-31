#!/usr/bin/env node
/*
 * Aplica schema + migrations num Postgres descartável e roda os autotestes embutidos.
 * Uso:  node scripts/testar-migrations.js            (tudo)
 *       node scripts/testar-migrations.js 2026100    (só as que casarem com o prefixo)
 *
 * POR QUE EXISTE, SE JÁ HÁ O .sh
 *
 * `testar-migrations.sh` faz a mesma coisa, mas precisa de Docker ou Podman. Numa máquina
 * Windows sem nenhum dos dois — que é onde este projeto é desenvolvido — ele não roda, e
 * o resultado prático era migration indo para produção sem nunca ter sido executada.
 *
 * Aqui o Postgres vem do pacote `embedded-postgres`, que baixa o binário oficial e sobe um
 * cluster num diretório temporário. Mesmo roteiro, mesmas checagens, sem container.
 *
 * As duas dependências são opcionais de propósito: pesam ~100 MB e só servem para isto.
 *   npm i -D embedded-postgres pg
 *
 * O QUE ELE NÃO COBRE
 *
 * pg_cron e o schema `auth` completo não existem aqui; as migrations que dependem deles
 * aparecem como "puladas". A versão do Postgres também pode ser mais nova que a do
 * Supabase. Serve para o que dá para verificar sozinho: sintaxe, ordem, idempotência,
 * política não-idempotente, FK quebrada e os autotestes.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const FILTRO = process.argv[2] || '';
const PORTA = Number(process.env.PGPORT_TESTE || 54329);

let EmbeddedPostgres;
let Client;
try {
  EmbeddedPostgres = require('embedded-postgres').default || require('embedded-postgres');
  ({ Client } = require('pg'));
} catch {
  console.error(
    'Faltam as dependências deste script (são opcionais, ~100 MB):\n\n' +
      '  npm i -D embedded-postgres pg\n\n' +
      'Com Docker ou Podman instalado, ./scripts/testar-migrations.sh faz o mesmo sem elas.',
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------- ambiente

/**
 * O mínimo do Supabase que o schema do projeto encosta.
 *
 * `auth.uid()` é fiel ao original: o `nullif` vem ANTES do cast para json. Com o cast
 * primeiro, um JWT ausente ou vazio estoura "invalid input syntax for type json" aqui e
 * funciona lá — falso negativo que reprova migration boa.
 */
const STUBS = `
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $stub$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if;
end $stub$;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid language sql stable as $stub$
  select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid;
$stub$;
create or replace function auth.role() returns text language sql stable as $stub$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
                  'authenticated');
$stub$;

create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now(), metadata jsonb
);
create or replace function storage.foldername(name text) returns text[] language sql immutable as $stub$
  select string_to_array(regexp_replace(name, '/[^/]*$', ''), '/');
$stub$;
create or replace function storage.filename(name text) returns text language sql immutable as $stub$
  select regexp_replace(name, '^.*/', '');
$stub$;

do $stub$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $stub$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

create or replace function public.agendar(p_nome text, p_cron text, p_sql text)
returns void language plpgsql as $stub$
begin
  raise notice 'agendar(%) ignorado: sem pg_cron neste ambiente', p_nome;
end;
$stub$;
`;

const ZICO = '11111111-1111-1111-1111-111111111111';
const PEDRO = '22222222-2222-2222-2222-222222222222';

/**
 * 5 perfis e um jogo. O número não é arbitrário: o autoteste do ranking exige 5 e, com
 * menos, ele se pula — e autoteste que se pula passa sem verificar nada.
 */
const SEED = `
insert into auth.users (id, email) values
  ('${ZICO}','zico@teste.local'),
  ('${PEDRO}','pedro@teste.local'),
  ('33333333-3333-3333-3333-333333333333','arrasca@teste.local'),
  ('44444444-4444-4444-4444-444444444444','gabigol@teste.local'),
  ('55555555-5555-5555-5555-555555555555','everton@teste.local')
on conflict do nothing;
insert into public.profiles (id, apelido, nome, criado_em) values
  ('${ZICO}','zico','Zico', now() - interval '3 day'),
  ('${PEDRO}','pedro','Pedro', now() - interval '2 day'),
  ('33333333-3333-3333-3333-333333333333','arrasca','Arrasca', now() - interval '1 day'),
  ('44444444-4444-4444-4444-444444444444','gabigol','Gabigol', now() - interval '12 hour'),
  ('55555555-5555-5555-5555-555555555555','everton','Everton', now() - interval '6 hour')
on conflict (id) do nothing;

insert into public.partidas
  (id, temporada, competicao, mandante, visitante, sigla_mandante, sigla_visitante,
   data_hora, status)
values
  ('teste-1', 2026, 'Brasileirão', 'Flamengo', 'Santos', 'FLA', 'SAN',
   now() + interval '7 day', 'agendada')
on conflict (id) do nothing;
`;

/** Erros que são ausência do ambiente Supabase, não defeito do SQL do projeto. */
const IGNORAVEIS = /pg_cron|cron\.|extension .* is not available|net\.http|schema "net"|function net\./i;

// ---------------------------------------------------------------------------- utilidades

let falhasDeComportamento = 0;

function checar(nome, condicao, extra = '') {
  if (condicao) {
    console.log(`  ✓ ${nome}`);
  } else {
    console.log(`  ✗ ${nome} ${extra}`);
    falhasDeComportamento++;
  }
}

async function conectar() {
  const cliente = new Client({
    host: '127.0.0.1',
    port: PORTA,
    user: 'postgres',
    password: 'teste',
    database: 'vulture',
  });
  const avisos = [];
  cliente.on('notice', (n) => avisos.push(n.message || ''));
  await cliente.connect();
  return { cliente, avisos };
}

/**
 * Cada arquivo roda numa conexão própria.
 *
 * O driver manda o arquivo inteiro como uma única consulta simples, que o Postgres
 * executa numa transação implícita — mesmo efeito do `psql -v ON_ERROR_STOP=1`: ou o
 * arquivo aplica inteiro, ou não aplica nada.
 */
async function rodar(sql) {
  const { cliente, avisos } = await conectar();
  try {
    await cliente.query(sql);
    return { ok: true, avisos };
  } catch (e) {
    return { ok: false, erro: e.message, detalhe: e.detail, avisos };
  } finally {
    await cliente.end();
  }
}

async function comoUsuario(cliente, id, fn) {
  await cliente.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: id, role: 'authenticated' }),
  ]);
  return fn();
}

// ---------------------------------------------------- fase 2: comportamento, não sintaxe

/**
 * Os autotestes dentro das migrations rodam como dono do banco e sem JWT. Estas checagens
 * exercitam o caminho do APP — com `request.jwt.claims` preenchido — que é justamente onde
 * mora a diferença entre "a migration aplicou" e "a regra funciona".
 */
async function verificarComportamento() {
  const { cliente } = await conectar();
  try {
    console.log('\n→ limite de frequência');
    await cliente.query('begin');
    const { rows: v } = await cliente.query(
      `insert into public.videos (autor_id, url, legenda)
       values ($1,'https://teste.local/v.mp4','teste') returning id`,
      [ZICO],
    );
    const video = v[0].id;

    await comoUsuario(cliente, ZICO, async () => {
      for (let i = 1; i <= 10; i++) {
        await cliente.query(
          `insert into public.comments (video_id, autor_id, texto) values ($1,$2,$3)`,
          [video, ZICO, `comentario ${i}`],
        );
      }
    });
    checar('10 comentários no mesmo minuto passam', true);

    let barrou = null;
    try {
      await comoUsuario(cliente, ZICO, () =>
        cliente.query(
          `insert into public.comments (video_id, autor_id, texto) values ($1,$2,'o 11o')`,
          [video, ZICO],
        ),
      );
    } catch (e) {
      barrou = e;
    }
    checar('o 11º é barrado', !!barrou);
    checar('o erro usa o SQLSTATE P0429 que o app mapeia', barrou?.code === 'P0429');
    checar('a mensagem é legível na tela', /rápido demais/i.test(barrou?.message || ''));

    let pedroPassou = true;
    try {
      await comoUsuario(cliente, PEDRO, () =>
        cliente.query(
          `insert into public.comments (video_id, autor_id, texto) values ($1,$2,'pedro')`,
          [video, PEDRO],
        ),
      );
    } catch {
      pedroPassou = false;
    }
    checar('o teto de um autor não vaza para outro', pedroPassou);

    let semJwtOk = true;
    try {
      await cliente.query(`select set_config('request.jwt.claims', '{}', true)`);
      for (let i = 1; i <= 15; i++) {
        await cliente.query(
          `insert into public.comments (video_id, autor_id, texto) values ($1,$2,$3)`,
          [video, ZICO, `service ${i}`],
        );
      }
    } catch {
      semJwtOk = false;
    }
    checar('sem JWT (service role, cron, seed) não há limite', semJwtOk);
    await cliente.query('rollback');

    console.log('\n→ ranking do feed');
    const { rows: grant } = await cliente.query(
      `select has_function_privilege('authenticated',
         'public.feed_ids(text,text,integer,text,text)', 'execute') as pode`,
    );
    // o `drop function` da versão antiga leva o grant junto; sem recriá-lo o feed morre
    checar('`authenticated` continua podendo executar feed_ids', grant[0].pode);

    await cliente.query('begin');
    await cliente.query('delete from public.videos');
    await cliente.query(
      `insert into public.videos (autor_id, url, legenda, likes_count, criado_em) values
         ($1,'https://teste.local/a.mp4','campeao', 800, now() - interval '3 hour'),
         ($1,'https://teste.local/b.mp4','medio',    40, now() - interval '3 hour'),
         ($2,'https://teste.local/c.mp4','velho',   800, now() - interval '12 day')`,
      [ZICO, PEDRO],
    );
    await cliente.query('select public.recalcular_feed_scores()');

    const ordem = (quem) =>
      comoUsuario(cliente, quem, async () => {
        const { rows } = await cliente.query(
          `select f.id, v.legenda, f.cursor from public.feed_ids('para-voce', null, 10) f
             join public.videos v on v.id = f.id`,
        );
        return rows;
      });

    const r1 = await ordem(PEDRO);
    const nomes = (r) => r.map((x) => x.legenda).join(' > ');
    checar('engajamento maior vem primeiro', r1[0]?.legenda === 'campeao', `(${nomes(r1)})`);
    checar('o acervo velho cai para o fim sem sumir', r1.length === 3 && r1[2]?.legenda === 'velho');
    checar('o cursor carrega o score, não só a data', /\|/.test(r1[0]?.cursor || ''));

    const vistos = [];
    let cursor = null;
    await comoUsuario(cliente, PEDRO, async () => {
      for (let i = 0; i < 3; i++) {
        const { rows } = await cliente.query(
          `select f.id, f.cursor from public.feed_ids('para-voce', $1, 1) f`,
          [cursor],
        );
        if (rows.length === 0) break;
        vistos.push(rows[0].id);
        cursor = rows[0].cursor;
      }
    });
    checar('3 páginas de 1 devolvem 3 vídeos distintos', new Set(vistos).size === 3);
    checar(
      'paginado dá a mesma ordem que de uma vez só',
      JSON.stringify(vistos) === JSON.stringify(r1.map((x) => x.id)),
    );

    await cliente.query(
      `insert into public.videos (autor_id, url, legenda, likes_count, criado_em)
       values ($1,'https://teste.local/meu.mp4','meu-recem-publicado', 0, now())`,
      [PEDRO],
    );
    await cliente.query('select public.recalcular_feed_scores()');
    const r2 = await ordem(PEDRO);
    checar(
      'o vídeo que eu acabei de publicar vem primeiro no MEU feed',
      r2[0]?.legenda === 'meu-recem-publicado',
      `(${nomes(r2)})`,
    );
    const r3 = await ordem(ZICO);
    checar('e não vem primeiro no feed dos outros', r3[0]?.legenda === 'campeao', `(${nomes(r3)})`);

    await cliente.query(
      `insert into public.follows (seguidor_id, seguido_id) values ($1,$2) on conflict do nothing`,
      [PEDRO, ZICO],
    );
    const seg = await comoUsuario(cliente, PEDRO, async () => {
      const { rows } = await cliente.query(
        `select v.legenda, f.cursor from public.feed_ids('seguindo', null, 10) f
           join public.videos v on v.id = f.id`,
      );
      return rows;
    });
    checar(
      '"seguindo" traz só quem eu sigo, em ordem cronológica',
      seg.length === 2 && seg[0].legenda === 'campeao' && seg[1].legenda === 'medio',
      `(${nomes(seg)})`,
    );
    checar('o cursor de "seguindo" continua sendo a data pura', !/\|/.test(seg[0]?.cursor || ''));

    await cliente.query('rollback');
  } finally {
    await cliente.end();
  }
}

// ---------------------------------------------------------------------------- principal

async function main() {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'vulture-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dados,
    user: 'postgres',
    password: 'teste',
    port: PORTA,
    persistent: false,
  });

  console.log(`→ subindo Postgres descartável (porta ${PORTA})`);
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('vulture');

  let codigo = 0;
  try {
    console.log('→ montando o mínimo do ambiente Supabase');
    let r = await rodar(STUBS);
    if (!r.ok) throw new Error(`stubs: ${r.erro}`);

    console.log('→ schema base');
    r = await rodar(fs.readFileSync(path.join(RAIZ, 'supabase/schema.sql'), 'utf8'));
    if (!r.ok) throw new Error(`schema.sql: ${r.erro}`);

    await rodar(
      `grant select, insert, update, delete on all tables in schema public to anon, authenticated;
       grant usage, select on all sequences in schema public to anon, authenticated;`,
    );

    console.log('→ semeando 5 perfis e um jogo');
    r = await rodar(SEED);
    if (!r.ok) throw new Error(`seed: ${r.erro}`);

    console.log('→ migrations');
    const dir = path.join(RAIZ, 'supabase/migrations');
    const arquivos = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let oks = 0;
    let falhas = 0;
    let pulos = 0;

    for (const nome of arquivos) {
      if (FILTRO && !nome.includes(FILTRO)) continue;
      // o primeiro arquivo é cópia do schema.sql, que já foi aplicado acima
      if (nome.startsWith('00000000000000_schema_base')) {
        console.log(`  ~ ${nome.padEnd(56)} (é o próprio schema base)`);
        pulos++;
        continue;
      }

      const res = await rodar(fs.readFileSync(path.join(dir, nome), 'utf8'));
      const autoteste = res.avisos.find((a) => /autoteste/i.test(a)) || '';

      if (!res.ok) {
        if (IGNORAVEIS.test(res.erro)) {
          console.log(`  ~ ${nome.padEnd(56)} (depende de pg_cron ou net)`);
          pulos++;
        } else {
          console.log(`  ✗ ${nome}\n      ${res.erro}`);
          if (res.detalhe) console.log(`      detalhe: ${res.detalhe}`);
          falhas++;
        }
      } else {
        let marca = '';
        if (/pulado/i.test(autoteste)) marca = ' (autoteste pulado)';
        else if (autoteste) marca = ' ✓ autoteste';
        console.log(`  ✓ ${nome.padEnd(56)}${marca}`);
        oks++;
      }
    }

    console.log(`\naplicadas: ${oks}   falhas: ${falhas}   puladas: ${pulos}`);

    if (falhas === 0 && !FILTRO) {
      await verificarComportamento();
      console.log(
        falhasDeComportamento === 0
          ? '\ncomportamento: tudo certo'
          : `\ncomportamento: ${falhasDeComportamento} falha(s)`,
      );
    }
    codigo = falhas + falhasDeComportamento === 0 ? 0 : 1;
  } catch (e) {
    console.error(`\n✗ ${e.message}`);
    codigo = 1;
  } finally {
    await pg.stop();
    fs.rmSync(dados, { recursive: true, force: true });
  }
  process.exit(codigo);
}

main().catch((e) => {
  console.error('o harness quebrou:', e.message);
  process.exit(2);
});
