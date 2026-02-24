import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { loadSettings } from '@/lib/storage';
import {
  getMagneticDeclination,
  getQiblaBearing,
  magneticHeadingToTrueHeading,
  normalizeAngle,
  shortestSignedAngleDelta,
} from '@/lib/qibla';

const ALIGN_TOLERANCE_DEG = 3;

export default function QiblaScreen() {
  const [error, setError] = React.useState<string | null>(null);
  const [locationLabel, setLocationLabel] = React.useState('Loading location...');
  const [latLng, setLatLng] = React.useState<{ lat: number; lng: number } | null>(null);
  const [declination, setDeclination] = React.useState(0);
  const [qiblaBearing, setQiblaBearing] = React.useState<number | null>(null);
  const [trueHeading, setTrueHeading] = React.useState<number | null>(null);
  const [accuracy, setAccuracy] = React.useState<number | null>(null);
  const declinationRef = React.useRef(0);

  React.useEffect(() => {
    let headingSub: Location.LocationSubscription | null = null;
    let mounted = true;

    async function setup() {
      if (Platform.OS === 'web') {
        setError('Compass is not supported on web. Please open on a physical device.');
        return;
      }

      const saved = await loadSettings();
      if (saved && mounted) {
        setLocationLabel(`${saved.districtBn} · ${saved.districtName}`);
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        if (!saved) {
          setError('Location permission is required for Qibla direction.');
          return;
        }

        const fallback = { lat: saved.lat, lng: saved.lng };
        const fallbackDecl = getMagneticDeclination(fallback.lat, fallback.lng);
        if (mounted) {
          setLatLng(fallback);
          setDeclination(fallbackDecl);
          declinationRef.current = fallbackDecl;
          setQiblaBearing(getQiblaBearing(fallback.lat, fallback.lng));
          setError('Using saved district location. Enable location for better accuracy.');
        }
      } else {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;

        const current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setLatLng(current);
        setLocationLabel(
          saved ? `${saved.districtBn} · ${saved.districtName}` : 'Current device location'
        );
        const dec = getMagneticDeclination(current.lat, current.lng);
        setDeclination(dec);
        declinationRef.current = dec;
        setQiblaBearing(getQiblaBearing(current.lat, current.lng));
      }

      headingSub = await Location.watchHeadingAsync((h) => {
        if (!mounted) return;

        const computedTrue = magneticHeadingToTrueHeading(h.magHeading, declinationRef.current);
        setTrueHeading((prev) => {
          if (prev === null) return computedTrue;
          const delta = shortestSignedAngleDelta(prev, computedTrue);
          return normalizeAngle(prev + delta * 0.2);
        });
        setAccuracy(h.accuracy);
      });
    }

    setup().catch(() => {
      if (mounted) setError('Failed to initialize compass sensors.');
    });

    return () => {
      mounted = false;
      headingSub?.remove();
    };
  }, []);

  const qiblaDelta = React.useMemo(() => {
    if (qiblaBearing === null || trueHeading === null) return null;
    return shortestSignedAngleDelta(trueHeading, qiblaBearing);
  }, [qiblaBearing, trueHeading]);

  const isAligned = qiblaDelta !== null && Math.abs(qiblaDelta) <= ALIGN_TOLERANCE_DEG;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0a0a2e', '#1a1045', '#2d1b69']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Qibla Compass</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.locationText}>{locationLabel}</Text>
        <Text style={styles.subText}>
          {latLng
            ? `${latLng.lat.toFixed(4)}, ${latLng.lng.toFixed(4)}`
            : 'Waiting for location...'}
        </Text>

        <View style={styles.compassWrap}>
          <View style={styles.compassRing}>
            <Text style={styles.cardinalTop}>N</Text>
            <Text style={styles.cardinalBottom}>S</Text>
            <Text style={styles.cardinalLeft}>W</Text>
            <Text style={styles.cardinalRight}>E</Text>

            <View style={[styles.qiblaArrow, { transform: [{ rotate: `${qiblaDelta ?? 0}deg` }] }]}>
              <Text style={styles.qiblaArrowIcon}>🕋</Text>
              <Text style={styles.qiblaArrowStem}>▲</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Turn</Text>
          <Text style={styles.infoValue}>
            {qiblaDelta === null
              ? '--'
              : Math.abs(qiblaDelta) <= ALIGN_TOLERANCE_DEG
                ? 'On target'
                : `${qiblaDelta > 0 ? 'Right' : 'Left'} ${Math.abs(Math.round(qiblaDelta))}°`}
          </Text>

          <Text style={[styles.statusPill, isAligned ? styles.statusGood : styles.statusBusy]}>
            {isAligned ? 'Aligned to Qibla' : 'Rotate phone slowly to align'}
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Heading (True)</Text>
            <Text style={styles.metricValue}>
              {trueHeading === null ? '--' : `${Math.round(trueHeading)}°`}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Declination</Text>
            <Text style={styles.metricValue}>{`${declination.toFixed(1)}°`}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Sensor Acc.</Text>
            <Text style={styles.metricValue}>{accuracy === null ? '--' : `${accuracy}`}</Text>
          </View>
        </View>

        <Text style={styles.helpText}>
          Keep phone flat and away from metal. Move in a figure-8 motion if heading feels unstable.
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#fff',
    fontSize: 24,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSpacer: { width: 40 },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  locationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  subText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 4,
  },
  compassWrap: {
    marginTop: 24,
    marginBottom: 24,
  },
  compassRing: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardinalTop: {
    position: 'absolute',
    top: 14,
    color: '#fff',
    fontWeight: '700',
  },
  cardinalBottom: {
    position: 'absolute',
    bottom: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
  cardinalLeft: {
    position: 'absolute',
    left: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
  cardinalRight: {
    position: 'absolute',
    right: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
  qiblaArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qiblaArrowIcon: {
    fontSize: 28,
    marginBottom: 2,
  },
  qiblaArrowStem: {
    fontSize: 66,
    color: '#8ec5ff',
    lineHeight: 66,
  },
  infoCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
  },
  statusPill: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  statusGood: {
    backgroundColor: 'rgba(39,174,96,0.65)',
  },
  statusBusy: {
    backgroundColor: 'rgba(100,149,237,0.5)',
  },
  metricsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metricValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  helpText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
  },
  errorText: {
    marginTop: 10,
    color: '#ff8b8b',
    fontSize: 12,
    textAlign: 'center',
  },
});
