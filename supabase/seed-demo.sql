-- =====================================================================================
-- VULTURE — SEED DE DEMONSTRAÇÃO (OPCIONAL)
-- Cria 3 torcedores fictícios (nacao@/gavea@/maraca@vulture.demo, senha "vulture123"),
-- 6 vídeos públicos de teste e 1 live. NÃO rode em produção: só para demo/apresentação.
-- Para remover depois: delete from auth.users where email like '%@vulture.demo';
-- =====================================================================================


do $$
declare
  ids uuid[] := array[
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    '33333333-3333-4333-8333-333333333333'::uuid
  ];
  emails text[] := array['nacao@vulture.demo', 'gavea@vulture.demo', 'maraca@vulture.demo'];
  apelidos text[] := array['nacao_rubro', 'gavea.insider', 'maraca_vibes'];
  nomes text[] := array['Nação Rubro-Negra', 'Gávea Insider', 'Maraca Vibes'];
  i integer;
begin
  for i in 1..3 loop
    if not exists (select 1 from auth.users where id = ids[i]) then
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
      ) values (
        ids[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', emails[i],
        crypt('vulture123', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('apelido', apelidos[i], 'nome', nomes[i]),
        now(), now(),
        '', '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), ids[i], ids[i]::text, 'email',
              jsonb_build_object('sub', ids[i]::text, 'email', emails[i], 'email_verified', true),
              now(), now(), now())
      on conflict do nothing;
    end if;
    -- garante o perfil mesmo que o trigger não tenha rodado
    insert into public.profiles (id, apelido, nome, bio, interesses)
    values (ids[i], apelidos[i], nomes[i], 'Perfil de demonstração do Vulture.', array['Torcida', 'Jogos'])
    on conflict (id) do nothing;
  end loop;

  insert into public.videos (id, autor_id, tipo, url, thumbnail_url, legenda, hashtags, categoria, audio, duracao, largura, altura)
  values
    ('a1a1a1a1-0000-4000-8000-000000000001', ids[1], 'video',
     'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
     'https://picsum.photos/seed/vulture-seed-1/360/640',
     'A festa antes do jogo no #Maracanã foi surreal 🔴⚫ #Torcida', array['Maracanã', 'Torcida'], 'Torcida', 'Som original - Nação Rubro-Negra', 10, 640, 360),
    ('a1a1a1a1-0000-4000-8000-000000000002', ids[2], 'video',
     'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4',
     'https://picsum.photos/seed/vulture-seed-2/360/640',
     'Bastidores do vestiário antes do clássico #Bastidores', array['Bastidores'], 'Bastidores', 'Som original - Gávea Insider', 10, 1280, 720),
    ('a1a1a1a1-0000-4000-8000-000000000003', ids[3], 'video',
     'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4',
     'https://picsum.photos/seed/vulture-seed-3/360/640',
     'Que #Golaço foi esse?! 🔥 #Jogos', array['Golaço', 'Jogos'], 'Jogos', 'Hino da torcida (remix)', 10, 640, 360),
    ('a1a1a1a1-0000-4000-8000-000000000004', ids[1], 'video',
     'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
     'https://picsum.photos/seed/vulture-seed-4/360/640',
     'Caravana chegando no #Maracanã 🚌 #Torcida', array['Maracanã', 'Torcida'], 'Torcida', 'Batucada da arquibancada', 4, 1920, 1080),
    ('a1a1a1a1-0000-4000-8000-000000000005', ids[2], 'video',
     'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
     'https://picsum.photos/seed/vulture-seed-5/360/640',
     'Os garotos da #Base treinando forte 💪', array['Base'], 'Bastidores', 'Som original - Gávea Insider', 10, 1280, 720),
    ('a1a1a1a1-0000-4000-8000-000000000006', ids[3], 'video',
     'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
     'https://picsum.photos/seed/vulture-seed-6/360/640',
     'Resenha pós-jogo: acertos e erros #Resenha #Análises', array['Resenha', 'Análises'], 'Análises', 'Som original - Maraca Vibes', 6, 1920, 1080)
  on conflict (id) do nothing;

  insert into public.live_streams (id, anfitriao_id, titulo, thumbnail_url, sala, espectadores, ativa)
  values ('b2b2b2b2-0000-4000-8000-000000000001', ids[3], 'Esquenta pro jogo direto do Maracanã 🔴⚫',
          'https://picsum.photos/seed/vulture-live-1/360/640', 'vulture-demo-live-1', 128, true)
  on conflict (id) do nothing;
end $$;
