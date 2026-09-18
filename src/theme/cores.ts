/** Paleta do Vulture: tema escuro, vermelho e preto da torcida. */
export const cores = {
  vermelho: '#E30613',
  vermelhoEscuro: '#A8040E',
  vermelhoSuave: 'rgba(227, 6, 19, 0.16)',
  preto: '#111111',
  pretoPuro: '#000000',
  fundo: '#111111',
  fundoElevado: '#1C1C1E',
  fundoCartao: '#242426',
  borda: '#2E2E31',
  branco: '#FFFFFF',
  texto: '#FFFFFF',
  textoSecundario: '#B0B4BA',
  textoTerciario: '#7A7E85',
  sucesso: '#2ECC71',
  aviso: '#F5A623',
  erro: '#FF4D4F',
  sombra: 'rgba(0,0,0,0.6)',
  transparente: 'transparent',
  overlayEscuro: 'rgba(0,0,0,0.45)',
} as const;

export type NomeDeCor = keyof typeof cores;
