/** Paleta do Vulture: identidade rubro-negra sóbria, fundo quase preto e vermelho como acento. */
export const cores = {
  vermelho: '#C8102E',
  vermelhoVivo: '#E4172F',
  vermelhoEscuro: '#8E0B20',
  vermelhoSuave: 'rgba(200, 16, 46, 0.14)',
  dourado: '#D9A441',
  preto: '#0A0A0B',
  pretoPuro: '#000000',
  fundo: '#0A0A0B',
  fundoElevado: '#141416',
  fundoCartao: '#1C1C1F',
  borda: '#27272B',
  bordaClara: 'rgba(255,255,255,0.10)',
  vidro: 'rgba(10,10,11,0.68)',
  vidroClaro: 'rgba(255,255,255,0.10)',
  branco: '#FFFFFF',
  texto: '#F5F5F6',
  textoSecundario: '#A6A8AE',
  textoTerciario: '#6C6E75',
  sucesso: '#2FBF71',
  aviso: '#E8B84A',
  erro: '#FF4D5A',
  sombra: 'rgba(0,0,0,0.65)',
  transparente: 'transparent',
  overlayEscuro: 'rgba(0,0,0,0.55)',
} as const;

export type NomeDeCor = keyof typeof cores;
