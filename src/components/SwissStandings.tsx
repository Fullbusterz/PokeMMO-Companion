import { Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { t } from '@/i18n';
import type { SwissStanding } from '@/lib/swissFormat';

// Shared by the organizer screen and the public join screen, so both sides of
// the tournament are always looking at the same table computed the same way.
export function SwissStandings({
  standings,
  nameById,
  highlightId,
}: {
  standings: SwissStanding[];
  nameById: Map<string, string>;
  highlightId?: string | null;
}) {
  return (
    <View className="mb-6">
      <Card skipEntrance className="overflow-hidden">
        <View className="flex-row items-center border-b border-ink-700 px-3 py-2">
          <Text className="flex-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {t('swiss.standingsTitle')}
          </Text>
          <Text className="w-8 text-center text-xs font-semibold text-ink-400">{t('swiss.played')}</Text>
          <Text className="w-8 text-center text-xs font-semibold text-ink-400">{t('swiss.wins')}</Text>
          <Text className="w-8 text-center text-xs font-semibold text-ink-400">{t('swiss.losses')}</Text>
          <Text className="w-10 text-center text-xs font-semibold text-ink-400">{t('swiss.buchholz')}</Text>
          <Text className="w-9 text-center text-xs font-semibold text-ink-400">{t('swiss.points')}</Text>
        </View>
        {standings.map((s, index) => {
          const isMe = highlightId === s.participantId;
          return (
            <View
              key={s.participantId}
              className={`flex-row items-center px-3 py-2 ${
                index < standings.length - 1 ? 'border-b border-ink-700' : ''
              } ${isMe ? 'bg-pokeRed/10' : ''}`}
            >
              <Text
                className={`flex-1 text-sm ${isMe ? 'font-bold text-pokeRed' : 'font-semibold text-ink-100'}`}
                numberOfLines={1}
              >
                {index + 1}. {nameById.get(s.participantId) ?? '?'}
                {s.byes > 0 ? ` · ${t('swiss.byeLabel')}` : ''}
              </Text>
              <Text className="w-8 text-center text-sm text-ink-300">{s.played}</Text>
              <Text className="w-8 text-center text-sm text-ink-300">{s.wins}</Text>
              <Text className="w-8 text-center text-sm text-ink-300">{s.losses}</Text>
              <Text className="w-10 text-center text-sm text-ink-400">{s.buchholz}</Text>
              <Text className="w-9 text-center text-sm font-bold text-ink-100">{s.points}</Text>
            </View>
          );
        })}
      </Card>
      <Text className="mt-2 text-xs text-ink-400">{t('swiss.tiebreakNote')}</Text>
    </View>
  );
}
