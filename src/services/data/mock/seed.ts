import type { Interesse } from '@/constants/interesses';
import type { Comentario, Live, MensagemLive, Notificacao, Usuario, Video } from '@/types';

/**
 * Dados de demonstração do driver mock.
 * Os vídeos são clipes públicos de teste (Big Buck Bunny, Sintel, Jellyfish — licenças CC/livres)
 * hospedados em test-videos.co.uk e no MDN (CC0). As miniaturas usam fotos aleatórias do Lorem Picsum.
 */

const ORIGEM_TESTE = 'https://test-videos.co.uk/vids';

export const VIDEOS_DE_EXEMPLO: {
  url: string;
  duracao: number;
  largura: number;
  altura: number;
}[] = [
  {
    url: `${ORIGEM_TESTE}/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4`,
    duracao: 10,
    largura: 640,
    altura: 360,
  },
  {
    url: `${ORIGEM_TESTE}/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4`,
    duracao: 10,
    largura: 1280,
    altura: 720,
  },
  {
    url: `${ORIGEM_TESTE}/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4`,
    duracao: 10,
    largura: 640,
    altura: 360,
  },
  {
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    duracao: 4,
    largura: 1920,
    altura: 1080,
  },
  {
    url: `${ORIGEM_TESTE}/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4`,
    duracao: 10,
    largura: 1280,
    altura: 720,
  },
  {
    url: `${ORIGEM_TESTE}/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4`,
    duracao: 10,
    largura: 640,
    altura: 360,
  },
  {
    url: `${ORIGEM_TESTE}/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4`,
    duracao: 10,
    largura: 1280,
    altura: 720,
  },
  {
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
    duracao: 6,
    largura: 1920,
    altura: 1080,
  },
  {
    url: `${ORIGEM_TESTE}/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4`,
    duracao: 10,
    largura: 1280,
    altura: 720,
  },
  {
    url: `${ORIGEM_TESTE}/jellyfish/mp4/h264/720/Jellyfish_720_10s_2MB.mp4`,
    duracao: 10,
    largura: 1280,
    altura: 720,
  },
  {
    url: `${ORIGEM_TESTE}/sintel/mp4/h264/720/Sintel_720_10s_2MB.mp4`,
    duracao: 10,
    largura: 1280,
    altura: 720,
  },
  {
    url: `${ORIGEM_TESTE}/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_2MB.mp4`,
    duracao: 10,
    largura: 1920,
    altura: 1080,
  },
];

