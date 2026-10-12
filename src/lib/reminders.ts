import { isRunningInExpoGo } from 'expo';
import * as CalendarLegacy from 'expo-calendar/legacy';
import { Alert, Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

/**
 * No Expo Go (Android, SDK 53+) só IMPORTAR expo-notifications já derruba a
 * tela. Carrega o módulo sob demanda e só fora do Expo Go: no APK e no build
 * de desenvolvimento funciona; no Expo Go o aviso simplesmente não é agendado.
 */
const IN_EXPO_GO = isRunningInExpoGo();
let cached: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web' || IN_EXPO_GO) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    cached = mod;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Lembretes da ação no próprio celular. Nada passa pelo servidor:
 *  - calendário: abre o formulário do sistema já preenchido (a pessoa salva);
 *  - aviso: notificação local 1h antes, agendada neste aparelho.
 * Push vindo do servidor (OneSignal) segue fora do escopo.
 */

type ActionLike = { id: string; title: string; scheduled_at: string; location_name?: string | null };

/** Pede permissão de notificação na hora em que ela faz sentido. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const Notifications = notifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('acoes', {
      name: 'Ações',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return asked.granted;
}

/** Agenda aviso 1h antes (ou no horário, se faltar menos de 1h). Devolve o id. */
export async function scheduleActionReminder(action: ActionLike): Promise<string | null> {
  const Notifications = notifications();
  if (!Notifications || !(await ensureNotificationPermission())) return null;
  const start = new Date(action.scheduled_at).getTime();
  const when = Math.max(start - 60 * 60 * 1000, Date.now() + 60 * 1000);
  if (when >= start) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ação daqui a pouco',
      body: `${action.title}${action.location_name ? ` · ${action.location_name}` : ''}`,
      data: { actionId: action.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(when), channelId: 'acoes' },
  });
}

/** Formulário do calendário do sistema, preenchido, com alarme 1h antes. */
export async function addActionToCalendar(action: ActionLike): Promise<void> {
  if (Platform.OS === 'web') {
    Alert.alert('Calendário', 'Disponível no app instalado.');
    return;
  }
  const start = new Date(action.scheduled_at);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  await CalendarLegacy.createEventInCalendarAsync({
    title: action.title,
    startDate: start,
    endDate: end,
    location: action.location_name ?? undefined,
    alarms: [{ relativeOffset: -60 }],
  });
}
