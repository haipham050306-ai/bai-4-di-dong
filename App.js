import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView,
  Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { getLocales } from 'expo-localization';

const STORAGE_KEY = '@student_manager/students_v1';
const COPY = {
  vi: {
    app: 'Quản lý sinh viên', subtitle: 'Danh sách sinh viên', add: 'Thêm sinh viên',
    emptyTitle: 'Chưa có sinh viên', empty: 'Thêm sinh viên đầu tiên để bắt đầu quản lý.',
    search: 'Tìm theo tên, mã số hoặc email', detail: 'Chi tiết sinh viên', edit: 'Sửa thông tin',
    delete: 'Xóa sinh viên', cancel: 'Hủy', confirm: 'Có', save: 'Lưu thông tin',
    create: 'Thêm sinh viên', name: 'Họ tên sinh viên', studentId: 'Mã số sinh viên',
    email: 'Email', avatar: 'Ảnh đại diện', avatarUrl: 'Link ảnh (tùy chọn)',
    choosePhoto: 'Chọn ảnh từ thiết bị', removePhoto: 'Bỏ ảnh', required: 'Vui lòng nhập đầy đủ họ tên, mã số và email hợp lệ.',
    duplicate: 'Mã số sinh viên đã tồn tại.', confirmEdit: 'Bạn có muốn sửa thông tin SV không?',
    confirmDelete: 'Bạn có muốn xóa thông tin SV không?', saved: 'Đã lưu thông tin sinh viên.',
    deleted: 'Đã xóa sinh viên.', permission: 'Cần cấp quyền truy cập thư viện ảnh để chọn ảnh.',
    pickError: 'Không thể mở thư viện ảnh.', loadError: 'Không thể tải dữ liệu sinh viên.', nameLabel: 'Họ tên', idLabel: 'Mã số SV',
    emailLabel: 'Email', formAdd: 'Sinh viên mới', formEdit: 'Chỉnh sửa sinh viên', saveError: 'Không thể lưu dữ liệu sinh viên.',
    back: 'Quay lại', noResults: 'Không tìm thấy sinh viên phù hợp.',
  },
  en: {
    app: 'Student Manager', subtitle: 'Student directory', add: 'Add student',
    emptyTitle: 'No students yet', empty: 'Add your first student to get started.',
    search: 'Search name, student ID, or email', detail: 'Student details', edit: 'Edit details',
    delete: 'Delete student', cancel: 'Cancel', confirm: 'Yes', save: 'Save changes',
    create: 'Add student', name: 'Student full name', studentId: 'Student ID',
    email: 'Email', avatar: 'Profile photo', avatarUrl: 'Image link (optional)',
    choosePhoto: 'Choose photo from device', removePhoto: 'Remove photo', required: 'Enter a name, student ID, and a valid email.',
    duplicate: 'That student ID already exists.', confirmEdit: 'Do you want to edit this student?',
    confirmDelete: 'Do you want to delete this student?', saved: 'Student details saved.',
    deleted: 'Student deleted.', permission: 'Photo library access is required to choose a photo.',
    pickError: 'Could not open the photo library.', loadError: 'Could not load student data.', nameLabel: 'Full name', idLabel: 'Student ID',
    emailLabel: 'Email', formAdd: 'New student', formEdit: 'Edit student', saveError: 'Could not save student data.',
    back: 'Back', noResults: 'No matching students found.',
  },
};

const COLORS = { ink: '#17243B', muted: '#748198', blue: '#3D67F5', pale: '#EEF2FF', line: '#E8ECF3', bg: '#F7F8FC', red: '#D94B54', white: '#FFFFFF' };
const initials = (name = '') => name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join('') || '?';

