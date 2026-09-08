import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AppHeader,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingView,
  OptionSheet,
  ProgressBar,
  Screen,
  Sheet,
  type SheetOption,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { activityApi, type ActivitySession, type MemberActivity, type ProjectMember } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors, useTheme } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamActivity'>;

function mergeWorkspaceMembers(api: MemberActivity[], projectMembers: ProjectMember[]): MemberActivity[] {
  const byId = new Map(api.map((m) => [m.userId, m]));
  const byEmail = new Map(api.map((m) => [m.email.toLowerCase(), m]));
  const extra: MemberActivity[] = [];
  for (const pm of projectMembers) {
    const email = pm.email.toLowerCase().trim();
    if (!email) continue;
    if ((pm.userId && byId.has(pm.userId)) || byEmail.has(email)) continue;
    const row: MemberActivity = {
      userId: pm.userId || `email:${email}`,
      name: pm.name || email,
      email,
      role: pm.role,
      memberStatus: pm.status === 'pending' ? 'pending' : 'active',
      avatarUrl: pm.avatarUrl ?? null,
      tracking: false,
      attendanceStatus: 'not_in',
      firstCheckInAt: null,
      lastCheckOutAt: null,
      totalClockedMs: 0,
      totalTrackedMs: 0,
      totalWebsiteMs: 0,
      apps: [],
      sites: [],
      sessions: [],
    };
    extra.push(row);
    byId.set(row.userId, row);
    byEmail.set(email, row);
  }
  return extra.length === 0 ? api : [...api, ...extra];
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatClock(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatDateLabel(iso: string) {
  try {
    return parseIsoDate(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function sessionSpanMs(session: ActivitySession) {
  const start = new Date(session.startedAt).getTime();
  const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  return Math.max(0, end - start);
}

function withDayAttendance(member: MemberActivity): MemberActivity {
  if (member.sessions.length === 0) {
    return {
      ...member,
      attendanceStatus: member.attendanceStatus ?? 'not_in',
      firstCheckInAt: member.firstCheckInAt ?? null,
      lastCheckOutAt: member.lastCheckOutAt ?? null,
      totalClockedMs: 0,
    };
  }
  const sorted = [...member.sessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const fromSessions = sorted.reduce((sum, session) => sum + sessionSpanMs(session), 0);
  return {
    ...member,
    attendanceStatus:
      member.attendanceStatus ?? (member.tracking ? 'checked_in' : 'checked_out'),
    firstCheckInAt: member.firstCheckInAt ?? first?.startedAt ?? null,
    lastCheckOutAt: member.tracking ? null : (member.lastCheckOutAt ?? last?.endedAt ?? null),
    totalClockedMs: Math.max(member.totalClockedMs ?? 0, fromSessions),
  };
}

function attendanceLabel(member: MemberActivity) {
  if (member.memberStatus === 'pending') return 'Pending invite';
  if (member.attendanceStatus === 'checked_in' || member.tracking) return 'Checked in';
  if (member.attendanceStatus === 'not_in' || member.sessions.length === 0) return "Didn't check in";
  return 'Checked out';
}

function UsageRows({
  rows,
  empty,
  color,
}: {
  rows: { key: string; label: string; sub?: string; value: number }[];
  empty: string;
  color: string;
}) {
  const colors = useColors();
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) {
    return <Text style={[styles.muted, { color: colors.textSubtle }]}>{empty}</Text>;
  }
  return (
    <View style={styles.usageList}>
      {rows.slice(0, 12).map((row) => (
        <View key={row.key} style={styles.usageRow}>
          <View style={styles.usageTop}>
            <View style={styles.flex}>
              <Text style={[styles.usageLabel, { color: colors.text }]} numberOfLines={1}>
                {row.label}
              </Text>
              {row.sub ? (
                <Text style={[styles.usageSub, { color: colors.textSubtle }]} numberOfLines={1}>
                  {row.sub}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.usageTime, { color: colors.text }]}>{formatDuration(row.value)}</Text>
          </View>
          <ProgressBar value={row.value / max} color={color} height={5} />
        </View>
      ))}
    </View>
  );
}

function MemberRow({ member, onPress }: { member: MemberActivity; onPress: () => void }) {
  const colors = useColors();
  const pending = member.memberStatus === 'pending';
  const absent = !pending && (member.attendanceStatus === 'not_in' || member.sessions.length === 0);
  const checkedIn = member.attendanceStatus === 'checked_in' || member.tracking;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.memberRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View>
        <Avatar name={member.name} uri={member.avatarUrl} size={42} userId={member.userId} />
        {checkedIn ? <View style={[styles.liveDot, { borderColor: colors.surface }]} /> : null}
      </View>
      <View style={styles.flex}>
        <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
          {member.name}
          <Text style={[styles.memberRole, { color: colors.textSubtle }]}>
            {'  '}
            {member.role === 'admin' ? 'Admin' : 'Member'}
          </Text>
        </Text>
        <Text
          style={[styles.memberMeta, { color: pending || absent ? colors.warning : colors.textSubtle }]}
          numberOfLines={1}
        >
          {pending
            ? 'Pending invite'
            : absent
              ? "Didn't check in"
              : `${formatDuration(member.totalClockedMs ?? 0)} clocked · ${formatDuration(member.totalTrackedMs)} tracked`}
        </Text>
      </View>
      {pending ? (
        <Badge label="Pending" color={colors.warning} />
      ) : absent ? (
        <Badge label="Out" color={colors.warning} />
      ) : checkedIn ? (
        <Badge label="In" color={colors.success} dot />
      ) : (
        <Badge label="Out" color={colors.brand} />
      )}
    </Pressable>
  );
}

export function TeamActivityScreen({ route, navigation }: Props) {
  const requestedProjectId = route.params?.projectId;
  const colors = useColors();
  const { isDark } = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const { projects, isProjectAdmin, isLoading: workspaceLoading } = useWorkspace();

  const adminProjects = useMemo(
    () => projects.filter((project) => isProjectAdmin(project.id)),
    [projects, isProjectAdmin],
  );

  const [filterDate, setFilterDate] = useState(todayIso);
  const [filterProjectId, setFilterProjectId] = useState<string>(requestedProjectId ?? 'all');
  const [apiMembers, setApiMembers] = useState<MemberActivity[]>([]);
  const [orgTotal, setOrgTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectSheet, setProjectSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftDate, setDraftDate] = useState(parseIsoDate(todayIso()));

  const lockedProjectId = adminProjects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId
    : undefined;

  useEffect(() => {
    if (lockedProjectId) setFilterProjectId(lockedProjectId);
  }, [lockedProjectId]);

  const scopedProjectId = lockedProjectId ?? filterProjectId;

  const members = useMemo(() => {
    const source =
      scopedProjectId === 'all'
        ? adminProjects
        : adminProjects.filter((project) => project.id === scopedProjectId);
    return mergeWorkspaceMembers(
      apiMembers,
      source.flatMap((project) => project.members),
    ).map(withDayAttendance);
  }, [apiMembers, adminProjects, scopedProjectId]);

  const load = useCallback(
    async (date: string, pid: string) => {
      try {
        const data = await activityApi.getOrgActivityByDate(date, pid === 'all' ? undefined : pid);
        setApiMembers(data.members);
        setOrgTotal(data.totalTrackedMs);
      } catch (error) {
        toast.fromError(error, 'Could not load team activity.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (selectedId && !members.some((member) => member.userId === selectedId)) {
      setSelectedId(null);
    }
  }, [members, selectedId]);

  useEffect(() => {
    if (adminProjects.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load(filterDate, scopedProjectId);
  }, [adminProjects.length, filterDate, scopedProjectId, load]);

  const selected = members.find((member) => member.userId === selectedId) ?? null;
  const checkedIn = members.filter((member) => member.sessions.length > 0);
  const notIn = members.filter((member) => member.sessions.length === 0);
  const liveCount = members.filter((member) => member.tracking).length;

  const projectLabel =
    scopedProjectId === 'all'
      ? 'All admin projects'
      : adminProjects.find((project) => project.id === scopedProjectId)?.name ?? 'Project';

  const projectOptions = useMemo<SheetOption<string>[]>(
    () => [
      { value: 'all', label: 'All admin projects', description: `${adminProjects.length} projects` },
      ...adminProjects.map((project) => ({
        value: project.id,
        label: project.name,
        description: project.key,
      })),
    ],
    [adminProjects],
  );

  const commitDate = (date: Date) => {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setFilterDate(iso);
    setDraftDate(date);
    setShowDatePicker(false);
  };

  if (workspaceLoading && adminProjects.length === 0) {
    return (
      <Screen>
        <AppHeader title="Team activity" showBack />
        <LoadingView label="Loading team activity…" />
      </Screen>
    );
  }

  if (!user || adminProjects.length === 0) {
    return (
      <Screen>
        <AppHeader title="Team activity" showBack />
        <EmptyState
          icon="lock-closed-outline"
          title="Admins only"
          description="You can view check-ins, software, and websites for projects you admin."
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  if (loading && members.length === 0) {
    return (
      <Screen>
        <AppHeader title="Team activity" showBack />
        <LoadingView label="Loading team activity…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Team activity"
        subtitle={`${formatDateLabel(filterDate)} · ${projectLabel}`}
        showBack
        onBack={selected ? () => setSelectedId(null) : undefined}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(filterDate, scopedProjectId);
            }}
            tintColor={colors.brand}
          />
        }
      >
        <View style={styles.filters}>
          {!lockedProjectId ? (
            <Pressable
              onPress={() => setProjectSheet(true)}
              style={[styles.filterChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            >
              <Ionicons name="folder-outline" size={14} color={colors.brand} />
              <Text style={[styles.filterText, { color: colors.text }]} numberOfLines={1}>
                {projectLabel}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              setDraftDate(parseIsoDate(filterDate));
              setShowDatePicker(true);
            }}
            style={[styles.filterChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Ionicons name="calendar-outline" size={14} color={colors.brand} />
            <Text style={[styles.filterText, { color: colors.text }]}>{formatDateLabel(filterDate)}</Text>
          </Pressable>
        </View>

        {!selected ? (
        <View style={styles.kpis}>
          {[
            { label: 'Tracked', value: formatDuration(orgTotal), hint: liveCount ? `${liveCount} live` : 'this day' },
            { label: 'Clocked', value: formatDuration(members.reduce((sum, member) => sum + (member.totalClockedMs ?? 0), 0)), hint: 'this day' },
            { label: 'Checked in', value: String(checkedIn.length), hint: `${members.length} members` },
          ].map((kpi) => (
            <View key={kpi.label} style={[styles.kpi, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textSubtle }]}>{kpi.label}</Text>
              <Text style={[styles.kpiValue, { color: colors.text }]}>{kpi.value}</Text>
              <Text style={[styles.kpiHint, { color: colors.textMuted }]}>{kpi.hint}</Text>
            </View>
          ))}
        </View>
        ) : null}

        {selected ? (
          <MemberDetail member={selected} onClose={() => setSelectedId(null)} />
        ) : (
          <>
            {members.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No members"
                description="Invite people to a project you admin to see their desktop activity here."
              />
            ) : (
              <>
                {checkedIn.length > 0 ? (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Checked in</Text>
                    <View style={styles.memberList}>
                      {checkedIn.map((member) => (
                        <MemberRow key={member.userId} member={member} onPress={() => setSelectedId(member.userId)} />
                      ))}
                    </View>
                  </>
                ) : null}
                {notIn.length > 0 ? (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Didn't check in</Text>
                    <View style={styles.memberList}>
                      {notIn.map((member) => (
                        <MemberRow key={member.userId} member={member} onPress={() => setSelectedId(member.userId)} />
                      ))}
                    </View>
                  </>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      <OptionSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        title="Project"
        options={projectOptions}
        value={filterProjectId}
        onSelect={setFilterProjectId}
      />

      {showDatePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (event.type === 'set' && date) commitDate(date);
          }}
        />
      ) : null}

      <Sheet
        visible={showDatePicker && Platform.OS === 'ios'}
        onClose={() => setShowDatePicker(false)}
        title="Date"
        scrollable={false}
      >
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="spinner"
          themeVariant={isDark ? 'dark' : 'light'}
          maximumDate={new Date()}
          onChange={(_, date) => {
            if (date) setDraftDate(date);
          }}
        />
        <Button label="Use this date" onPress={() => commitDate(draftDate)} fullWidth />
      </Sheet>
    </Screen>
  );
}

function MemberDetail({ member, onClose }: { member: MemberActivity; onClose: () => void }) {
  const colors = useColors();
  const apps = member.apps ?? [];
  const sites = member.sites ?? [];
  const away = member.sessions.flatMap((session) => session.awayPeriods ?? []);
  const status = attendanceLabel(member);
  const checkedIn = member.attendanceStatus === 'checked_in' || member.tracking;
  const totalClocked = Math.max(
    member.totalClockedMs ?? 0,
    member.sessions.reduce((sum, session) => sum + sessionSpanMs(session), 0),
  );

  return (
    <View style={styles.detail}>
      <Pressable onPress={onClose} hitSlop={8} style={styles.backRow}>
        <Ionicons name="chevron-back" size={18} color={colors.brand} />
        <Text style={[styles.backLabel, { color: colors.brand }]}>All members</Text>
      </Pressable>

      <View style={styles.detailHero}>
        <Avatar name={member.name} uri={member.avatarUrl} size={52} userId={member.userId} />
        <View style={styles.flex}>
          <Text style={[styles.memberName, { color: colors.text }]}>{member.name}</Text>
          <Text style={[styles.memberMeta, { color: colors.textSubtle }]}>{member.email}</Text>
        </View>
        {checkedIn ? (
          <Badge label="Checked in" color={colors.success} dot />
        ) : member.sessions.length === 0 ? (
          <Badge label="Out" color={colors.warning} />
        ) : (
          <Badge label="Checked out" color={colors.brand} />
        )}
      </View>

      <Card>
        <Text style={[styles.kpiLabel, { color: colors.textSubtle }]}>Total clocked today</Text>
        <Text style={[styles.clockedHero, { color: colors.text }]}>{formatDuration(totalClocked)}</Text>
        <Text style={[styles.cardHint, { color: colors.textSubtle, marginBottom: 0 }]}>
          {member.sessions.length === 0
            ? 'No check-ins on this date'
            : `All ${member.sessions.length} check-in${member.sessions.length === 1 ? '' : 's'} added together`}
        </Text>
      </Card>

      <View style={styles.attendanceGrid}>
        {[
          { label: 'Status', value: status },
          { label: 'Check-in', value: formatClock(member.firstCheckInAt) },
          { label: 'Check-out', value: checkedIn ? 'Now' : formatClock(member.lastCheckOutAt) },
          { label: 'Tracked', value: formatDuration(member.totalTrackedMs) },
        ].map((item) => (
          <View
            key={item.label}
            style={[styles.attendanceCell, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.kpiLabel, { color: colors.textSubtle }]}>{item.label}</Text>
            <Text style={[styles.attendanceValue, { color: colors.text }]} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Check-ins</Text>
        {member.sessions.length > 0 ? (
          <Text style={[styles.cardHint, { color: colors.textSubtle }]}>
            Total clocked {formatDuration(totalClocked)}
          </Text>
        ) : null}
        {member.sessions.length === 0 ? (
          <Text style={[styles.muted, { color: colors.textSubtle }]}>
            {member.name} did not check in on this date.
          </Text>
        ) : (
          <View style={styles.sessionList}>
            {member.sessions.map((session, index) => {
              const live = session.status === 'active';
              return (
                <View
                  key={session.id}
                  style={[
                    styles.sessionRow,
                    { borderColor: colors.border },
                    index === 0 && { borderTopWidth: 0, paddingTop: 0 },
                  ]}
                >
                  <Text style={[styles.sessionTitle, { color: colors.text }]}>
                    Session {member.sessions.length - index}
                  </Text>
                  <Text style={[styles.memberMeta, { color: colors.textSubtle }]}>
                    {formatClock(session.startedAt)} → {live ? 'now' : formatClock(session.endedAt)} ·{' '}
                    {formatDuration(sessionSpanMs(session))} at desk · {formatDuration(session.totalTrackedMs)}{' '}
                    tracked
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Software used</Text>
        <Text style={[styles.cardHint, { color: colors.textSubtle }]}>Apps from the desktop tracker, including browsers.</Text>
        <UsageRows
          color={colors.brand}
          empty="No software recorded"
          rows={apps.map((app) => ({
            key: app.appName,
            label: app.appName,
            sub: app.lastWindowTitle || undefined,
            value: app.durationMs,
          }))}
        />
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Websites used</Text>
        <Text style={[styles.cardHint, { color: colors.textSubtle }]}>Sites and browser while browsing.</Text>
        <UsageRows
          color={colors.info}
          empty="No websites recorded"
          rows={sites.map((site) => ({
            key: `${site.host}-${site.browserName}`,
            label: site.host,
            sub: site.browserName || site.title || undefined,
            value: site.durationMs,
          }))}
        />
      </Card>

      {away.length > 0 ? (
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Away</Text>
          <View style={styles.sessionList}>
            {away.map((period, index) => (
              <View
                key={`${period.startedAt}-${index}`}
                style={[
                  styles.sessionRow,
                  { borderColor: colors.border },
                  index === 0 && { borderTopWidth: 0, paddingTop: 0 },
                ]}
              >
                <Text style={[styles.sessionTitle, { color: colors.text }]}>
                  {period.kind === 'lid_closed' ? 'Lid closed' : period.kind[0].toUpperCase() + period.kind.slice(1)}
                </Text>
                <Text style={[styles.memberMeta, { color: colors.textSubtle }]}>
                  {formatClock(period.startedAt)}–{formatClock(period.endedAt)} · {formatDuration(period.durationMs)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  kpis: {
    flexDirection: 'row',
    gap: 8,
  },
  kpi: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  kpiValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700',
  },
  kpiHint: {
    marginTop: 2,
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  memberList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  liveDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2,
  },
  flex: { flex: 1, minWidth: 0 },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
  },
  memberRole: {
    fontSize: 11,
    fontWeight: '600',
  },
  memberMeta: {
    fontSize: 12.5,
    marginTop: 2,
  },
  muted: {
    fontSize: 13,
    lineHeight: 18,
  },
  detail: {
    gap: 12,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  detailHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attendanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attendanceCell: {
    width: '31%',
    flexGrow: 1,
    minWidth: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  attendanceValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
  },
  clockedHero: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardHint: {
    fontSize: 12,
    marginTop: 3,
    marginBottom: 10,
  },
  usageList: {
    gap: 10,
    marginTop: 8,
  },
  usageRow: {
    gap: 6,
  },
  usageTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  usageLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  usageSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  usageTime: {
    fontSize: 12.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sessionList: {
    gap: 8,
    marginTop: 10,
  },
  sessionRow: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sessionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
