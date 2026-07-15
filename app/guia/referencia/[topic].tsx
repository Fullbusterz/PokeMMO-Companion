import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { nativeOnly } from '@/lib/animation';
import { prettifyItemName } from '@/lib/guideItemNames';
import {
  getReferenceGuide,
  type BreedingGuide,
  type DifferencesGuide,
  type EvTrainingGuide,
  type FindingEveryMoveGuide,
  type ProseGuide,
  type ProseSection,
  type QaEntry,
  type ReferenceTopic,
  type RoamingLegendariesGuide,
  type SmeargleGuide,
} from '@/lib/guides';

function Block({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  return (
    <Animated.View
      entering={nativeOnly(FadeInDown.delay(Math.min(index, 10) * 40).duration(240))}
      className="mb-3 rounded-xl border border-ink-600 bg-ink-800 p-4"
    >
      {children}
    </Animated.View>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">{children}</Text>;
}

function ProseSections({ sections }: { sections: ProseSection[] }) {
  return (
    <>
      {sections.map((s, i) => (
        <Block key={i} index={i}>
          {s.heading && <Text className="mb-2 text-base font-bold text-ink-100">{s.heading}</Text>}
          <View className="gap-2">
            {s.paragraphs.map((p, j) => (
              <Text key={j} className="text-sm leading-5 text-ink-300">
                {p}
              </Text>
            ))}
          </View>
        </Block>
      ))}
    </>
  );
}

function QaList({ qa }: { qa: QaEntry[] }) {
  return (
    <>
      {qa.map((item, i) => (
        <Block key={i} index={i}>
          <Text className="mb-1.5 text-sm font-bold text-pokeRed">{item.question}</Text>
          <Text className="text-sm leading-5 text-ink-300">{item.answer}</Text>
        </Block>
      ))}
    </>
  );
}

const STAT_LABELS: Record<string, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spAtk: 'Sp. Atk', spDef: 'Sp. Def', speed: 'Speed',
};

function EvTrainingBody({ data }: { data: EvTrainingGuide }) {
  return (
    <>
      {data.note && (
        <Block>
          <Text className="text-sm text-ink-300">{data.note}</Text>
        </Block>
      )}
      <SectionHeading>Mejores zonas</SectionHeading>
      {data.bestSpots.map((spot, i) => (
        <Block key={i} index={i}>
          <View className="mb-1 flex-row items-center gap-2">
            <View className="rounded-full bg-pokeRed/15 px-2 py-0.5">
              <Text className="text-xs font-bold text-pokeRed">{STAT_LABELS[spot.stat ?? ''] ?? spot.stat}</Text>
            </View>
            <Text className="flex-1 text-sm font-semibold text-ink-100">
              {spot.pokemon.map((p) => `${p.count}x ${p.pokemon} (${p.evs} EVs)`).join(', ')}
            </Text>
          </View>
          <Text className="text-xs text-ink-400">{spot.details}</Text>
        </Block>
      ))}

      <SectionHeading>Zonas para subir de nivel</SectionHeading>
      {data.levelingSpots.map((spot, i) => (
        <Block key={i} index={i}>
          <Text className="text-sm font-semibold text-ink-100">
            {spot.pokemon.map((p) => `${p.count}x ${p.pokemon}`).join(', ')}
          </Text>
          <Text className="mt-1 text-xs text-ink-400">{spot.details}</Text>
        </Block>
      ))}

      <SectionHeading>Zonas alternativas</SectionHeading>
      {data.alternativeSpots.map((spot, i) => (
        <Block key={i} index={i}>
          <View className="mb-1 flex-row items-center gap-2">
            <View className="rounded-full bg-pokeRed/15 px-2 py-0.5">
              <Text className="text-xs font-bold text-pokeRed">{STAT_LABELS[spot.stat ?? ''] ?? spot.stat}</Text>
            </View>
            <Text className="flex-1 text-sm font-semibold text-ink-100">
              {spot.pokemon.map((p) => `${p.count}x ${p.pokemon} (${p.evs} EVs)`).join(', ')}
            </Text>
          </View>
          <Text className="text-xs text-ink-400">{spot.details}</Text>
        </Block>
      ))}

      <SectionHeading>Bayas reductoras</SectionHeading>
      <Block>
        <View className="gap-1.5">
          {data.reducingBerries.map((b, i) => (
            <Text key={i} className="text-sm text-ink-300">
              <Text className="font-semibold text-ink-100">{b.berry}</Text> — {b.effect}
            </Text>
          ))}
        </View>
      </Block>
    </>
  );
}

function SmeargleBody({ data }: { data: SmeargleGuide }) {
  return (
    <>
      <Block>
        <Text className="text-sm leading-5 text-ink-300">{data.intro}</Text>
      </Block>
      <SectionHeading>Metodos</SectionHeading>
      {data.methods.map((m, i) => (
        <Block key={i} index={i}>
          <Text className="mb-2 text-base font-bold text-ink-100">{m.name}</Text>
          <View className="gap-1.5">
            {m.steps.map((s, j) => (
              <Text key={j} className="text-sm leading-5 text-ink-300">
                {j + 1}. {s}
              </Text>
            ))}
          </View>
          {m.note && <Text className="mt-2 text-xs italic text-ink-400">{m.note}</Text>}
        </Block>
      ))}
      {data.warning && (
        <Block>
          <Text className="text-sm font-semibold text-pokeRed">⚠️ {data.warning}</Text>
        </Block>
      )}
      <SectionHeading>Preguntas frecuentes</SectionHeading>
      <QaList qa={data.faq} />
      <SectionHeading>Pokemon con movimientos clave</SectionHeading>
      <Block>
        <View className="gap-2">
          {data.pokemonWithKeyMoves.map((entry, i) => (
            <Text key={i} className="text-sm text-ink-300">
              <Text className="font-semibold text-ink-100">{entry.move}</Text>: {entry.pokemon.join(', ')}
            </Text>
          ))}
        </View>
      </Block>
    </>
  );
}

function FindingMovesBody({ data }: { data: FindingEveryMoveGuide }) {
  return (
    <>
      {data.note && (
        <Block>
          <Text className="text-sm text-ink-300">{data.note}</Text>
        </Block>
      )}
      <SectionHeading>TMs en tiendas (todas las regiones)</SectionHeading>
      {data.tmMarketLocations.map((entry, i) => (
        <Block key={i} index={i}>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-ink-100">{entry.move}</Text>
            <Text className="text-xs font-bold text-pokeRed">{entry.price}</Text>
          </View>
          <Text className="mt-1 text-xs text-ink-400">{entry.locations.join(' / ')}</Text>
        </Block>
      ))}

      <SectionHeading>Tutores de shards</SectionHeading>
      {data.shardTutors.map((shard, i) => (
        <Block key={i} index={i}>
          <Text className="mb-1 text-base font-bold capitalize text-ink-100">{shard.color} shard</Text>
          {shard.tutorLocations.map((loc, j) => (
            <Text key={j} className="text-xs text-ink-400">
              📍 {loc}
            </Text>
          ))}
          {shard.shardLocation && (
            <Text className="mt-1 text-xs text-ink-400">Shard: {shard.shardLocation}</Text>
          )}
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {shard.moves.map((mv, j) => (
              <View key={j} className="rounded-full border border-ink-600 bg-ink-700 px-2.5 py-1">
                <Text className="text-xs font-semibold text-ink-100">
                  {mv.move} · {mv.cost}
                </Text>
              </View>
            ))}
          </View>
        </Block>
      ))}

      {(['kanto', 'hoenn', 'sinnoh', 'unova'] as const).map((region) => (
        <View key={region}>
          <SectionHeading>Tutores de movimiento — {REGION_LABELS[region]}</SectionHeading>
          {data.moveTutorsByRegion[region].map((entry, i) => (
            <Block key={i} index={i}>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-ink-100">{entry.move}</Text>
                <Text className="text-xs font-bold text-pokeRed">{entry.cost}</Text>
              </View>
              <Text className="mt-1 text-xs text-ink-400">{entry.description}</Text>
            </Block>
          ))}
        </View>
      ))}

      <SectionHeading>Battle Frontier</SectionHeading>
      <Block>
        <Text className="text-sm text-ink-300">{data.battleFrontier.note}</Text>
        <Text className="mt-1 text-xs text-ink-400">📍 {data.battleFrontier.location}</Text>
      </Block>
      {data.battleFrontier.tutors.map((tutor, i) => (
        <Block key={i} index={i}>
          <Text className="mb-1 text-base font-bold capitalize text-ink-100">
            Tutor de la {tutor.side === 'left' ? 'izquierda' : 'derecha'}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {tutor.moves.map((mv, j) => (
              <View key={j} className="rounded-full border border-ink-600 bg-ink-700 px-2.5 py-1">
                <Text className="text-xs font-semibold text-ink-100">
                  {mv.move} · {mv.cost}
                </Text>
              </View>
            ))}
          </View>
        </Block>
      ))}

      <SectionHeading>Movimientos definitivos (Ultimate Moves)</SectionHeading>
      <Block>
        {data.ultimateMoves.locations.map((loc, i) => (
          <Text key={i} className="text-xs text-ink-400">
            📍 {loc}
          </Text>
        ))}
      </Block>
      {data.ultimateMoves.moves.map((entry, i) => (
        <Block key={i} index={i}>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-ink-100">{entry.move}</Text>
            <Text className="text-xs font-bold text-pokeRed">{entry.cost}</Text>
          </View>
          <Text className="mt-1 text-xs text-ink-400">{entry.requirement}</Text>
        </Block>
      ))}
    </>
  );
}

function BreedingBody({ data }: { data: BreedingGuide }) {
  return (
    <>
      {data.note && (
        <Block>
          <Text className="text-sm font-semibold text-pokeRed">⚠️ {data.note}</Text>
        </Block>
      )}

      <SectionHeading>Mecánicas</SectionHeading>
      {data.mechanics.map((m, i) => (
        <Block key={i} index={i}>
          <Text className="mb-1 text-sm font-semibold text-ink-100">{m.title}</Text>
          <Text className="text-sm leading-5 text-ink-300">{m.description}</Text>
        </Block>
      ))}

      <SectionHeading>Coste de elegir sexo del huevo</SectionHeading>
      <Block>
        {data.genderSelectionCosts.map((row, i) => (
          <View key={i} className={`flex-row items-center justify-between ${i > 0 ? 'mt-2' : ''}`}>
            <Text className="text-sm text-ink-300">{row.femaleChancePercent}% hembra (natural)</Text>
            <Text className="text-xs text-ink-400">
              ♂ <Text className="text-ink-200">{row.costMale}</Text> · ♀ <Text className="text-ink-200">{row.costFemale}</Text>
            </Text>
          </View>
        ))}
      </Block>

      <SectionHeading>Cría con Pokémon shiny</SectionHeading>
      <Block>
        <Text className="mb-2 text-sm leading-5 text-ink-300">{data.shinyBreeding.intro}</Text>
        <Text className="mb-2 text-sm leading-5 text-ink-300">{data.shinyBreeding.ivFormula}</Text>
        <Text className="text-sm leading-5 text-ink-300">{data.shinyBreeding.otTransfer}</Text>
      </Block>

      <SectionHeading>Coste aproximado por objetivo de IVs</SectionHeading>
      <Block>
        <Text className="mb-2 text-xs italic text-ink-400">{data.costTable.note}</Text>
        {data.costTable.rows.map((row, i) => (
          <View key={i} className={`flex-row items-center justify-between ${i > 0 ? 'mt-2' : ''}`}>
            <Text className="text-sm text-ink-300">{row.target}</Text>
            <Text className="text-sm font-semibold text-ink-100">{row.cost}</Text>
          </View>
        ))}
      </Block>
    </>
  );
}

function DifferencesBody({ data }: { data: DifferencesGuide }) {
  return (
    <>
      {data.note && (
        <Block>
          <Text className="text-sm font-semibold text-pokeRed">⚠️ {data.note}</Text>
        </Block>
      )}
      <Block>
        <Text className="text-xs italic text-ink-400">{data.scopeNote}</Text>
      </Block>
      {data.items.map((item, i) => (
        <Block key={i} index={i}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="flex-1 text-base font-bold text-ink-100">{item.nameEs}</Text>
            <Text className="text-xs text-ink-400">{item.nameEn}</Text>
          </View>
          <View className="mb-2 rounded-full self-start bg-pokeRed/15 px-2 py-0.5">
            <Text className="text-xs font-semibold text-pokeRed">{item.differenceType}</Text>
          </View>
          <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {t('guide.pokemmoEffectLabel')}
          </Text>
          <Text className="mb-2 text-sm leading-5 text-ink-300">{item.pokemmoEffect}</Text>
          <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {t('guide.officialEffectLabel')}
          </Text>
          <Text className="text-sm leading-5 text-ink-300">{item.officialEffect}</Text>
          <Text className="mt-2 text-xs text-ink-500">
            {t('guide.confidenceLabel')}: {item.confidence}
          </Text>
        </Block>
      ))}
    </>
  );
}

const REGION_LABELS: Record<'kanto' | 'hoenn' | 'sinnoh' | 'unova', string> = {
  kanto: 'Kanto',
  hoenn: 'Hoenn',
  sinnoh: 'Sinnoh',
  unova: 'Teselia',
};

export default function ReferenceGuide() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const topicId = topic as ReferenceTopic;
  const data = getReferenceGuide(topicId);

  if (!data) {
    return (
      <Screen>
        <Header title={t('guide.title')} backHref="/guia" />
        <Text className="text-ink-400">{t('guide.comingSoon')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t(`guide.topics.${topicId}`)} backHref="/guia" />

      {topicId === 'ev-training' && <EvTrainingBody data={data as EvTrainingGuide} />}
      {topicId === 'smeargle-sketch' && <SmeargleBody data={data as SmeargleGuide} />}
      {topicId === 'finding-every-move' && <FindingMovesBody data={data as FindingEveryMoveGuide} />}
      {topicId === 'breeding' && <BreedingBody data={data as BreedingGuide} />}
      {topicId === 'differences' && <DifferencesBody data={data as DifferencesGuide} />}
      {topicId === 'roaming-legendaries' && <QaList qa={(data as RoamingLegendariesGuide).qa} />}
      {(topicId === 'ivs' ||
        topicId === 'effort-values' ||
        topicId === 'damage-calculator' ||
        topicId === 'building-competitive-teams' ||
        topicId === 'general-mechanics') && (
        <>
          {(data as ProseGuide).note && (
            <Block>
              <Text className="text-sm text-ink-300">{(data as ProseGuide).note}</Text>
            </Block>
          )}
          <ProseSections sections={(data as ProseGuide).sections} />
        </>
      )}

      <Text className="mb-6 mt-2 text-xs leading-4 text-ink-400">
        {t('guide.sourceLabel')}: {data.source}
      </Text>
    </Screen>
  );
}