export default function App() {
  const language = useMemo(() => (getLocales()?.[0]?.languageCode === 'vi' ? 'vi' : 'en'), []);
  const t = COPY[language];
  const [students, setStudents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState('list'); // list, detail, form
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState({ name: '', studentId: '', email: '', avatar: '' });
  const [query, setQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setStudents(JSON.parse(raw)); })
      .catch(() => Alert.alert(t.app, t.loadError))
      .finally(() => setLoaded(true));
  }, []);

  const persist = async (next) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setStudents(next);
  };
  const openNew = () => { setSelected(null); setDraft({ name: '', studentId: '', email: '', avatar: '' }); setScreen('form'); };
  const openEdit = (student) => { setSelected(student); setDraft({ ...student }); setScreen('form'); };
  const closeForm = () => setScreen(selected ? 'detail' : 'list');
  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const chooseImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert(t.app, t.permission); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets?.[0]?.uri) updateDraft('avatar', result.assets[0].uri);
    } catch { Alert.alert(t.app, t.pickError); }
  };

  const requestSave = () => {
    const clean = { ...draft, name: draft.name.trim(), studentId: draft.studentId.trim(), email: draft.email.trim(), avatar: draft.avatar.trim() };
    if (!clean.name || !clean.studentId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) { Alert.alert(t.app, t.required); return; }
    if (students.some((s) => s.id !== selected?.id && s.studentId.toLowerCase() === clean.studentId.toLowerCase())) { Alert.alert(t.app, t.duplicate); return; }
    const save = async () => {
      const record = { ...clean, id: selected?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}` };
      const next = selected ? students.map((s) => s.id === selected.id ? record : s) : [record, ...students];
      try {
        await persist(next); setSelected(record); setScreen(selected ? 'detail' : 'list'); Alert.alert(t.app, t.saved);
      } catch { Alert.alert(t.app, t.saveError); }
    };
    if (selected) setConfirmAction({ message: t.confirmEdit, action: save });
    else save();
  };

  const requestDelete = (student) => setConfirmAction({ message: t.confirmDelete, action: async () => {
    try {
      await persist(students.filter((s) => s.id !== student.id)); setSelected(null); setScreen('list'); Alert.alert(t.app, t.deleted);
    } catch { Alert.alert(t.app, t.saveError); }
  } });

  const filtered = students.filter((s) => `${s.name} ${s.studentId} ${s.email}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  if (!loaded) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={COLORS.blue} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      {screen === 'list' && (
        <View style={styles.page}>
          <View style={styles.header}><View><Text style={styles.eyebrow}>CAMPUS • STUDENTS</Text><Text style={styles.title}>{t.app}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={t.add} style={styles.addButton} onPress={openNew}><Text style={styles.addButtonText}>＋</Text></Pressable>
          </View>
          <Text style={styles.subtitle}>{t.subtitle}<Text style={styles.count}>  ·  {students.length}</Text></Text>
          <TextInput value={query} onChangeText={setQuery} placeholder={t.search} placeholderTextColor="#9AA4B5" style={styles.search} />
          <FlatList data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={filtered.length ? styles.list : styles.emptyWrap}
            ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>✦</Text></View><Text style={styles.emptyTitle}>{students.length ? t.noResults : t.emptyTitle}</Text><Text style={styles.emptyText}>{students.length ? '' : t.empty}</Text></View>}
            renderItem={({ item }) => <Pressable style={styles.studentCard} onPress={() => { setSelected(item); setScreen('detail'); }}>
              <Avatar student={item} /><View style={styles.cardInfo}><Text numberOfLines={1} style={styles.studentName}>{item.name}</Text><Text style={styles.studentMeta}>{item.studentId}</Text><Text numberOfLines={1} style={styles.studentEmail}>{item.email}</Text></View><Text style={styles.chevron}>›</Text>
            </Pressable>} />
          <Pressable accessibilityRole="button" style={styles.fab} onPress={openNew}><Text style={styles.fabText}>＋</Text><Text style={styles.fabLabel}>{t.add}</Text></Pressable>
        </View>
      )}
      {screen === 'detail' && selected && (
        <View style={styles.page}>
          <TopBar title={t.detail} onBack={() => setScreen('list')} back={t.back} />
          <ScrollView contentContainerStyle={styles.detailContent}>
            <View style={styles.profile}><Avatar student={selected} large /><Text style={styles.profileName}>{selected.name}</Text><Text style={styles.profileId}>{selected.studentId}</Text></View>
            <View style={styles.infoCard}><InfoRow label={t.nameLabel} value={selected.name} /><InfoRow label={t.idLabel} value={selected.studentId} /><InfoRow label={t.emailLabel} value={selected.email} last /></View>
            <Pressable style={styles.primaryButton} onPress={() => openEdit(selected)}><Text style={styles.primaryText}>{t.edit}</Text></Pressable>
            <Pressable style={styles.deleteButton} onPress={() => requestDelete(selected)}><Text style={styles.deleteText}>{t.delete}</Text></Pressable>
          </ScrollView>
        </View>
      )}
      {screen === 'form' && (
        <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TopBar title={selected ? t.formEdit : t.formAdd} onBack={closeForm} back={t.back} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
            <Text style={styles.formIntro}>{selected ? t.formEdit : t.formAdd}</Text>
            <Text style={styles.label}>{t.avatar}</Text>
            <View style={styles.avatarEditor}><Avatar student={draft} large /><View style={styles.avatarActions}><Pressable style={styles.outlineSmall} onPress={chooseImage}><Text style={styles.outlineSmallText}>{t.choosePhoto}</Text></Pressable>{draft.avatar ? <Pressable onPress={() => updateDraft('avatar', '')}><Text style={styles.removePhoto}>{t.removePhoto}</Text></Pressable> : null}</View></View>
            <TextInput value={draft.avatar} onChangeText={(value) => updateDraft('avatar', value)} placeholder={t.avatarUrl} placeholderTextColor="#9AA4B5" autoCapitalize="none" style={styles.input} />
            <Field label={t.name} value={draft.name} onChangeText={(value) => updateDraft('name', value)} placeholder={t.name} />
            <Field label={t.studentId} value={draft.studentId} onChangeText={(value) => updateDraft('studentId', value)} placeholder={t.studentId} autoCapitalize="characters" />
            <Field label={t.email} value={draft.email} onChangeText={(value) => updateDraft('email', value)} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Pressable style={[styles.primaryButton, styles.saveButton]} onPress={requestSave}><Text style={styles.primaryText}>{selected ? t.save : t.create}</Text></Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <Modal transparent visible={!!confirmAction} animationType="fade" onRequestClose={() => setConfirmAction(null)}>
        <View style={styles.modalOverlay}><View style={styles.modalCard}><View style={styles.modalMark}><Text style={styles.modalMarkText}>?</Text></View><Text style={styles.modalTitle}>{t.app}</Text><Text style={styles.modalMessage}>{confirmAction?.message}</Text>
          <View style={styles.modalButtons}><Pressable style={styles.modalCancel} onPress={() => setConfirmAction(null)}><Text style={styles.modalCancelText}>{t.cancel}</Text></Pressable><Pressable style={styles.modalConfirm} onPress={() => { const action = confirmAction?.action; setConfirmAction(null); action?.(); }}><Text style={styles.modalConfirmText}>{t.confirm}</Text></Pressable></View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

function Avatar({ student, large = false }) {
  const [failed, setFailed] = useState(false);
  const validUri = student?.avatar && /^(https?:\/\/|file:\/\/|content:\/\/)/i.test(student.avatar);
  return <View style={[styles.avatar, large && styles.avatarLarge]}>{validUri && !failed ? <Image key={student.avatar} source={{ uri: student.avatar }} style={styles.avatarImage} onError={() => setFailed(true)} /> : <Text style={[styles.avatarInitials, large && styles.avatarInitialsLarge]}>{initials(student?.name)}</Text>}</View>;
}
function TopBar({ title, onBack, back }) { return <View style={styles.topBar}><Pressable hitSlop={12} onPress={onBack}><Text style={styles.backText}>‹  {back}</Text></Pressable><Text style={styles.topTitle}>{title}</Text><View style={styles.topSpacer} /></View>; }
function InfoRow({ label, value, last }) { return <View style={[styles.infoRow, last && styles.infoRowLast]}><Text style={styles.infoLabel}>{label}</Text><Text selectable style={styles.infoValue}>{value}</Text></View>; }
function Field({ label, ...props }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#9AA4B5" style={[styles.input, props.editable === false && styles.disabledInput]} /></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  page: { flex: 1, paddingHorizontal: 22 }, header: { paddingTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: COLORS.blue, fontWeight: '800', marginBottom: 7 }, title: { color: COLORS.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  addButton: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.blue, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.blue, shadowOpacity: 0.22, shadowRadius: 10, elevation: 4 },
  addButtonText: { color: COLORS.white, fontSize: 28, fontWeight: '400', lineHeight: 32 }, subtitle: { marginTop: 6, marginBottom: 20, color: COLORS.muted, fontSize: 14, fontWeight: '500' }, count: { color: COLORS.blue, fontWeight: '700' },
  search: { height: 51, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 15, paddingHorizontal: 16, color: COLORS.ink, fontSize: 14, marginBottom: 16 },
  list: { paddingBottom: 105 }, emptyWrap: { flexGrow: 1, justifyContent: 'center', paddingBottom: 70 }, empty: { alignItems: 'center', paddingHorizontal: 22 }, emptyIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, emptyIconText: { color: COLORS.blue, fontSize: 30 },
  emptyTitle: { color: COLORS.ink, fontSize: 19, fontWeight: '750', textAlign: 'center' }, emptyText: { color: COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  studentCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, marginBottom: 11 },
  avatar: { width: 51, height: 51, borderRadius: 17, backgroundColor: '#E7ECFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarLarge: { width: 106, height: 106, borderRadius: 34 }, avatarImage: { width: '100%', height: '100%' }, avatarInitials: { color: COLORS.blue, fontSize: 16, fontWeight: '800' }, avatarInitialsLarge: { fontSize: 32 },
  cardInfo: { flex: 1, paddingLeft: 13 }, studentName: { fontSize: 15, color: COLORS.ink, fontWeight: '700' }, studentMeta: { marginTop: 4, color: COLORS.blue, fontSize: 12, fontWeight: '700' }, studentEmail: { marginTop: 3, color: COLORS.muted, fontSize: 12 }, chevron: { color: '#A5AEC0', fontSize: 26, paddingLeft: 8 },
  fab: { position: 'absolute', bottom: 19, right: 22, height: 55, paddingHorizontal: 19, borderRadius: 19, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blue, elevation: 5, shadowColor: COLORS.blue, shadowOpacity: 0.25, shadowRadius: 12 }, fabText: { color: COLORS.white, fontSize: 24, marginRight: 8 }, fabLabel: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  topBar: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.line }, backText: { color: COLORS.blue, fontSize: 14, fontWeight: '700', minWidth: 74 }, topTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '750' }, topSpacer: { width: 74 },
  detailContent: { paddingBottom: 34 }, profile: { alignItems: 'center', paddingVertical: 32 }, profileName: { color: COLORS.ink, fontSize: 22, fontWeight: '800', marginTop: 14, textAlign: 'center' }, profileId: { marginTop: 7, color: COLORS.blue, fontWeight: '700', fontSize: 14 },
  infoCard: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 19, paddingHorizontal: 17, marginBottom: 22 }, infoRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.line }, infoRowLast: { borderBottomWidth: 0 }, infoLabel: { color: COLORS.muted, fontSize: 12, marginBottom: 5 }, infoValue: { color: COLORS.ink, fontSize: 15, fontWeight: '600' },
  primaryButton: { height: 53, borderRadius: 16, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: COLORS.white, fontSize: 15, fontWeight: '750' }, deleteButton: { height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 7 }, deleteText: { color: COLORS.red, fontSize: 14, fontWeight: '700' },
  formContent: { paddingTop: 16, paddingBottom: 35 }, formIntro: { color: COLORS.ink, fontSize: 21, fontWeight: '800', marginBottom: 18 }, label: { color: COLORS.ink, fontSize: 13, fontWeight: '700', marginBottom: 8 }, avatarEditor: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 }, avatarActions: { marginLeft: 16, alignItems: 'flex-start', gap: 10 }, outlineSmall: { borderWidth: 1, borderColor: '#D7DFFF', backgroundColor: COLORS.pale, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 }, outlineSmallText: { color: COLORS.blue, fontWeight: '700', fontSize: 12 }, removePhoto: { color: COLORS.red, fontSize: 12, fontWeight: '600' },
  field: { marginTop: 14 }, input: { height: 51, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, borderRadius: 14, paddingHorizontal: 14, color: COLORS.ink, fontSize: 14 }, disabledInput: { color: COLORS.muted, backgroundColor: '#F0F2F6' }, saveButton: { marginTop: 24 },
  modalOverlay: { flex: 1, padding: 24, backgroundColor: 'rgba(20,31,54,0.42)', alignItems: 'center', justifyContent: 'center' }, modalCard: { width: '100%', maxWidth: 360, backgroundColor: COLORS.white, borderRadius: 23, padding: 23, alignItems: 'center' }, modalMark: { width: 47, height: 47, borderRadius: 17, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, modalMarkText: { color: COLORS.blue, fontSize: 22, fontWeight: '800' }, modalTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '800' }, modalMessage: { color: COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9, marginBottom: 20 }, modalButtons: { width: '100%', flexDirection: 'row', gap: 10 }, modalCancel: { flex: 1, height: 47, backgroundColor: '#F1F3F7', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, modalCancelText: { color: COLORS.ink, fontWeight: '700' }, modalConfirm: { flex: 1, height: 47, backgroundColor: COLORS.blue, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, modalConfirmText: { color: COLORS.white, fontWeight: '700' },
});
