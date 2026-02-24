import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { fetchRamadanTimetable } from '@/lib/aladhan-api';
import { DIVISIONS, type District, type Division } from '@/lib/bangladesh-districts';
import { saveSettings, type RamadanDayTime } from '@/lib/storage';

type Step = 'select' | 'loading' | 'confirm' | 'edit';
type DistrictOption = { district: District; division: Division };

const FEATURED_CITIES = [
  'Dhaka',
  'Chattogram',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh',
  "Cox's Bazar",
  'Comilla',
  'Gazipur',
  'Narayanganj',
  'Feni',
  'Bogura',
  'Jessore',
  'Kushtia',
  'Pabna',
  'Tangail',
  'Dinajpur',
  'Noakhali',
];

export default function SettingsScreen() {
  const [step, setStep] = React.useState<Step>('select');
  const [selectedDivision, setSelectedDivision] = React.useState<Division | null>(null);
  const [selectedDistrict, setSelectedDistrict] = React.useState<District | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [timetable, setTimetable] = React.useState<RamadanDayTime[]>([]);
  const [editedTimetable, setEditedTimetable] = React.useState<RamadanDayTime[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [locationNote, setLocationNote] = React.useState<string | null>(null);
  const [isLocating, setIsLocating] = React.useState(false);

  const allDistricts = React.useMemo<DistrictOption[]>(
    () =>
      DIVISIONS.flatMap((division) =>
        division.districts.map((district) => ({
          division,
          district,
        }))
      ),
    []
  );

  const filteredDistricts = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allDistricts.filter((d) => FEATURED_CITIES.includes(d.district.name));
    return allDistricts
      .filter(
        (d) =>
          d.district.name.toLowerCase().includes(query) ||
          d.district.bn.toLowerCase().includes(query) ||
          d.division.name.toLowerCase().includes(query)
      )
      .slice(0, 24);
  }, [allDistricts, searchQuery]);

  function selectDistrict(option: DistrictOption) {
    setSelectedDivision(option.division);
    setSelectedDistrict(option.district);
    setSearchQuery(option.district.name);
    setError(null);
  }

  async function handleUseMyLocation() {
    if (isLocating) return;
    setIsLocating(true);
    setError(null);
    setLocationNote(null);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setError('Location services are off. Turn on GPS and try again.');
        return;
      }

      const currentPermission = await Location.getForegroundPermissionsAsync();
      const permission =
        currentPermission.status === 'granted'
          ? currentPermission
          : await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setError(
          permission.canAskAgain
            ? 'Location permission denied. Please choose city manually.'
            : 'Location permission is blocked. Enable it in phone settings.'
        );
        return;
      }

      const pos = await getBestPosition();
      if (!pos) {
        setError('Could not read your location. Please choose city manually.');
        return;
      }

      const nearest = getNearestDistrict(pos.coords.latitude, pos.coords.longitude, allDistricts);
      if (!nearest) {
        setError('Unable to detect nearest district. Please choose city manually.');
        return;
      }

      const distanceKm = haversineKm(
        pos.coords.latitude,
        pos.coords.longitude,
        nearest.district.lat,
        nearest.district.lng
      );

      selectDistrict(nearest);
      setLocationNote(
        distanceKm > 250
          ? `Nearest supported district selected: ${nearest.district.name} (${Math.round(distanceKm)} km away).`
          : `Detected near ${nearest.district.name}.`
      );
    } catch {
      setError('Failed to use current location. Please choose city manually.');
    } finally {
      setIsLocating(false);
    }
  }

  async function handleFetch() {
    if (!selectedDistrict || !selectedDivision) return;
    setStep('loading');
    setError(null);
    try {
      const data = await fetchRamadanTimetable(selectedDistrict.lat, selectedDistrict.lng);
      if (data.length === 0) throw new Error('No Ramadan days found. Please try again.');
      setTimetable(data);
      setEditedTimetable(data.map((d) => ({ ...d })));
      setStep('confirm');
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch prayer times. Check your connection.');
      setStep('select');
    }
  }

  async function handleConfirm() {
    if (!selectedDivision || !selectedDistrict) return;
    await saveSettings({
      divisionName: selectedDivision.name,
      districtName: selectedDistrict.name,
      districtBn: selectedDistrict.bn,
      lat: selectedDistrict.lat,
      lng: selectedDistrict.lng,
      timetable,
    });
    router.back();
  }

  async function handleSaveEdits() {
    if (!selectedDivision || !selectedDistrict) return;
    for (const row of editedTimetable) {
      if (!isValidTime(row.sehri) || !isValidTime(row.iftar)) {
        Alert.alert('Invalid Time', `Day ${row.day}: Times must be HH:MM (24h).`);
        return;
      }
    }
    await saveSettings({
      divisionName: selectedDivision.name,
      districtName: selectedDistrict.name,
      districtBn: selectedDistrict.bn,
      lat: selectedDistrict.lat,
      lng: selectedDistrict.lng,
      timetable: editedTimetable,
    });
    router.back();
  }

  function updateEditRow(day: number, field: 'sehri' | 'iftar', value: string) {
    setEditedTimetable((prev) =>
      prev.map((row) => (row.day === day ? { ...row, [field]: value } : row))
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#050F2C', '#0C1E48', '#132C63']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'confirm' ? 'Confirm Times' : step === 'edit' ? 'Edit Times' : 'Settings'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {(step === 'select' || step === 'loading') && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionEyebrow}>Settings</Text>
          <Text style={styles.sectionTitle}>Your Light Through Ramadan</Text>
          <Text style={styles.sectionSubtitle}>Where will you be fasting this Ramadan?</Text>

          <TouchableOpacity
            style={[styles.useLocationBtn, isLocating && styles.useLocationBtnDisabled]}
            onPress={handleUseMyLocation}
            disabled={isLocating || step === 'loading'}>
            {isLocating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#1A1B21" size="small" />
                <Text style={styles.useLocationBtnText}>Detecting...</Text>
              </View>
            ) : (
              <Text style={styles.useLocationBtnText}>Use My Location</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.orText}>or choose your city</Text>

          <View style={styles.searchWrap}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholder="Search for your city"
              placeholderTextColor="rgba(255,255,255,0.45)"
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.cityGrid}>
            {filteredDistricts.map((option) => {
              const active = selectedDistrict?.name === option.district.name;
              return (
                <TouchableOpacity
                  key={option.district.name}
                  style={[styles.cityChip, active && styles.cityChipActive]}
                  onPress={() => selectDistrict(option)}>
                  <Text style={[styles.cityChipText, active && styles.cityChipTextActive]}>
                    {option.district.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDistrict && selectedDivision && (
            <View style={styles.selectedCityBox}>
              <Text style={styles.selectedCityTitle}>
                Selected: {selectedDistrict.name} ({selectedDistrict.bn})
              </Text>
              <Text style={styles.selectedCitySub}>Division: {selectedDivision.name}</Text>
              {locationNote && <Text style={styles.selectedCityHint}>{locationNote}</Text>}
            </View>
          )}

          {selectedDistrict && (
            <TouchableOpacity
              style={[styles.fetchBtn, step === 'loading' && styles.fetchBtnDisabled]}
              onPress={handleFetch}
              disabled={step === 'loading'}>
              {step === 'loading' ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.fetchBtnText}>Fetching times...</Text>
                </View>
              ) : (
                <Text style={styles.fetchBtnText}>Search Ramadan 2026 Times</Text>
              )}
            </TouchableOpacity>
          )}
          <View style={{ height: 28 }} />
        </ScrollView>
      )}

      {step === 'confirm' && (
        <>
          <View style={styles.confirmBanner}>
            <Text style={styles.confirmBannerTitle}>
              {selectedDistrict?.name} · {selectedDistrict?.bn}
            </Text>
            <Text style={styles.confirmBannerSub}>
              Ramadan 2026 · {timetable.length} days · Hanafi method
            </Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.tableContent}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.4 }]}>Day</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.4 }]}>Date</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.9 }]}>Sehri</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.9 }]}>Iftar</Text>
            </View>

            {timetable.map((row) => (
              <View
                key={row.day}
                style={[styles.tableRow, row.day % 2 === 0 && styles.tableRowEven]}>
                <Text style={[styles.tableCell, styles.tableDayCell, { flex: 0.4 }]}>
                  {row.day}
                </Text>
                <Text style={[styles.tableCell, styles.tableDateCell, { flex: 1.4 }]}>
                  {row.date}
                </Text>
                <Text style={[styles.tableCell, styles.tableTimeCell, { flex: 0.9 }]}>
                  {formatDisplay(row.sehri)}
                </Text>
                <Text style={[styles.tableCell, styles.tableTimeCell, { flex: 0.9 }]}>
                  {formatDisplay(row.iftar)}
                </Text>
              </View>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setStep('edit')}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Yes, Let&apos;s Go</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === 'edit' && (
        <>
          <View style={styles.confirmBanner}>
            <Text style={styles.confirmBannerTitle}>Edit Times - {selectedDistrict?.name}</Text>
            <Text style={styles.confirmBannerSub}>Tap any time to edit (24h HH:MM)</Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.tableContent}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.4 }]}>Day</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.2 }]}>Date</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1 }]}>Sehri</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1 }]}>Iftar</Text>
            </View>

            {editedTimetable.map((row) => (
              <View
                key={row.day}
                style={[styles.tableRow, row.day % 2 === 0 && styles.tableRowEven]}>
                <Text style={[styles.tableCell, styles.tableDayCell, { flex: 0.4 }]}>
                  {row.day}
                </Text>
                <Text style={[styles.tableCell, styles.tableDateCell, { flex: 1.2 }]}>
                  {row.date}
                </Text>
                <TextInput
                  style={[styles.tableCell, styles.timeInput, { flex: 1 }]}
                  value={row.sehri}
                  onChangeText={(v) => updateEditRow(row.day, 'sehri', v)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
                <TextInput
                  style={[styles.tableCell, styles.timeInput, { flex: 1 }]}
                  value={row.iftar}
                  onChangeText={(v) => updateEditRow(row.day, 'iftar', v)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setStep('confirm')}>
              <Text style={styles.editBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveEdits}>
              <Text style={styles.confirmBtnText}>Save and Go</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function formatDisplay(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t);
}

async function getBestPosition(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
  } catch { }

  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch { }

  try {
    return await Location.getLastKnownPositionAsync({
      maxAge: 1000 * 60 * 15,
      requiredAccuracy: 1000,
    });
  } catch {
    return null;
  }
}

function getNearestDistrict(
  lat: number,
  lng: number,
  districts: DistrictOption[]
): DistrictOption | null {
  let winner: DistrictOption | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const item of districts) {
    const dist = haversineKm(lat, lng, item.district.lat, item.district.lng);
    if (dist < bestDist) {
      bestDist = dist;
      winner = item;
    }
  }
  return winner;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
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
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: '#fff', fontSize: 24 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 8 },
  sectionEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  useLocationBtn: {
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: '#E0B73F',
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F2D06D',
  },
  useLocationBtnText: { color: '#1A1B21', fontSize: 16, fontWeight: '800' },
  useLocationBtnDisabled: { opacity: 0.7 },
  orText: {
    color: 'rgba(255,255,255,0.58)',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 10,
    fontSize: 12,
  },
  searchWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    color: '#fff',
    fontSize: 14,
    height: 44,
  },
  errorBox: {
    backgroundColor: 'rgba(201, 65, 65, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,116,116,0.55)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  errorText: { color: '#FFD4D4', fontSize: 12 },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(26,49,86,0.78)',
    paddingHorizontal: 13,
    paddingVertical: 9,
    minWidth: 92,
    alignItems: 'center',
  },
  cityChipActive: {
    backgroundColor: 'rgba(224,183,63,0.22)',
    borderColor: '#E0B73F',
  },
  cityChipText: { color: 'rgba(238,245,255,0.92)', fontSize: 13, fontWeight: '600' },
  cityChipTextActive: { color: '#FFE9A8' },
  selectedCityBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  selectedCityTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  selectedCitySub: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 4 },
  selectedCityHint: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  fetchBtn: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#2D8CFF',
    paddingVertical: 14,
    alignItems: 'center',
  },
  fetchBtnDisabled: { opacity: 0.65 },
  fetchBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confirmBanner: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  confirmBannerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  confirmBannerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  tableContent: { paddingHorizontal: 12, paddingTop: 8 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  tableRowEven: { backgroundColor: 'rgba(255,255,255,0.04)' },
  tableHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    paddingBottom: 10,
    marginBottom: 4,
  },
  tableHeaderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tableCell: { color: '#fff', fontSize: 13, paddingHorizontal: 2 },
  tableDayCell: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  tableDateCell: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  tableTimeCell: { fontWeight: '600', fontSize: 13, color: '#a8d8ff' },
  timeInput: {
    borderWidth: 1,
    borderColor: 'rgba(100,149,237,0.5)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    color: '#fff',
    fontSize: 13,
    backgroundColor: 'rgba(100,149,237,0.1)',
    marginHorizontal: 2,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  editBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#27AE60',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
