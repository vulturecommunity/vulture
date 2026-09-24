/* eslint-disable @typescript-eslint/no-require-imports */
// Configuração global dos testes (roda antes do ambiente de cada arquivo de teste).

// Variáveis de ambiente padrão: os testes sempre usam o driver mock.
process.env.EXPO_PUBLIC_DATA_DRIVER = 'mock';
// partidas: JSON local nos testes (o driver real vai à rede)
process.env.EXPO_PUBLIC_MATCH_DRIVER = 'mock';

// AsyncStorage em memória
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Reanimated e Gesture Handler
require('react-native-reanimated').setUpTests();
require('react-native-gesture-handler/jestSetup');

// Área segura: valores fixos para os testes
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

// Haptics não existe no ambiente de teste
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Player de vídeo: substituímos por um objeto simples
jest.mock('expo-video', () => {
  const React = require('react');
  const { View } = require('react-native');
  const criarPlayer = () => ({
    playing: false,
    muted: false,
    loop: false,
    currentTime: 0,
    duration: 0,
    status: 'readyToPlay',
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    replay: jest.fn(),
    release: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  });
  return {
    useVideoPlayer: jest.fn(() => criarPlayer()),
    createVideoPlayer: jest.fn(() => criarPlayer()),
    VideoView: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: 'video-view', ...props }),
  };
});

jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn(() =>
    Promise.resolve({ uri: 'file:///thumb.jpg', width: 100, height: 100 }),
  ),
}));

// Sistema de arquivos: simulação em memória
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    exists = true;
    size = 1024;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    copy() {
      return Promise.resolve();
    }
    move() {
      return Promise.resolve();
    }
    delete() {}
    create() {}
    arrayBuffer() {
      return Promise.resolve(new ArrayBuffer(8));
    }
    createUploadTask() {
      return { uploadAsync: () => Promise.resolve({ status: 200, body: '' }) };
    }
  }
  class Directory {
    uri: string;
    exists = true;
    size = 2048;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    create() {}
    delete() {}
    list() {
      return [];
    }
  }
  return {
    File,
    Directory,
    Paths: {
      document: new Directory('file:///documentos'),
      cache: new Directory('file:///cache'),
      availableDiskSpace: 500 * 1024 * 1024,
      totalDiskSpace: 1024 * 1024 * 1024,
    },
    UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
  };
});

// Compressão de imagem: devolve um JPEG "reduzido" fixo
jest.mock('expo-image-manipulator', () => {
  const contexto: { resize: jest.Mock; renderAsync: jest.Mock } = {
    resize: jest.fn(() => contexto),
    renderAsync: jest.fn(() =>
      Promise.resolve({
        saveAsync: jest.fn(() =>
          Promise.resolve({ uri: 'file:///comprimida.jpg', width: 1080, height: 810 }),
        ),
      }),
    ),
  };
  return {
    ImageManipulator: { manipulate: jest.fn(() => contexto) },
    SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  };
});

// Galeria: cada teste diz o que a pessoa "escolheu"
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  MediaTypeOptions: { All: 'All', Images: 'Images', Videos: 'Videos' },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}`,
}));

// Roteador: navegação simulada
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
  };
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    useGlobalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    usePathname: jest.fn(() => '/'),
    useFocusEffect: jest.fn(),
    useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
    Redirect: () => null,
    Stack: Object.assign(() => null, { Screen: () => null }),
    Tabs: Object.assign(() => null, { Screen: () => null }),
  };
});

// Notificações: nada nativo no ambiente de teste
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[teste]' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('agendada')),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5 },
  AndroidNotificationPriority: { MAX: 'max' },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
  default: {
    executionEnvironment: 'standalone',
    easConfig: { projectId: 'projeto-teste' },
    expoConfig: { extra: { eas: { projectId: 'projeto-teste' } } },
  },
}));