export function thumbnailDeExemplo(semente: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(semente)}/360/640`;
}

const DIA = 24 * 60 * 60 * 1000;

function diasAtras(dias: number, horas = 0): string {
  return new Date(Date.now() - dias * DIA - horas * 60 * 60 * 1000).toISOString();
}

export const USUARIOS_SEED: Usuario[] = [
  {
    id: 'u-nacao',
    apelido: 'nacao_rubro',
    nome: 'Nação Rubro-Negra',
    avatarUrl: null,
    bio: 'A maior do mundo, todo dia. 🔴⚫',
    interesses: ['Torcida', 'Jogos', 'Memes'],
    seguidores: 0,
    seguindo: 0,
    curtidasRecebidas: 0,
    totalVideos: 0,
    criadoEm: diasAtras(300),
  },
  {
    id: 'u-gavea',
    apelido: 'gavea.insider',
    nome: 'Gávea Insider',
    avatarUrl: null,
    bio: 'Bastidores do Ninho e da Gávea.',
    interesses: ['Bastidores', 'Análises'],
    seguidores: 0,
    seguindo: 0,
    curtidasRecebidas: 0,
    totalVideos: 0,
    criadoEm: diasAtras(280),
  },
  {
    id: 'u-maraca',
    apelido: 'maraca_vibes',
    nome: 'Maraca Vibes',
    avatarUrl: null,
    bio: 'Direto da arquibancada do Maracanã.',
    interesses: ['Torcida', 'Jogos'],
    seguidores: 0,
    seguindo: 0,
    curtidasRecebidas: 0,
    totalVideos: 0,
    criadoEm: diasAtras(250),
  },
  {
    id: 'u-taticas',
    apelido: 'prancheta_rn',
    nome: 'Prancheta RN',
    avatarUrl: null,
    bio: 'Análise tática sem enrolação.',
    interesses: ['Análises', 'Jogos'],
    seguidores: 0,
    seguindo: 0,
    curtidasRecebidas: 0,
    totalVideos: 0,
    criadoEm: diasAtras(200),
  },
  {
    id: 'u-memes',
    apelido: 'urubu_memes',
    nome: 'Urubu Memes',
    avatarUrl: null,
    bio: 'Zoeira rubro-negra sem limites 😂',
    interesses: ['Memes', 'Torcida'],
    seguidores: 0,
    seguindo: 0,
    curtidasRecebidas: 0,
    totalVideos: 0,
    criadoEm: diasAtras(180),
  },
  {
    id: 'u-base',
    apelido: 'ninho_base',
    nome: 'Ninho Base',
    avatarUrl: null,
    bio: 'Os garotos do Ninho de amanhã.',
    interesses: ['Bastidores', 'Análises'],
    seguidores: 0,
    seguindo: 0,
    curtidasRecebidas: 0,
    totalVideos: 0,
    criadoEm: diasAtras(150),
  },
  {
    id: 'u-golaco',
    apelido: 'golaco_fc',
    nome: 'Golaço FC',
    avatarUrl: null,
    bio: 'Só golaço, todo dia.',
    interesses: ['Jogos', 'Memes'],
    seguidores: 0,
    seguindo: 0,
    curtidasRecebidas: 0,
    totalVideos: 0,
    criadoEm: diasAtras(120),
  },
  {
    id: 'u-resenha',
    apelido: 'resenha_rn',
    nome: 'Resenha Rubro-Negra',
    avatarUrl: null,
    bio: 'Papo de bar com a torcida.',
    interesses: ['Torcida', 'Memes', 'Análises'],
    seguidores: 0,
    seguindo: 0,
    curtidasRecebidas: 0,
    totalVideos: 0,
    criadoEm: diasAtras(90),
  },
];

const LEGENDAS: { legenda: string; categoria: Interesse; audio: string }[] = [
  {
    legenda: 'A festa antes do jogo no #Maracanã foi surreal 🔴⚫ #Torcida #Nação',
    categoria: 'Torcida',
    audio: 'Som original - Nação Rubro-Negra',
  },
  {
    legenda: 'Bastidores do vestiário antes do clássico #Bastidores #Ninho',
    categoria: 'Bastidores',
    audio: 'Som original - Gávea Insider',
  },
  {
    legenda: 'Que #Golaço foi esse?! Assista de novo e de novo 🔥 #Jogos',
    categoria: 'Jogos',
    audio: 'Hino da torcida (remix)',
  },
  {
    legenda: 'Análise rápida: por que a saída de bola funcionou hoje #Análises #Prancheta',
    categoria: 'Análises',
    audio: 'Som original - Prancheta RN',
  },
  {
    legenda: 'Quando o juiz marca contra a gente 😂 #Memes #Resenha',
    categoria: 'Memes',
    audio: 'Áudio viral - risada',
  },
  {
    legenda: 'Os garotos da #Base treinando forte 💪 #Bastidores',
    categoria: 'Bastidores',
    audio: 'Som original - Ninho Base',
  },
  {
    legenda: 'Caravana chegando no #Maracanã 🚌 #Torcida',
    categoria: 'Torcida',
    audio: 'Batucada da arquibancada',
  },
  {
    legenda: 'Top 3 gols da semana, qual foi o melhor? #Golaço #Jogos',
    categoria: 'Jogos',
    audio: 'Som original - Golaço FC',
  },
  {
    legenda: 'Resenha pós-jogo: acertos e erros #Resenha #Análises',
    categoria: 'Análises',
    audio: 'Som original - Resenha Rubro-Negra',
  },
  {
    legenda: 'Meme do dia: a cara do torcedor no acréscimo 😂 #Memes',
    categoria: 'Memes',
    audio: 'Áudio viral - suspense',
  },
  {
    legenda: 'Bastidores do embarque para o jogo fora de casa ✈️ #Bastidores',
    categoria: 'Bastidores',
    audio: 'Som original - Gávea Insider',
  },
  {
    legenda: 'Grito de gol na arquibancada, arrepia! #Torcida #Maracanã',
    categoria: 'Torcida',
    audio: 'Som original - Maraca Vibes',
  },
];

function extrairTags(texto: string): string[] {
  return Array.from(texto.matchAll(/#([\p{L}\p{N}_]+)/gu)).map((m) => m[1]);
}

/** Gera 120 vídeos (12 clipes × 10 variações) para demonstrar performance do feed. */
export function gerarVideosSeed(): Video[] {
  const videos: Video[] = [];
  const total = VIDEOS_DE_EXEMPLO.length * 10;
  for (let i = 0; i < total; i++) {
    const clipe = VIDEOS_DE_EXEMPLO[i % VIDEOS_DE_EXEMPLO.length];
    const legenda = LEGENDAS[i % LEGENDAS.length];
    const autor = USUARIOS_SEED[i % USUARIOS_SEED.length];
    const id = `v-seed-${String(i + 1).padStart(3, '0')}`;
    const curtidas = Math.round(((i * 7919) % 4200) + 40);
    videos.push({
      id,
      autorId: autor.id,
      autor: { id: autor.id, apelido: autor.apelido, nome: autor.nome, avatarUrl: autor.avatarUrl },
      tipo: 'video',
      url: clipe.url,
      thumbnailUrl: thumbnailDeExemplo(id),
      legenda:
        i < LEGENDAS.length
          ? legenda.legenda
          : `${legenda.legenda} (parte ${Math.floor(i / LEGENDAS.length) + 1})`,
      hashtags: extrairTags(legenda.legenda),
      categoria: legenda.categoria,
      audio: legenda.audio,
      duracao: clipe.duracao,
      largura: clipe.largura,
      altura: clipe.altura,
      curtidas,
      comentarios: 0,
      salvos: Math.round(curtidas / 9),
      compartilhamentos: Math.round(curtidas / 15),
      visualizacoes: curtidas * 12 + 300,
      criadoEm: diasAtras(Math.floor(i / 4), (i % 4) * 5),
      curtido: false,
      salvo: false,
    });
  }
  return videos;
}

export function gerarComentariosSeed(videos: Video[]): Comentario[] {
  const frases = [
    'Isso é Flamengo! 🔴⚫',
    'Arrepiei aqui 😭',
    'Melhor torcida do mundo, sem discussão',
    'Manda mais desse conteúdo!',
    'Vamos Mengão!!!',
    'Que vídeo incrível, parabéns',
  ];
  const respostas = ['Concordo demais!', 'Exatamente isso 👏', 'Kkkkkk verdade'];
  const comentarios: Comentario[] = [];
  videos.slice(0, 24).forEach((video, i) => {
    const quantidade = (i % 3) + 1;
    for (let j = 0; j < quantidade; j++) {
      const autor = USUARIOS_SEED[(i + j + 1) % USUARIOS_SEED.length];
      const pai: Comentario = {
        id: `c-seed-${i}-${j}`,
        videoId: video.id,
        autorId: autor.id,
        autor: {
          id: autor.id,
          apelido: autor.apelido,
          nome: autor.nome,
          avatarUrl: autor.avatarUrl,
        },
        texto: frases[(i + j) % frases.length],
        paiId: null,
        curtidas: (i * 3 + j) % 40,
        criadoEm: diasAtras(Math.floor(i / 4), j),
        respostas: [],
      };
      comentarios.push(pai);
      if (j === 0) {
        const autorResposta = USUARIOS_SEED[(i + j + 3) % USUARIOS_SEED.length];
        comentarios.push({
          id: `c-seed-${i}-${j}-r`,
          videoId: video.id,
          autorId: autorResposta.id,
          autor: {
            id: autorResposta.id,
            apelido: autorResposta.apelido,
            nome: autorResposta.nome,
            avatarUrl: autorResposta.avatarUrl,
          },
          texto: respostas[i % respostas.length],
          paiId: pai.id,
          curtidas: i % 7,
          criadoEm: diasAtras(Math.floor(i / 4), 0),
          respostas: [],
        });
      }
    }
  });
  return comentarios;
}

export function gerarLivesSeed(): Live[] {
  return [
    {
      id: 'l-seed-1',
      anfitriaoId: 'u-maraca',
      anfitriao: { id: 'u-maraca', apelido: 'maraca_vibes', nome: 'Maraca Vibes', avatarUrl: null },
      titulo: 'Esquenta pro jogo direto do Maracanã 🔴⚫',
      thumbnailUrl: thumbnailDeExemplo('live-1'),
      sala: 'vulture-l-seed-1',
      espectadores: 1280,
      ativa: true,
      iniciadaEm: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      encerradaEm: null,
    },
    {
      id: 'l-seed-2',
      anfitriaoId: 'u-resenha',
      anfitriao: {
        id: 'u-resenha',
        apelido: 'resenha_rn',
        nome: 'Resenha Rubro-Negra',
        avatarUrl: null,
      },
      titulo: 'Resenha ao vivo: escalação e palpites',
      thumbnailUrl: thumbnailDeExemplo('live-2'),
      sala: 'vulture-l-seed-2',
      espectadores: 342,
      ativa: true,
      iniciadaEm: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      encerradaEm: null,
    },
    {
      id: 'l-seed-3',
      anfitriaoId: 'u-taticas',
      anfitriao: {
        id: 'u-taticas',
        apelido: 'prancheta_rn',
        nome: 'Prancheta RN',
        avatarUrl: null,
      },
      titulo: 'Análise tática ao vivo',
      thumbnailUrl: thumbnailDeExemplo('live-3'),
      sala: 'vulture-l-seed-3',
      espectadores: 97,
      ativa: true,
      iniciadaEm: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      encerradaEm: null,
    },
  ];
}

export function gerarMensagensDeLiveSeed(lives: Live[]): MensagemLive[] {
  const frases = [
    'Chegueeei 🔴⚫',
    'Que time é esse!',
    'Boa noite nação!',
    'Vai Mengão!',
    'Alguém sabe a escalação?',
    '🦅🦅🦅',
  ];
  const mensagens: MensagemLive[] = [];
  lives.forEach((live, i) => {
    for (let j = 0; j < 4; j++) {
      const autor = USUARIOS_SEED[(i + j) % USUARIOS_SEED.length];
      mensagens.push({
        id: `m-seed-${i}-${j}`,
        liveId: live.id,
        autorId: autor.id,
        autor: { id: autor.id, apelido: autor.apelido, avatarUrl: autor.avatarUrl },
        tipo: 'texto',
        texto: frases[(i + j) % frases.length],
        reacao: null,
        criadoEm: new Date(Date.now() - (4 - j) * 60 * 1000).toISOString(),
      });
    }
  });
  return mensagens;
}

export function gerarNotificacoesSeed(): Notificacao[] {
  const u = USUARIOS_SEED;
  return [
    {
      id: 'n-seed-1',
      tipo: 'sistema',
      deId: null,
      de: null,
      videoId: null,
      liveId: null,
      texto: 'Bem-vindo ao Vulture! Grave seu primeiro vídeo tocando no botão + 🔴⚫',
      lida: false,
      criadoEm: new Date().toISOString(),
    },
    {
      id: 'n-seed-2',
      tipo: 'seguiu',
      deId: u[0].id,
      de: { id: u[0].id, apelido: u[0].apelido, avatarUrl: u[0].avatarUrl },
      videoId: null,
      liveId: null,
      texto: 'começou a seguir você',
      lida: false,
      criadoEm: diasAtras(0, 2),
    },
  ];
}

/** Rasantes de demonstração: clipes curtos de alguns perfis, publicados nas últimas horas. */
export function gerarRasantesSeed(agora: number = Date.now()): {
  id: string;
  autorId: string;
  url: string;
  thumbnailUrl: string | null;
  duracao: number;
  criadoEm: string;
  expiraEm: string;
}[] {
  const HORA = 60 * 60 * 1000;
  const plano: { autorId: string; clipe: number; horasAtras: number }[] = [
    { autorId: 'u-nacao', clipe: 3, horasAtras: 1 },
    { autorId: 'u-nacao', clipe: 7, horasAtras: 0.5 },
    { autorId: 'u-golaco', clipe: 0, horasAtras: 3 },
    { autorId: 'u-maraca', clipe: 1, horasAtras: 5 },
    { autorId: 'u-memes', clipe: 2, horasAtras: 8 },
    { autorId: 'u-resenha', clipe: 5, horasAtras: 11 },
  ];
  return plano.map((p, i) => {
    const clipe = VIDEOS_DE_EXEMPLO[p.clipe % VIDEOS_DE_EXEMPLO.length];
    const criadoEm = agora - p.horasAtras * HORA;
    const id = `r-seed-${i + 1}`;
    return {
      id,
      autorId: p.autorId,
      url: clipe.url,
      thumbnailUrl: thumbnailDeExemplo(id),
      duracao: Math.min(15, clipe.duracao),
      criadoEm: new Date(criadoEm).toISOString(),
      expiraEm: new Date(criadoEm + 24 * HORA).toISOString(),
    };
  });
}

/** Respostas automáticas dos perfis de demonstração no chat privado. */
export const RESPOSTAS_DE_DEMO = [
  'Fala, torcedor! Tudo certo por aí? 🔴⚫',
  'Boa! Já viu o último vídeo que postei?',
  'Sábado tem jogo, vai pro Maraca?',
  'Isso aí, a nação não para! 🦅',
  'Manda a resenha que eu respondo já já.',
  'Combinado! Depois te chamo aqui.',
];
