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
  getTimePeriod,
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

// Background gradients for different times of day
const GRADIENTS: Record<TimePeriod, string[]> = {
  'night-early': ['#0a0a2e', '#1a1045', '#2d1b69', '#1a1045'],
  dawn: ['#1a1045', '#2d1b69', '#4a2c8a', '#6b3fa0'],
  morning: ['#4a90d9', '#6bb3f0', '#87ceeb', '#b0d4f1'],
  day: ['#3a7bd5', '#5b9ce0', '#87ceeb', '#a8d8ea'],
  sunset: ['#1a1045', '#6b3fa0', '#d4618c', '#f4a460', '#ffd700'],
  night: ['#0a0a2e', '#1a1045', '#2d1b69', '#1a1045'],
};

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
        const data = await fetchDailyPrayerTimes(settings.lat, settings.lng, now);
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
  const timePeriod = getTimePeriod(displayNow);
  const fastingInfo = getFastingInfo(displayNow, timetable, prayerTimesOverride);
  const countdown = getCountdown(fastingInfo.countdownTarget, displayNow);
  const liveSunPos = getSunPosition(displayNow, timetable, prayerTimesOverride);
  const sunPos = isSimulating ? simulationProgress : liveSunPos;
  const prayerTimes = getPrayerTimes(displayNow, timetable, prayerTimesOverride);
  const targetPrayerTime = isSimulating
    ? formatTime12(displayNow)
    : formatTime12(fastingInfo.countdownTarget);
  const islamicDate = getIslamicDate();
  const isDaytimeNow = timePeriod === 'morning' || timePeriod === 'day';
  const isSunset = timePeriod === 'sunset';

  const textColor = isDaytimeNow ? '#1a3a5c' : '#ffffff';
  const subtextColor = isDaytimeNow ? '#4a6a8c' : 'rgba(255,255,255,0.7)';
  const cardBg = isDaytimeNow
    ? 'rgba(255,255,255,0.3)'
    : isSunset
      ? 'rgba(0,0,0,0.2)'
      : 'rgba(255,255,255,0.08)';
  const cardBorder = isDaytimeNow
    ? 'rgba(255,255,255,0.5)'
    : isSunset
      ? 'rgba(255,255,255,0.15)'
      : 'rgba(255,255,255,0.12)';

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
        colors={GRADIENTS[timePeriod] as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Stars for night mode */}
      {!isDaytimeNow && !isSunset && <StarsOverlay />}

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

      {/* Target prayer time (e.g. Fajr / Iftar) */}
      <Text style={[styles.currentTime, { color: textColor }]}>{targetPrayerTime}</Text>

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
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
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
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
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
              style={[styles.markBtn, { borderColor: cardBorder, opacity: markedToday ? 0.6 : 1 }]}
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
function StarsOverlay() {
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
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
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
