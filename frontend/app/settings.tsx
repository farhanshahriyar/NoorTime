import { LinearGradient } from 'expo-linear-gradient';
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

import { DIVISIONS, type District, type Division } from '@/lib/bangladesh-districts';
import { fetchRamadanTimetable } from '@/lib/aladhan-api';
import { saveSettings, type RamadanDayTime } from '@/lib/storage';

type Step = 'select' | 'loading' | 'confirm' | 'edit';

export default function SettingsScreen() {
  const [step, setStep] = React.useState<Step>('select');
  const [selectedDivision, setSelectedDivision] = React.useState<Division | null>(null);
  const [selectedDistrict, setSelectedDistrict] = React.useState<District | null>(null);
  const [timetable, setTimetable] = React.useState<RamadanDayTime[]>([]);
  const [editedTimetable, setEditedTimetable] = React.useState<RamadanDayTime[]>([]);
  const [error, setError] = React.useState<string | null>(null);

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
    // Validate all time inputs
    for (const row of editedTimetable) {
      if (!isValidTime(row.sehri) || !isValidTime(row.iftar)) {
        Alert.alert('Invalid Time', `Day ${row.day}: Times must be in HH:MM format (e.g. 05:12)`);
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
        colors={['#0a0a2e', '#1a1045', '#2d1b69']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'confirm' ? 'Confirm Times' : step === 'edit' ? 'Edit Times' : 'Settings'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── STEP: SELECT ── */}
      {(step === 'select' || step === 'loading') && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>{'📍 Your Location'}</Text>
          <Text style={styles.sectionSubtitle}>
            Select your district to fetch accurate Ramadan 2026 sehri & iftar times
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{'⚠️  ' + error}</Text>
            </View>
          )}

          {/* Division picker */}
          <Text style={styles.label}>Division (বিভাগ)</Text>
          <View style={styles.pillGrid}>
            {DIVISIONS.map((div) => {
              const active = selectedDivision?.name === div.name;
              return (
                <TouchableOpacity
                  key={div.name}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => {
                    setSelectedDivision(div);
                    setSelectedDistrict(null);
                  }}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {div.name}
                  </Text>
                  <Text style={[styles.pillBn, active && styles.pillBnActive]}>{div.bn}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* District picker */}
          {selectedDivision && (
            <>
              <Text style={[styles.label, { marginTop: 24 }]}>
                District (জেলা) — {selectedDivision.bn}
              </Text>
              <View style={styles.pillGrid}>
                {selectedDivision.districts.map((dist) => {
                  const active = selectedDistrict?.name === dist.name;
                  return (
                    <TouchableOpacity
                      key={dist.name}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setSelectedDistrict(dist)}>
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {dist.name}
                      </Text>
                      <Text style={[styles.pillBn, active && styles.pillBnActive]}>
                        {dist.bn}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Fetch button */}
          {selectedDistrict && (
            <TouchableOpacity
              style={[styles.fetchBtn, step === 'loading' && styles.fetchBtnDisabled]}
              onPress={handleFetch}
              disabled={step === 'loading'}>
              {step === 'loading' ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.fetchBtnText}>Fetching times…</Text>
                </View>
              ) : (
                <Text style={styles.fetchBtnText}>
                  {'🔍  Fetch Ramadan 2026 Times'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.aboutBox}>
            <Text style={styles.aboutTitle}>App About</Text>
            <Text style={styles.aboutItem}>{'• Location-based Ramadan prayer times'}</Text>
            <Text style={styles.aboutItem}>{'• Daily fasting countdown and info'}</Text>
            <Text style={styles.aboutItem}>{'• Fasting streak tracking'}</Text>
            <Text style={styles.aboutItem}>{'• Editable timetable for accuracy'}</Text>
          </View>

          <Text style={styles.copyrightText}>
            {'Copyright ©Farhan Shahriyar - 2026'}
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── STEP: CONFIRM ── */}
      {step === 'confirm' && (
        <>
          <View style={styles.confirmBanner}>
            <Text style={styles.confirmBannerTitle}>
              {'📌 ' + selectedDistrict?.name + ' · ' + selectedDistrict?.bn}
            </Text>
            <Text style={styles.confirmBannerSub}>
              Ramadan 2026 · {timetable.length} days · Hanafi method
            </Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.tableContent}>
            {/* Table header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.4 }]}>Day</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.4 }]}>Date</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.9 }]}>
                {'🌙 Sehri'}
              </Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.9 }]}>
                {'🌅 Iftar'}
              </Text>
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

          {/* Bottom actions */}
          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setStep('edit')}>
              <Text style={styles.editBtnText}>{'✏️  Edit'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>{'✅  Yes, Let\'s Go!'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── STEP: EDIT ── */}
      {step === 'edit' && (
        <>
          <View style={styles.confirmBanner}>
            <Text style={styles.confirmBannerTitle}>
              {'✏️  Edit Times — ' + selectedDistrict?.name}
            </Text>
            <Text style={styles.confirmBannerSub}>Tap any time to edit (24h format HH:MM)</Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.tableContent}>
            {/* Table header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.4 }]}>Day</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.2 }]}>Date</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1 }]}>
                {'🌙 Sehri'}
              </Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1 }]}>
                {'🌅 Iftar'}
              </Text>
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
              <Text style={styles.editBtnText}>{'← Back'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveEdits}>
              <Text style={styles.confirmBtnText}>{'💾  Save & Go!'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function formatDisplay(time: string): string {
  // "05:12" → "5:12 AM", "18:22" → "6:22 PM"
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
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: 'rgba(231,76,60,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.5)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pillActive: {
    backgroundColor: 'rgba(100,149,237,0.4)',
    borderColor: '#6495ED',
  },
  pillText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  pillBn: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 1,
  },
  pillBnActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  fetchBtn: {
    marginTop: 32,
    backgroundColor: '#6495ED',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6495ED',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fetchBtnDisabled: {
    backgroundColor: 'rgba(100,149,237,0.4)',
  },
  fetchBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aboutBox: {
    marginTop: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 14,
  },
  aboutTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  aboutItem: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 18,
  },
  copyrightText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },
  // Confirm banner
  confirmBanner: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  confirmBannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  confirmBannerSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  tableContent: { paddingHorizontal: 12, paddingTop: 8 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  tableRowEven: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
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
  tableCell: {
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 2,
  },
  tableDayCell: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  tableDateCell: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  tableTimeCell: {
    fontWeight: '600',
    fontSize: 13,
    color: '#a8d8ff',
  },
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
  editBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#27ae60',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#27ae60',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
