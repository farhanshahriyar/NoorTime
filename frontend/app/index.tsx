import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, {
  Circle,
  Path,
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
} from 'react-native-svg';

import { fetchDailyPrayerTimes, type DailyPrayerTimes } from '@/lib/aladhan-api';
import {
  formatTime12,
  getCountdown,
  getFastingInfo,
  getIslamicDate,
  getPrayerTimes,
  getSunPosition,
  type TimePeriod,
} from '@/lib/prayer-times';
import {
  loadFastingStreak,
  loadSettings,
  markFastingComplete,
  type SavedSettings,
} from '@/lib/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const APP_TIMEZONE = 'Asia/Dhaka';

function getDateKeyInTimezone(date: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

const SKY_PALETTES: Record<
  TimePeriod,
  {
    gradient: string[];
    textColor: string;
    subtextColor: string;
    cardBg: string;
    cardBorder: string;
    starsOpacity: number;
    hazeOpacity: number;
    hazeColor: string;
  }
> = {
  'night-early': {
    gradient: ['#040A1F', '#0A1B4A', '#121E5B', '#1E1E58'],
    textColor: '#FFFFFF',
    subtextColor: 'rgba(230,241,255,0.72)',
    cardBg: 'rgba(255,255,255,0.08)',
    cardBorder: 'rgba(255,255,255,0.16)',
    starsOpacity: 1,
    hazeOpacity: 0.1,
    hazeColor: '#6F8DFF',
  },
  dawn: {
    gradient: ['#23193F', '#533C82', '#855AA8', '#C5799A'],
    textColor: '#FFFFFF',
    subtextColor: 'rgba(245,236,255,0.78)',
    cardBg: 'rgba(255,255,255,0.12)',
    cardBorder: 'rgba(255,255,255,0.2)',
    starsOpacity: 0.35,
    hazeOpacity: 0.2,
    hazeColor: '#FFB67A',
  },
  morning: {
    gradient: ['#6692D6', '#7EA9E3', '#A7C2EF', '#CADAFB'],
    textColor: '#F9FCFF',
    subtextColor: 'rgba(235,246,255,0.82)',
    cardBg: 'rgba(255,255,255,0.2)',
    cardBorder: 'rgba(255,255,255,0.34)',
    starsOpacity: 0.06,
    hazeOpacity: 0.15,
    hazeColor: '#FFF0B6',
  },
  day: {
    gradient: ['#2F8BDF', '#52A8EB', '#75BDED', '#A5D9F5'],
    textColor: '#FFFFFF',
    subtextColor: 'rgba(233,247,255,0.85)',
    cardBg: 'rgba(255,255,255,0.24)',
    cardBorder: 'rgba(255,255,255,0.36)',
    starsOpacity: 0,
    hazeOpacity: 0.1,
    hazeColor: '#FFF5C4',
  },
  sunset: {
    gradient: ['#572C72', '#8E477F', '#B96882', '#CE8B66'],
    textColor: '#FFFFFF',
    subtextColor: 'rgba(255,235,236,0.78)',
    cardBg: 'rgba(28,15,40,0.2)',
    cardBorder: 'rgba(255,255,255,0.2)',
    starsOpacity: 0.15,
    hazeOpacity: 0.26,
    hazeColor: '#FFA65C',
  },
  night: {
    gradient: ['#130A2E', '#271154', '#352064', '#41276E'],
    textColor: '#FFFFFF',
    subtextColor: 'rgba(235,227,255,0.72)',
    cardBg: 'rgba(255,255,255,0.08)',
    cardBorder: 'rgba(255,255,255,0.16)',
    starsOpacity: 0.9,
    hazeOpacity: 0.14,
    hazeColor: '#7A79FF',
  },
};

type SkyTheme = {
  period: TimePeriod;
  gradient: string[];
  textColor: string;
  subtextColor: string;
  cardBg: string;
  cardBorder: string;
  starsOpacity: number;
  hazeOpacity: number;
  hazeColor: string;
};

function getSkyTheme(now: Date, prayerTimes: ReturnType<typeof getPrayerTimes>): SkyTheme {
  const t = now.getTime();
  const fajr = prayerTimes.fajr.getTime();
  const sunrise = prayerTimes.sunrise.getTime();
  const dhuhr = prayerTimes.dhuhr.getTime();
  const asr = prayerTimes.asr.getTime();
  const maghrib = prayerTimes.maghrib.getTime();
  const isha = prayerTimes.isha.getTime();

  const dawnStart = fajr - 45 * 60_000;
  const morningStart = sunrise;
  const dayStart = dhuhr;
  const sunsetStart = asr + 30 * 60_000;
  const nightStart = isha;

  if (t < dawnStart) return finalizeTheme('night-early', 0);
  if (t < morningStart)
    return finalizeTheme('dawn', transitionProgress(t, dawnStart, morningStart));
  if (t < dayStart) return finalizeTheme('morning', transitionProgress(t, morningStart, dayStart));
  if (t < sunsetStart) return finalizeTheme('day', transitionProgress(t, dayStart, sunsetStart));
  if (t < nightStart)
    return finalizeTheme('sunset', transitionProgress(t, sunsetStart, nightStart));
  if (t < maghrib + 3 * 60 * 60_000) {
    return finalizeTheme('night', transitionProgress(t, nightStart, maghrib + 3 * 60 * 60_000));
  }
  return finalizeTheme('night-early', 0);
}

function finalizeTheme(period: TimePeriod, drift: number): SkyTheme {
  const base = SKY_PALETTES[period];
  const nextPeriod =
    period === 'night-early' ? 'dawn' : period === 'night' ? 'night-early' : nextPhase(period);
  const next = SKY_PALETTES[nextPeriod];
  const blend = Math.max(0, Math.min(0.35, drift * 0.22));

  return {
    period,
    gradient: base.gradient.map((c, i) => blendHex(c, next.gradient[i], blend)),
    textColor: blendHex(base.textColor, next.textColor, blend * 0.6),
    subtextColor: blendRgba(base.subtextColor, next.subtextColor, blend * 0.5),
    cardBg: blendRgba(base.cardBg, next.cardBg, blend * 0.6),
    cardBorder: blendRgba(base.cardBorder, next.cardBorder, blend * 0.6),
    starsOpacity: mixNumber(base.starsOpacity, next.starsOpacity, blend),
    hazeOpacity: mixNumber(base.hazeOpacity, next.hazeOpacity, blend),
    hazeColor: blendHex(base.hazeColor, next.hazeColor, blend),
  };
}

function nextPhase(period: TimePeriod): TimePeriod {
  if (period === 'dawn') return 'morning';
  if (period === 'morning') return 'day';
  if (period === 'day') return 'sunset';
  if (period === 'sunset') return 'night';
  return 'night';
}

function transitionProgress(nowMs: number, startMs: number, endMs: number): number {
  if (endMs <= startMs) return 0;
  return Math.max(0, Math.min(1, (nowMs - startMs) / (endMs - startMs)));
}

function mixNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function blendHex(from: string, to: string, t: number): string {
  const f = hexToRgb(from);
  const s = hexToRgb(to);
  const r = Math.round(mixNumber(f.r, s.r, t));
  const g = Math.round(mixNumber(f.g, s.g, t));
  const b = Math.round(mixNumber(f.b, s.b, t));
  return `rgb(${r},${g},${b})`;
}

function blendRgba(from: string, to: string, t: number): string {
  const a = rgbaToObj(from);
  const b = rgbaToObj(to);
  const r = Math.round(mixNumber(a.r, b.r, t));
  const g = Math.round(mixNumber(a.g, b.g, t));
  const bCh = Math.round(mixNumber(a.b, b.b, t));
  const alpha = mixNumber(a.a, b.a, t);
  return `rgba(${r},${g},${bCh},${alpha.toFixed(3)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbaToObj(color: string): { r: number; g: number; b: number; a: number } {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return { r: 255, g: 255, b: 255, a: 1 };
  const parts = match[1].split(',').map((p) => p.trim());
  return {
    r: parseFloat(parts[0] || '255'),
    g: parseFloat(parts[1] || '255'),
    b: parseFloat(parts[2] || '255'),
    a: parseFloat(parts[3] || '1'),
  };
}

export default function RamadanScreen() {
  const [now, setNow] = React.useState(new Date());
  const [settings, setSettings] = React.useState<SavedSettings | null>(null);
  const [dailyTimes, setDailyTimes] = React.useState<DailyPrayerTimes | null>(null);
  const [streakCount, setStreakCount] = React.useState(0);
  const [markedToday, setMarkedToday] = React.useState(false);
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [simulationNow, setSimulationNow] = React.useState<Date | null>(null);
  const [simulationWindow, setSimulationWindow] = React.useState<{
    fajr: Date;
    maghrib: Date;
    startRealMs: number;
  } | null>(null);
  const [simulationProgress, setSimulationProgress] = React.useState(0);
  const simulationRafRef = React.useRef<number | null>(null);

  // Reload settings every time the screen comes into focus (e.g. returning from settings)
  useFocusEffect(
    React.useCallback(() => {
      loadSettings().then(setSettings);
      loadFastingStreak().then((s) => {
        setStreakCount(s.count);
        const todayKey = getDateKeyInTimezone(new Date());
        setMarkedToday(s.lastCompletedDate === todayKey);
      });
    }, [])
  );

  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const todayKey = getDateKeyInTimezone(now);

  React.useEffect(() => {
    let active = true;
    async function loadDailyTimes() {
      if (!settings) {
        setDailyTimes(null);
        return;
      }
      try {
        const data = await fetchDailyPrayerTimes(settings.lat, settings.lng, new Date());
        if (active) setDailyTimes(data);
      } catch {
        if (active) setDailyTimes(null);
      }
    }
    loadDailyTimes();
    return () => {
      active = false;
    };
  }, [settings, todayKey]);

  const prayerTimesOverride = React.useMemo(() => {
    if (!dailyTimes) return undefined;
    return {
      fajr: parseTimeOnDate(dailyTimes.fajr, now),
      sunrise: parseTimeOnDate(dailyTimes.sunrise, now),
      dhuhr: parseTimeOnDate(dailyTimes.dhuhr, now),
      asr: parseTimeOnDate(dailyTimes.asr, now),
      maghrib: parseTimeOnDate(dailyTimes.maghrib, now),
      isha: parseTimeOnDate(dailyTimes.isha, now),
    };
  }, [dailyTimes, now]);

  const timetable = settings?.timetable;
  const displayNow = isSimulating && simulationNow ? simulationNow : now;
  const prayerTimes = getPrayerTimes(displayNow, timetable, prayerTimesOverride);
  const skyTheme = getSkyTheme(displayNow, prayerTimes);
  const timePeriod = skyTheme.period;
  const fastingInfo = getFastingInfo(displayNow, timetable, prayerTimesOverride);
  const countdown = getCountdown(fastingInfo.countdownTarget, displayNow);
  const liveSunPos = getSunPosition(displayNow, timetable, prayerTimesOverride);
  const sunPos = isSimulating ? simulationProgress : liveSunPos;
  const currentDisplayTime = formatTime12(displayNow);
  const islamicDate = getIslamicDate();
  const isDaytimeNow = timePeriod === 'morning' || timePeriod === 'day' || timePeriod === 'dawn';
  const isSunset = timePeriod === 'sunset';

  const textColor = skyTheme.textColor;
  const subtextColor = skyTheme.subtextColor;
  const glassCardBg = isDaytimeNow
    ? 'rgba(9,20,49,0.62)'
    : isSunset
      ? 'rgba(12,10,34,0.66)'
      : 'rgba(9,13,33,0.68)';
  const glassCardBorder = 'rgba(255,255,255,0.13)';
  const glassCardHighlight = 'rgba(255,255,255,0.06)';
  const cardShadowStyle = isDaytimeNow
    ? {
        shadowColor: '#020A1A',
        shadowOpacity: 0.16,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }
    : isSunset
      ? {
          shadowColor: '#0F0618',
          shadowOpacity: 0.18,
          shadowRadius: 9,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        }
      : {
          shadowColor: '#00040D',
          shadowOpacity: 0.2,
          shadowRadius: 9,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        };
  const markBtnBg = markedToday ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.035)';
  const markBtnBorder = markedToday ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.11)';

  const locationLabel = settings
    ? `${settings.districtBn} · ${settings.districtName}`
    : 'Set your location';

  async function handleMarkComplete() {
    const result = await markFastingComplete(new Date());
    setStreakCount(result.count);
    setMarkedToday(result.lastCompletedDate === getDateKeyInTimezone(new Date()));
  }

  function handleStartSimulation() {
    const times = getPrayerTimes(now, timetable, prayerTimesOverride);
    const fajr = times.fajr;
    const maghrib = times.maghrib;
    if (maghrib.getTime() <= fajr.getTime()) return;

    setSimulationNow(new Date(fajr));
    setSimulationWindow({
      fajr,
      maghrib,
      startRealMs: Date.now(),
    });
    setSimulationProgress(0);
    setIsSimulating(true);
  }

  function handleStopSimulation() {
    setIsSimulating(false);
    setSimulationNow(null);
    setSimulationWindow(null);
    setSimulationProgress(0);
  }

  React.useEffect(() => {
    if (!isSimulating || !simulationWindow) return;

    const SIMULATION_DURATION_MS = 60000;
    const fajrMs = simulationWindow.fajr.getTime();
    const maghribMs = simulationWindow.maghrib.getTime();
    const spanMs = maghribMs - fajrMs;
    const startMs = simulationWindow.startRealMs;

    const tick = () => {
      const elapsed = Date.now() - startMs;
      const progress = Math.min(1, elapsed / SIMULATION_DURATION_MS);
      const simulatedMs = fajrMs + spanMs * progress;
      setSimulationProgress(progress);
      setSimulationNow(new Date(simulatedMs));

      if (progress >= 1) {
        setSimulationProgress(1);
        setIsSimulating(false);
        setSimulationWindow(null);
        simulationRafRef.current = null;
        return;
      }

      simulationRafRef.current = requestAnimationFrame(tick);
    };

    simulationRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (simulationRafRef.current !== null) {
        cancelAnimationFrame(simulationRafRef.current);
        simulationRafRef.current = null;
      }
    };
  }, [isSimulating, simulationWindow]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={skyTheme.gradient as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <LinearGradient
        colors={[`rgba(255,255,255,${skyTheme.hazeOpacity * 0.08})`, 'rgba(255,255,255,0)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.75 }}
      />
      <LinearGradient
        colors={[`${skyTheme.hazeColor}33`, 'rgba(0,0,0,0)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0.25 }}
      />

      {/* Stars for night mode */}
      <StarsOverlay opacity={skyTheme.starsOpacity} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.qiblaBtn} onPress={() => router.push('./qibla')}>
          <Text style={[styles.qiblaIcon, { color: textColor }]}>{'🕋'}</Text>
          <Text style={[styles.qiblaText, { color: subtextColor }]}>Qibla</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.locationText, { color: subtextColor }]}>{locationLabel}</Text>
          <Text style={[styles.ramadanText, { color: textColor }]}>Ramadan 2026</Text>
          <Text style={[styles.islamicDate, { color: subtextColor }]}>{islamicDate}</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
          <Text style={{ color: subtextColor, fontSize: 22 }}>{'⚙️'}</Text>
        </TouchableOpacity>
      </View>

      {/* No-location banner */}
      {!settings && (
        <TouchableOpacity style={styles.setupBanner} onPress={() => router.push('/settings')}>
          <Text style={styles.setupBannerText}>
            {'📍 Tap to set your district for accurate times'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Sun/Moon Arc */}
      <View style={styles.arcContainer}>
        <SunMoonArc
          progress={sunPos}
          isDaytime={isDaytimeNow || isSunset}
          timePeriod={timePeriod}
        />
        <View style={styles.arcLabels}>
          <Text style={[styles.arcLabel, { color: subtextColor }]}>Fajr</Text>
          <Text style={[styles.arcLabel, { color: subtextColor }]}>Maghrib</Text>
        </View>
      </View>

      {/* Live current time */}
      <Text style={[styles.currentTime, { color: textColor }]}>{currentDisplayTime}</Text>

      {/* Countdown */}
      <View style={styles.countdownSection}>
        <Text style={[styles.countdownLabel, { color: subtextColor, letterSpacing: 3 }]}>
          {fastingInfo.label}
        </Text>
        <View style={styles.countdownRow}>
          <View style={styles.countdownUnit}>
            <Text style={[styles.countdownNumber, { color: textColor }]}>{countdown.h}</Text>
            <Text style={[styles.countdownUnitLabel, { color: subtextColor }]}>H</Text>
          </View>
          <Text style={[styles.countdownSeparator, { color: textColor }]}>:</Text>
          <View style={styles.countdownUnit}>
            <Text style={[styles.countdownNumber, { color: textColor }]}>{countdown.m}</Text>
            <Text style={[styles.countdownUnitLabel, { color: subtextColor }]}>M</Text>
          </View>
          <Text style={[styles.countdownSeparator, { color: textColor }]}>:</Text>
          <View style={styles.countdownUnit}>
            <Text style={[styles.countdownNumber, { color: textColor }]}>{countdown.s}</Text>
            <Text style={[styles.countdownUnitLabel, { color: subtextColor }]}>S</Text>
          </View>
        </View>
      </View>

      {/* Info Cards */}
      <View style={styles.cardsContainer}>
        {/* Suhoor / Iftar Card */}
        <View
          style={[
            styles.card,
            cardShadowStyle,
            {
              backgroundColor: glassCardBg,
              borderColor: glassCardBorder,
            },
          ]}>
          <View
            pointerEvents="none"
            style={[styles.cardHighlight, { borderColor: glassCardHighlight }]}
          />
          <View style={styles.cardRow}>
            <View>
              <Text style={[styles.cardLabel, { color: subtextColor }]}>Sehri ends</Text>
              <Text style={[styles.cardValue, { color: textColor }]}>
                {formatTime12(prayerTimes.fajr)}
              </Text>
            </View>
            <View style={styles.cardCenter}>
              <Text style={{ fontSize: 14 }}>{fastingInfo.isFasting ? '☀️' : '🌙'}</Text>
              <Text style={[styles.cardCenterText, { color: subtextColor }]}>
                {fastingInfo.isFasting ? fastingInfo.fastDuration : 'Not Fasting'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.cardLabel, { color: subtextColor }]}>Iftar at</Text>
              <Text style={[styles.cardValue, { color: textColor }]}>
                {formatTime12(prayerTimes.maghrib)}
              </Text>
            </View>
          </View>
        </View>

        {/* Fasting Streak Card */}
        <View
          style={[
            styles.card,
            cardShadowStyle,
            {
              backgroundColor: glassCardBg,
              borderColor: glassCardBorder,
            },
          ]}>
          <View
            pointerEvents="none"
            style={[styles.cardHighlight, { borderColor: glassCardHighlight }]}
          />
          <View style={styles.cardRow}>
            <View>
              <Text style={[styles.cardLabel, { color: subtextColor }]}>Fasting Streak</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 14 }}>{'🔥'}</Text>
                <Text style={[styles.cardValue, { color: textColor }]}>
                  {streakCount} day{streakCount === 1 ? '' : 's'}
                </Text>
                <Text style={{ color: subtextColor, fontSize: 14 }}>{'>'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.markBtn,
                {
                  borderColor: markBtnBorder,
                  backgroundColor: markBtnBg,
                  opacity: markedToday ? 0.66 : 1,
                },
              ]}
              onPress={handleMarkComplete}
              disabled={markedToday}>
              <Text style={[styles.markBtnIcon, { color: subtextColor }]}>
                {markedToday ? '✅' : '○'}
              </Text>
              <Text style={[styles.markBtnText, { color: subtextColor }]}>
                {markedToday ? 'Completed' : 'Mark Complete'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={[
            styles.prayerTimesBtn,
            {
              backgroundColor: isDaytimeNow ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)',
              borderColor: isDaytimeNow ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)',
            },
          ]}>
          <Text style={{ fontSize: 14 }}>{'🕌'}</Text>
          <Text style={[styles.btnText, { color: textColor }]}>Prayer Times</Text>
          <Text style={[styles.btnArrow, { color: textColor }]}>^</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsBottomBtn}
          onPress={isSimulating ? handleStopSimulation : handleStartSimulation}>
          <Text style={{ color: '#fff', fontSize: 14 }}>{isSimulating ? '[]' : '>'}</Text>
          <Text style={styles.settingsBottomText}>
            {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Stars overlay for nighttime
function StarsOverlay({ opacity }: { opacity: number }) {
  const stars = React.useMemo(() => {
    const result = [];
    for (let i = 0; i < 50; i++) {
      result.push({
        x: Math.random() * SCREEN_WIDTH,
        y: Math.random() * 400,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.7 + 0.3,
      });
    }
    return result;
  }, []);

  return (
    <Svg style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {stars.map((star, i) => (
        <Circle key={i} cx={star.x} cy={star.y} r={star.size} fill="white" opacity={star.opacity} />
      ))}
    </Svg>
  );
}

// Sun/Moon arc component
function SunMoonArc({
  progress,
  isDaytime,
  timePeriod,
}: {
  progress: number;
  isDaytime: boolean;
  timePeriod: TimePeriod;
}) {
  const arcWidth = SCREEN_WIDTH - 80;
  const arcHeight = 120;
  const centerX = arcWidth / 2;
  const radiusX = arcWidth / 2 - 10;
  const radiusY = arcHeight - 10;

  const angle = Math.PI * (1 - progress);
  const cx = centerX + radiusX * Math.cos(angle);
  const cy = arcHeight - radiusY * Math.sin(angle);

  const startX = centerX - radiusX;
  const endX = centerX + radiusX;
  const arcPath = `M ${startX} ${arcHeight} A ${radiusX} ${radiusY} 0 0 1 ${endX} ${arcHeight}`;

  const isNight = timePeriod === 'night' || timePeriod === 'night-early';
  const arcStroke = isDaytime
    ? 'rgba(255,200,50,0.4)'
    : isNight
      ? 'rgba(255,255,255,0.15)'
      : 'rgba(255,200,100,0.3)';

  const orbColor = isDaytime ? '#FFD700' : '#E8E8F0';
  const orbGlowColor = isDaytime ? 'rgba(255,215,0,0.4)' : 'rgba(200,200,255,0.3)';

  return (
    <Svg width={arcWidth} height={arcHeight + 20} viewBox={`0 0 ${arcWidth} ${arcHeight + 20}`}>
      <Defs>
        <SvgRadialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={orbGlowColor} stopOpacity="1" />
          <Stop offset="100%" stopColor={orbGlowColor} stopOpacity="0" />
        </SvgRadialGradient>
      </Defs>

      <Path d={arcPath} stroke={arcStroke} strokeWidth={1.5} fill="none" strokeDasharray="4,4" />

      <Circle cx={cx} cy={cy} r={20} fill="url(#orbGlow)" />
      <Circle cx={cx} cy={cy} r={isDaytime ? 10 : 8} fill={orbColor} />

      {!isDaytime && (
        <Circle cx={cx + 3} cy={cy - 2} r={6} fill={isNight ? '#1a1045' : '#2d1b69'} />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  qiblaBtn: {
    alignItems: 'center',
    width: 50,
  },
  qiblaIcon: { fontSize: 20 },
  qiblaText: { fontSize: 11, marginTop: 2 },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  locationText: { fontSize: 13, marginBottom: 2 },
  ramadanText: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  islamicDate: { fontSize: 13 },
  settingsBtn: { width: 50, alignItems: 'center', paddingTop: 4 },
  setupBanner: {
    backgroundColor: 'rgba(100,149,237,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(100,149,237,0.5)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    alignItems: 'center',
  },
  setupBannerText: {
    color: '#a8d8ff',
    fontSize: 13,
    fontWeight: '500',
  },
  arcContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 0,
  },
  arcLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: SCREEN_WIDTH - 100,
    marginTop: -5,
  },
  arcLabel: { fontSize: 12 },
  currentTime: {
    fontSize: 42,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 5,
    marginBottom: 10,
  },
  countdownSection: {
    alignItems: 'center',
    marginBottom: 25,
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  countdownUnit: { alignItems: 'center', minWidth: 70 },
  countdownNumber: {
    fontSize: 64,
    fontWeight: '200',
    lineHeight: 72,
    letterSpacing: 2,
  },
  countdownUnitLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: -2,
  },
  countdownSeparator: {
    fontSize: 52,
    fontWeight: '200',
    lineHeight: 66,
    marginHorizontal: 2,
  },
  cardsContainer: { gap: 10, marginBottom: 15 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  cardHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    opacity: 0.5,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: { fontSize: 11, marginBottom: 2 },
  cardValue: { fontSize: 17, fontWeight: '600' },
  cardCenter: { alignItems: 'center', gap: 2 },
  cardCenterText: { fontSize: 11 },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markBtnIcon: { fontSize: 16 },
  markBtnText: { fontSize: 12 },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 30,
  },
  prayerTimesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnText: { fontSize: 13, fontWeight: '500' },
  btnArrow: { fontSize: 12 },
  settingsBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(100,149,237,0.35)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(100,149,237,0.5)',
  },
  settingsBottomText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

function parseTimeOnDate(timeStr: string, date: Date): Date {
  const [hStr, mStr] = timeStr.split(':');
  const d = new Date(date);
  d.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
  return d;
}
