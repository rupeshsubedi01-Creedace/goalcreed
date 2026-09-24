/**
 * SETTINGS — BYO free API keys, poll cadence, haptics kill-switch and a
 * live meter of today's API-Football requests (the free plan is 100/day,
 * so this number matters). Inputs autosave on blur with a success haptic;
 * the "Test connection" chip round-trips /status.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Switch, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Header } from '@/components/Header';
import { PressableScale } from '@/components/PressableScale';
import { colors, font, radius, spacing } from '@/theme';
import { useSettings } from '@/lib/useSettings';
import { getTodayCount, clearAllCache } from '@/api/client';
import { pingStatus } from '@/api/apifootball';
import { isHapticsEnabled } from '@/lib/haptics';
import * as haptics from '@/lib/haptics';

const FREE_DAILY_LIMIT = 100;
const POLL_CHOICES = [30, 60, 90, 120, 300];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();

  const [apiKey, setApiKey] = useState(settings.apiFootballKey);
  const [sdbKey, setSdbKey] = useState(settings.sportsDbKey);
  const [test, setTest] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'bad'; msg: string }>({ kind: 'idle', msg: '' });

  const saveKey = async () => {
    const trimmed = apiKey.trim();
    await update({ apiFootballKey: trimmed });
    haptics.success();
  };

  const runTest = async () => {
    await update({ apiFootballKey: apiKey.trim() });
    setTest({ kind: 'busy', msg: 'Contacting api-sports.io…' });
    haptics.tap();
    try {
      const r = await pingStatus();
      setTest({
        kind: 'ok',
        msg: r.calls != null ? `Key verified. Today's usage: ${r.calls}/${FREE_DAILY_LIMIT}.` : 'Key verified.',
      });
      haptics.success();
    } catch (e) {
      setTest({ kind: 'bad', msg: e instanceof Error ? e.message : 'Test failed.' });
      haptics.error();
    }
  };

  const used = getTodayCount();
  const pct = Math.min(1, used / FREE_DAILY_LIMIT);

  return (
    <View style={styles.screen}>
      <Header title="Settings" meta={<Text style={styles.sub}>Data sources, feedback & budget</Text>} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 90, gap: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          {/* ---------------- API-Football ---------------- */}
          <Card icon="pulse-outline" tint={colors.live} title="Live scores · stats · timeline" badge="api-sports.io">
            <Text style={styles.body}>
              Powers everything live: fixtures?live=all for the scoreboard, /fixtures/events for goals,
              /statistics and /lineups for detail. Free individual plan ≈ {FREE_DAILY_LIMIT} requests/day.
            </Text>
            <Label text="API key" hint="dashboard.api-football.com → Profile → API" />
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit
              placeholder="paste your 32-char key"
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.pitch}
              onBlur={saveKey}
              testID="input-api-key"
            />
            <View style={styles.btnRow}>
              <ChipBtn label={test.kind === 'busy' ? 'Testing…' : 'Test connection'} tone="blue" onPress={runTest} disabled={test.kind === 'busy'} />
              <ChipBtn label="Get a free key" tone="ghost" onPress={() => Linking.openURL('https://dashboard.api-football.com/register')} />
            </View>
            {test.kind !== 'idle' && (
              <View style={[styles.testBanner, testBannerTone(test.kind)]}>
                <Ionicons
                  name={test.kind === 'ok' ? 'checkmark-circle' : test.kind === 'bad' ? 'alert-circle' : 'sync'}
                  size={15}
                  color={test.kind === 'ok' ? colors.pitch : test.kind === 'bad' ? colors.danger : colors.blue}
                />
                <Text style={styles.testText}>{test.msg}</Text>
              </View>
            )}
          </Card>

          {/* ---------------- TheSportsDB ---------------- */}
          <Card icon="shield-checkmark-outline" tint={colors.blue} title="Crests & league emblems" badge="thesportsdb.com">
            <Text style={styles.body}>
              High-quality transparent club badges and competition emblems, cached ~30 days. The public
              demo key works fine; register for your own if you hammer it.
            </Text>
            <Label text="TheSportsDB key" hint='free public key is "3"' />
            <TextInput
              style={styles.input}
              value={sdbKey}
              onChangeText={setSdbKey}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="3"
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.blue}
              onBlur={async () => {
                await update({ sportsDbKey: sdbKey.trim() || '3' });
                haptics.success();
              }}
              testID="input-sdb-key"
            />
          </Card>

          {/* ---------------- Cadence & feel ---------------- */}
          <Card icon="time-outline" tint={colors.amber} title="Cadence & feel">
            <Label text="Live refresh interval" hint="each poll = 1 request — mind the daily budget" />
            <View style={styles.pillRow}>
              {POLL_CHOICES.map((s) => {
                const sel = settings.pollSec === s;
                return (
                  <PressableScale
                    key={s}
                    feel="tick"
                    radiusPx={radius.pill}
                    style={[styles.pill, sel && styles.pillSel]}
                    onPress={async () => {
                      await update({ pollSec: s });
                    }}
                  >
                    <Text style={[styles.pillText, sel && styles.pillTextSel]}>{s}s</Text>
                  </PressableScale>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Haptic feedback</Text>
                <Text style={styles.body}>Press ticks, detents and the goal-alert pattern.</Text>
              </View>
              <Switch
                value={settings.hapticsOn}
                onValueChange={(v) => {
                  update({ hapticsOn: v });
                  if (v) haptics.goal();
                  else if (isHapticsEnabled()) haptics.soft();
                }}
                trackColor={{ true: colors.pitch + '88', false: colors.stroke }}
                thumbColor={settings.hapticsOn ? colors.pitch : colors.textFaint}
              />
            </View>
          </Card>

          {/* ---------------- Budget ---------------- */}
          <Card icon="speedometer-outline" tint={pct > 0.85 ? colors.danger : colors.pitch} title="Today's request budget">
            <View style={styles.meterTrack}>
              <View style={[styles.meterFill, { width: `${pct * 100}%`, backgroundColor: pct > 0.85 ? colors.danger : colors.pitch }]} />
            </View>
            <Text style={styles.body}>
              {used} / {FREE_DAILY_LIMIT} requests today ({Math.round(pct * 100)}%). Cached data is free —
              the app leans on AsyncStorage aggressively.
            </Text>
            <View style={styles.btnRow}>
              <ChipBtn
                label="Clear local cache"
                tone="danger"
                onPress={async () => {
                  haptics.warning();
                  await clearAllCache();
                }}
              />
            </View>
          </Card>

          <Text style={styles.footnote}>
            GoalCreed · data by api-football.com & thesportsdb.com · built phone-first, in the cloud.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function testBannerTone(kind: 'idle' | 'busy' | 'ok' | 'bad') {
  if (kind === 'ok') return { borderColor: colors.pitch + '55', backgroundColor: colors.pitchDim };
  if (kind === 'bad') return { borderColor: colors.danger + '55', backgroundColor: 'rgba(255,92,92,0.12)' };
  return { borderColor: colors.blue + '55', backgroundColor: colors.blueDim };
}

function Card({
  icon,
  tint,
  title,
  badge,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.iconBox, { backgroundColor: tint + '1f' }]}>
          <Ionicons name={icon} size={17} color={tint} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text style={styles.label}>{text}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function ChipBtn({
  label,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  tone: 'blue' | 'ghost' | 'danger';
  onPress: () => void;
  disabled?: boolean;
}) {
  const bg = tone === 'blue' ? colors.blueDim : tone === 'danger' ? 'rgba(255,92,92,0.12)' : colors.strokeSoft;
  const fg = tone === 'blue' ? colors.blue : tone === 'danger' ? colors.danger : colors.textDim;
  return (
    <PressableScale feel="soft" radiusPx={radius.pill} disabled={disabled} onPress={onPress} style={[styles.chipBtn, { backgroundColor: bg }]}>
      <Text style={[styles.chipBtnText, { color: fg, opacity: disabled ? 0.6 : 1 }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  sub: { color: colors.textDim, fontSize: font.small, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: font.h3, fontWeight: '800', flex: 1 },
  badge: { color: colors.textFaint, fontSize: font.tiny + 1, fontWeight: '700' },
  body: { color: colors.textDim, fontSize: font.small, lineHeight: 18 },
  label: { color: colors.text, fontSize: font.small, fontWeight: '800', letterSpacing: 0.3 },
  hint: { color: colors.textFaint, fontSize: font.tiny + 1, marginTop: 1 },
  input: {
    marginTop: 6,
    backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600',
  },
  btnRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  chipBtn: { paddingHorizontal: spacing.md + 2, paddingVertical: 8, borderRadius: radius.pill },
  chipBtnText: { fontSize: font.small, fontWeight: '800' },
  testBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  testText: { color: colors.text, fontSize: font.small, fontWeight: '600', flex: 1 },
  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: 4 },
  pill: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 7,
    backgroundColor: colors.strokeSoft,
    borderColor: colors.stroke,
  },
  pillSel: { backgroundColor: colors.pitchDim, borderColor: colors.pitch + '66' },
  pillText: { color: colors.textDim, fontSize: font.small, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pillTextSel: { color: colors.pitch },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  switchTitle: { color: colors.text, fontSize: font.body + 1, fontWeight: '800' },
  meterTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.strokeSoft, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: '100%', borderRadius: radius.pill },
  footnote: { color: colors.textFaint, fontSize: font.tiny + 1, textAlign: 'center', marginTop: spacing.sm },
});
