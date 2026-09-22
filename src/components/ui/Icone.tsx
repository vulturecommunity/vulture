import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

import { cores } from '@/theme';

type GlifoFeather = keyof typeof Feather.glyphMap;
type GlifoMaterial = keyof typeof MaterialCommunityIcons.glyphMap;
type Definicao = { f: 'feather'; g: GlifoFeather } | { f: 'material'; g: GlifoMaterial };

const feather = (g: GlifoFeather): Definicao => ({ f: 'feather', g });
const material = (g: GlifoMaterial): Definicao => ({ f: 'material', g });

/** Vocabulário de ícones do app: traços finos (Feather) com complementos do Material. */
const ICONES = {
  inicio: feather('home'),
  explorar: feather('compass'),
  lives: feather('radio'),
  perfil: feather('user'),
  gravar: feather('video'),
  curtir: feather('heart'),
  curtido: material('heart'),
  comentar: feather('message-circle'),
  comentarios: feather('message-square'),
  salvar: feather('bookmark'),
  salvo: material('bookmark'),
  compartilhar: feather('share-2'),
  mais: feather('more-horizontal'),
  sino: feather('bell'),
  sinoMudo: feather('bell-off'),
  buscar: feather('search'),
  fechar: feather('x'),
  limpar: feather('x-circle'),
  voltar: feather('arrow-left'),
  avancar: feather('chevron-right'),
  camera: feather('camera'),
  virarCamera: material('camera-flip-outline'),
  flash: material('flash'),
  flashDesligado: material('flash-off'),
  galeria: feather('image'),
  foto: feather('image'),
  video: feather('video'),
  videoDesligado: feather('video-off'),
  enviar: feather('send'),
  olho: feather('eye'),
  play: feather('play'),
  grade: feather('grid'),
  editar: feather('edit-3'),
  sair: feather('log-out'),
  info: feather('info'),
  reiniciar: feather('refresh-cw'),
  bloquear: feather('slash'),
  escudo: feather('shield'),
  escudoOk: material('shield-check-outline'),
  denunciar: feather('flag'),
  excluir: feather('trash-2'),
  ok: feather('check-circle'),
  alerta: feather('alert-circle'),
  somLigado: feather('volume-2'),
  somDesligado: feather('volume-x'),
  microfone: feather('mic'),
  audio: feather('music'),
  menu: feather('menu'),
  configuracoes: feather('settings'),
  filme: feather('film'),
  torcida: feather('users'),
  seguiu: feather('user-plus'),
  megafone: material('bullhorn-outline'),
  trofeu: material('trophy-outline'),
  emAlta: material('fire'),
  bola: material('soccer'),
  estadio: material('stadium-variant'),
  apito: material('whistle-outline'),
  hashtag: feather('hash'),
  relogio: feather('clock'),
  aoVivo: material('access-point'),
  nuvem: material('cloud-check-outline'),
  laboratorio: material('flask-outline'),
  sorriso: feather('smile'),
  grafico: feather('bar-chart-2'),
  cadeado: feather('lock'),
  premio: feather('award'),
  tendencia: feather('trending-up'),
  // mensagens, rasantes e perfil
  mensagens: material('forum-outline'),
  novaConversa: material('message-plus-outline'),
  adicionarPessoa: feather('user-plus'),
  pessoaOk: feather('user-check'),
  rasante: material('bird'),
  maisCirculo: feather('plus-circle'),
  adicionar: feather('plus'),
  enviado: feather('check'),
  lido: material('check-all'),
  chevronBaixo: feather('chevron-down'),
  link: feather('link'),
  pausa: feather('pause'),
} as const;

export type NomeDeIcone = keyof typeof ICONES;

export interface IconeProps {
  nome: NomeDeIcone;
  tamanho?: number;
  cor?: string;
  style?: StyleProp<TextStyle>;
}

export function Icone({ nome, tamanho = 22, cor = cores.texto, style }: IconeProps) {
  const def: Definicao = ICONES[nome];
  if (def.f === 'material') {
    return <MaterialCommunityIcons name={def.g} size={tamanho} color={cor} style={style} />;
  }
  return <Feather name={def.g} size={tamanho} color={cor} style={style} />;
}
