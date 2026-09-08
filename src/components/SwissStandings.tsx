import { Text, useWindowDimensions, View } from 'react-native';

import { Card } from '@/components/Card';
import { t } from '@/i18n';
import type { SwissStanding } from '@/lib/swissFormat';
import { transition } from '@/lib/webMotion';

// Shared by the organizer screen and the public join screen, so both sides of
// the tournament are always looking at the same table computed the same way.

// Below this the five numeric columns stop fitting next to a name of any real
// length, so Buchholz — the one a casual player never reads — steps out. It is
// still the tiebreak doing the work, it just isn't worth a column on a small
// phone.
const NARROW_BREAKPOINT = 400;

function RankBadge({ position, isMe }: { position: number; isMe: boolean }) {
  // Only the podium gets colour. Numbering every row in gold would make the
  // table look like a list of trophies rather than a standing.
  const podium =
    position === 1
      ? 'border-gold bg-gold/20 text-gold'
      : position === 2
        ? 'border-ink-400 bg-ink-700 text-ink-100'
        : position === 3
          ? 'border-pokeRed/50 bg-pokeRed/10 text-pokeRed'
          : 'border-transparent bg-transparent text-ink-400';

  return (
    <View className={`mr-2 h-6 w-6 items-center justify-center rounded-full border ${podium}`}>
      <Text
        className={`text-xs font-bold ${
          position === 1
            ? 'text-gold'
            : position === 2
              ? 'text-ink-100'
              : position === 3
                ? 'text-pokeRed'
                : isMe
                  ? 'text-ink-100'
                  : 'text-ink-400'
        }`}
      >
        {position}
      </Text>
    </View>
  );
}

export function SwissStandings({
  standings,
  nameById,
  highlightId,
}: {
  standings: SwissStanding[];
  nameById: Map<string, string>;
  highlightId?: string | null;
}) {
  const { width } = useWindowDimensions();
  const isNarrow = width < NARROW_BREAKPOINT;

  return (
    <View className="mb-6">
      <Card skipEntrance className="overflow-hidden">
        <View className="flex-row items-center border-b border-ink-700 bg-ink-900/40 px-3 py-2">
          <Text className="flex-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {t('swiss.standingsTitle')}
          </Text>
          <Text className="w-8 text-center text-[11px] font-semibold text-ink-400">{t('swiss.played')}</Text>
          <Text className="w-8 text-center text-[11px] font-semibold text-ink-400">{t('swiss.wins')}</Text>
          <Text className="w-8 text-center text-[11px] font-semibold text-ink-400">{t('swiss.losses')}</Text>
          {!isNarrow && (
            <Text className="w-10 text-center text-[11px] font-semibold text-ink-400">{t('swiss.buchholz')}</Text>
          )}
          <Text className="w-10 text-right text-[11px] font-semibold text-gold">{t('swiss.points')}</Text>
        </View>

        {standings.map((s, index) => {
          const isMe = highlightId === s.participantId;
          const position = index + 1;
          return (
            <View
              key={s.participantId}
              className={`flex-row items-center px-3 py-2.5 ${
                index < standings.length - 1 ? 'border-b border-ink-700/60' : ''
              } ${isMe ? 'bg-pokeRed/10' : position <= 3 ? 'bg-gold/[0.03]' : ''}`}
              style={transition(['background-color'])}
            >
              <RankBadge position={position} isMe={isMe} />
              <View className="flex-1 pr-2">
                <Text
                  className={`text-sm ${isMe ? 'font-bold text-pokeRed' : 'font-semibold text-ink-100'}`}
                  numberOfLines={1}
                >
                  {nameById.get(s.participantId) ?? '?'}
                </Text>
                {s.byes > 0 && (
                  <Text className="text-[10px] uppercase tracking-wide text-ink-400">{t('swiss.byeLabel')}</Text>
                )}
              </View>
              <Text className="w-8 text-center text-sm text-ink-300">{s.played}</Text>
              <Text className="w-8 text-center text-sm text-ink-300">{s.wins}</Text>
              <Text className="w-8 text-center text-sm text-ink-300">{s.losses}</Text>
              {!isNarrow && <Text className="w-10 text-center text-sm text-ink-400">{s.buchholz}</Text>}
              <Text className="w-10 text-right text-base font-bold text-ink-100">{s.points}</Text>
            </View>
          );
        })}
      </Card>
      <Text className="mt-2 text-xs leading-4 text-ink-400">{t('swiss.tiebreakNote')}</Text>
    </View>
  );
}
