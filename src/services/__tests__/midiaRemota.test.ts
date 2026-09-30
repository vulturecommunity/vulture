import { File } from 'expo-file-system';

import {
  apagarNoR2,
  chaveDoR2,
  configuracaoDoR2,
  ehUrlDoR2,
  enviarParaR2,
  urlPublicaNoR2,
  usandoR2,
} from '@/services/midia/remoto';

const BASE = 'https://midia.vulture.test';
const USUARIO = '11111111-1111-1111-1111-111111111111';

function comR2<T>(valor: string | undefined, corpo: () => T): T {
  const antes = process.env.EXPO_PUBLIC_MIDIA_URL;
  process.env.EXPO_PUBLIC_MIDIA_URL = valor;
  try {
    return corpo();
  } finally {
    process.env.EXPO_PUBLIC_MIDIA_URL = antes;
  }
}

describe('escolha do destino da mídia', () => {
  it('sem a variável, o app continua no Storage da Supabase', () => {
    comR2(undefined, () => {
      expect(configuracaoDoR2()).toBeNull();
      expect(usandoR2()).toBe(false);
      expect(urlPublicaNoR2('videos', `${USUARIO}/v.mp4`)).toBeNull();
    });
  });

  it('placeholder do .env.example não liga o R2 por engano', () => {
    comR2('https://SEU-BUCKET.exemplo.com', () => expect(usandoR2()).toBe(false));
    comR2('midia.vulture.test', () => expect(usandoR2()).toBe(false));
  });

  it('barra sobrando no fim não gera URL com barra dupla', () => {
    comR2(`${BASE}///`, () => {
      expect(urlPublicaNoR2('posts', `${USUARIO}/f.jpg`)).toBe(
        `${BASE}/posts/${USUARIO}/f.jpg`,
      );
    });
  });
});

describe('reconhecer a origem de uma URL', () => {
  it('distingue o que é do R2 do que ficou na Supabase', () => {
    comR2(BASE, () => {
      const daSupabase =
        'https://abc.supabase.co/storage/v1/object/public/videos/' + USUARIO + '/v.mp4';
      expect(ehUrlDoR2(`${BASE}/videos/${USUARIO}/v.mp4`)).toBe(true);
      expect(ehUrlDoR2(daSupabase)).toBe(false);
      expect(ehUrlDoR2(null)).toBe(false);
    });
  });

  it('extrai a chave para poder apagar depois', () => {
    comR2(BASE, () => {
      expect(chaveDoR2(`${BASE}/posts/${USUARIO}/f.jpg`)).toBe(`posts/${USUARIO}/f.jpg`);
      // querystring de cache não pode entrar na chave
      expect(chaveDoR2(`${BASE}/posts/${USUARIO}/f.jpg?v=2`)).toBe(`posts/${USUARIO}/f.jpg`);
      expect(chaveDoR2('https://outro.com/posts/x.jpg')).toBeNull();
    });
  });
});

describe('envio para o R2', () => {
  const destino = {
    metodo: 'PUT' as const,
    urlDeUpload: `${BASE}/assinada?X-Amz-Signature=abc`,
    urlPublica: `${BASE}/videos/${USUARIO}/v.mp4`,
  };

  it('pede a URL assinada e devolve a pública, sem o arquivo passar pela função', async () => {
    const invocar = jest.fn().mockResolvedValue(destino);
    const url = await enviarParaR2(
      { invocar },
      'videos',
      `${USUARIO}/v.mp4`,
      'file:///local.mp4',
      'video/mp4',
    );
    expect(url).toBe(destino.urlPublica);
    expect(invocar).toHaveBeenCalledWith('midia-assinar', {
      pasta: 'videos',
      caminho: `${USUARIO}/v.mp4`,
      tipoMime: 'video/mp4',
      bytes: 1024,
    });
  });

  it('erro claro quando a função não devolve assinatura', async () => {
    const invocar = jest.fn().mockResolvedValue({});
    await expect(
      enviarParaR2({ invocar }, 'posts', `${USUARIO}/f.jpg`, 'file:///f.jpg', 'image/jpeg'),
    ).rejects.toThrow('preparar o envio');
  });
});

describe('exclusão no R2', () => {
  it('não chama o servidor quando o R2 não está ligado', async () => {
    const invocar = jest.fn();
    await comR2(undefined, async () => {
      await apagarNoR2({ invocar }, ['videos/a.mp4']);
      expect(invocar).not.toHaveBeenCalled();
    });
  });

  it('manda as chaves quando está ligado', async () => {
    const invocar = jest.fn().mockResolvedValue({ apagadas: 1 });
    await comR2(BASE, async () => {
      await apagarNoR2({ invocar }, ['videos/a.mp4', '']);
      expect(invocar).toHaveBeenCalledWith('midia-apagar', { chaves: ['videos/a.mp4'] });
    });
  });

  it('falha ao apagar não derruba a exclusão do conteúdo', async () => {
    const invocar = jest.fn().mockRejectedValue(new Error('sem rede'));
    await comR2(BASE, async () => {
      await expect(apagarNoR2({ invocar }, ['posts/a.jpg'])).resolves.toBeUndefined();
    });
  });
});

describe('cache dos arquivos enviados', () => {
  it('o upload leva Cache-Control longo e imutável', async () => {
    // Sem este cabeçalho o CDN não guarda na borda e cada exibição vira leitura cobrada.
    // Foi exatamente o que se perdeu ao migrar do Storage da Supabase para o R2, então o
    // teste olha o que chega no UploadTask — não só a constante.
    const criar = jest.spyOn(File.prototype, 'createUploadTask');
    const invocar = jest.fn().mockResolvedValue({
      metodo: 'PUT',
      urlDeUpload: `${BASE}/assinada`,
      urlPublica: `${BASE}/videos/${USUARIO}/v.mp4`,
    });

    await enviarParaR2({ invocar }, 'videos', `${USUARIO}/v.mp4`, 'file:///v.mp4', 'video/mp4');

    const opcoes = criar.mock.calls[0][1] as { headers: Record<string, string> };
    expect(opcoes.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(opcoes.headers['Content-Type']).toBe('video/mp4');
    criar.mockRestore();
  });
});
