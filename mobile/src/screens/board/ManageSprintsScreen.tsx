import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  OptionSheet,
  Screen,
  Sheet,
  type SheetOption,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { formatDate, toIsoDate } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors, useTheme } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageSprints'>;

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function statusTone(status: string, colors: ReturnType<typeof useColors>) {
  if (status === 'active') return colors.success;
  if (status === 'done') return colors.textSubtle;
  return colors.warning;
}

export function ManageSprintsScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const colors = useColors();
  const { isDark } = useTheme();
  const toast = useToast();
  const {
    getProject,
    isProjectAdmin,
    phasesForProject,
    sprintsForProject,
    createPhases,
    startPhase,
    completePhase,
    createSprint,
    startSprint,
    extendSprint,
    completeSprint,
    setBoardSprintId,
  } = useWorkspace();

  const project = getProject(projectId);
  const isAdmin = isProjectAdmin(projectId);
  const phases = phasesForProject(projectId);
  const sprints = sprintsForProject(projectId);

  const [tab, setTab] = useState<'sprints' | 'phases'>('sprints');
  const [busy, setBusy] = useState(false);

  const [sprintName, setSprintName] = useState('');
  const [sprintPhaseId, setSprintPhaseId] = useState<string | null>(null);
  const [phaseSheet, setPhaseSheet] = useState(false);
  const [start, setStart] = useState(todayDate());
  const [end, setEnd] = useState(addDays(todayDate(), 13));
  const [picking, setPicking] = useState<'start' | 'end' | 'extend' | null>(null);
  const [draftDate, setDraftDate] = useState(todayDate());
  const [extendSprintId, setExtendSprintId] = useState<string | null>(null);

  const [phaseName, setPhaseName] = useState('');
  const [phaseRows, setPhaseRows] = useState<string[]>(['']);

  const phaseOptions = useMemo<SheetOption<string>[]>(
    () => [
      { value: 'none', label: 'No phase' },
      ...phases
        .filter((phase) => phase.status !== 'done')
        .map((phase) => ({ value: phase.id, label: phase.name })),
    ],
    [phases],
  );

  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      toast.fromError(error, `Could not ${label}.`);
    } finally {
      setBusy(false);
    }
  }

  if (!project) {
    return (
      <Screen>
        <AppHeader title="Plan" showBack />
        <EmptyState icon="alert-circle-outline" title="Project not found" />
      </Screen>
    );
  }

  if (!isAdmin) {
    return (
      <Screen>
        <AppHeader title="Plan" showBack />
        <EmptyState
          icon="lock-closed-outline"
          title="Admins only"
          description="Only project admins can create phases and sprints."
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const commitPicker = (date: Date) => {
    if (picking === 'start') setStart(date);
    if (picking === 'end') setEnd(date);
    if (picking === 'extend' && extendSprintId) {
      void run('extend the sprint', () => extendSprint(projectId, extendSprintId, toIsoDate(date)));
      setExtendSprintId(null);
    }
    setPicking(null);
  };

  return (
    <Screen>
      <AppHeader title="Plan" subtitle={project.name} showBack />
      <View style={styles.tabs}>
        {(['sprints', 'phases'] as const).map((id) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[
              styles.tab,
              {
                backgroundColor: tab === id ? colors.brandSoft : colors.surfaceAlt,
                borderColor: tab === id ? colors.brandBorder : colors.border,
              },
            ]}
          >
            <Text style={[styles.tabLabel, { color: tab === id ? colors.brand : colors.textSubtle }]}>
              {id === 'sprints' ? 'Sprints' : 'Phases'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'sprints' ? (
          <>
            <Card>
              <Text style={[styles.cardTitle, { color: colors.text }]}>New sprint</Text>
              <Input placeholder="Sprint name" value={sprintName} onChangeText={setSprintName} />
              <Pressable
                onPress={() => setPhaseSheet(true)}
                style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              >
                <Text style={{ color: colors.text }}>
                  {sprintPhaseId
                    ? phases.find((phase) => phase.id === sprintPhaseId)?.name ?? 'Phase'
                    : 'No phase'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSubtle} />
              </Pressable>
              <View style={styles.row}>
                <Button
                  label="1 week"
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    const next = todayDate();
                    setStart(next);
                    setEnd(addDays(next, 6));
                  }}
                />
                <Button
                  label="2 weeks"
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    const next = todayDate();
                    setStart(next);
                    setEnd(addDays(next, 13));
                  }}
                />
                <Button
                  label="1 month"
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    const next = todayDate();
                    setStart(next);
                    setEnd(addMonths(next, 1));
                  }}
                />
              </View>
              <View style={styles.row}>
                <Pressable
                  onPress={() => {
                    setDraftDate(start);
                    setPicking('start');
                  }}
                  style={[styles.dateChip, { borderColor: colors.border }]}
                >
                  <Text style={[styles.muted, { color: colors.textSubtle }]}>Start</Text>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{formatDate(toIsoDate(start))}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setDraftDate(end);
                    setPicking('end');
                  }}
                  style={[styles.dateChip, { borderColor: colors.border }]}
                >
                  <Text style={[styles.muted, { color: colors.textSubtle }]}>End</Text>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{formatDate(toIsoDate(end))}</Text>
                </Pressable>
              </View>
              <Button
                label="Create sprint"
                disabled={busy || !sprintName.trim()}
                onPress={() =>
                  void run('create the sprint', async () => {
                    await createSprint(projectId, {
                      name: sprintName.trim(),
                      phaseId: sprintPhaseId,
                      startDate: toIsoDate(start),
                      endDate: toIsoDate(end),
                    }).then((sprint) => {
                      if (sprint) setBoardSprintId(sprint.id);
                    });
                    setSprintName('');
                    toast.success('Sprint created');
                  })
                }
                fullWidth
              />
            </Card>

            {sprints.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No sprints"
                description="Work stays on Backlog until you create a sprint board."
              />
            ) : (
              sprints.map((sprint) => {
                const phase = phases.find((item) => item.id === sprint.phaseId);
                return (
                  <Card key={sprint.id}>
                    <View style={styles.cardHead}>
                      <View style={styles.flex}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>{sprint.name}</Text>
                        <Text style={[styles.muted, { color: colors.textSubtle }]}>
                          {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                          {phase ? ` · ${phase.name}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Badge label={sprint.status} color={statusTone(sprint.status, colors)} />
                        <Button
                          label="Open"
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            setBoardSprintId(sprint.id);
                            navigation.goBack();
                          }}
                        />
                      </View>
                    </View>
                    {sprint.status !== 'done' ? (
                      <View style={styles.row}>
                        {sprint.status === 'planned' ? (
                          <Button
                            label="Start"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onPress={() => void run('start the sprint', () => startSprint(projectId, sprint.id))}
                          />
                        ) : null}
                        <Button
                          label="Extend"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onPress={() => {
                            setExtendSprintId(sprint.id);
                            setDraftDate(addDays(new Date(`${sprint.endDate}T12:00:00`), 7));
                            setPicking('extend');
                          }}
                        />
                        <Button
                          label="Complete"
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onPress={() => void run('complete the sprint', () => completeSprint(projectId, sprint.id))}
                        />
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </>
        ) : (
          <>
            <Card>
              <Text style={[styles.cardTitle, { color: colors.text }]}>New phases</Text>
              {phaseRows.map((name, index) => (
                <Input
                  key={`phase-${index}`}
                  placeholder={`Phase ${index + 1} name`}
                  value={index === 0 ? phaseName : name}
                  onChangeText={(value) => {
                    if (index === 0) setPhaseName(value);
                    else {
                      setPhaseRows((prev) => prev.map((row, i) => (i === index ? value : row)));
                    }
                  }}
                />
              ))}
              <View style={styles.row}>
                <Button
                  label="Add another"
                  size="sm"
                  variant="secondary"
                  onPress={() => setPhaseRows((prev) => [...prev, ''])}
                />
                <View style={styles.flex}>
                  <Button
                    label="Create phases"
                    disabled={busy}
                    onPress={() =>
                      void run('create phases', async () => {
                        const names = [phaseName, ...phaseRows.slice(1)]
                          .map((row) => row.trim())
                          .filter(Boolean);
                        if (names.length === 0) throw new Error('Enter at least one phase name.');
                        await createPhases(
                          projectId,
                          names.map((name) => ({ name })),
                        );
                        setPhaseName('');
                        setPhaseRows(['']);
                        toast.success(names.length === 1 ? 'Phase created' : 'Phases created');
                      })
                    }
                    fullWidth
                  />
                </View>
              </View>
            </Card>

            {phases.length === 0 ? (
              <EmptyState
                icon="layers-outline"
                title="No phases"
                description="Phases are optional. Sprints can live on the project without one."
              />
            ) : (
              phases.map((phase) => (
                <Card key={phase.id}>
                  <View style={styles.cardHead}>
                    <View style={styles.flex}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{phase.name}</Text>
                      <Text style={[styles.muted, { color: colors.textSubtle }]}>
                        {sprints.filter((sprint) => sprint.phaseId === phase.id).length} sprints
                      </Text>
                    </View>
                    <Badge label={phase.status} color={statusTone(phase.status, colors)} />
                  </View>
                  {phase.status !== 'done' ? (
                    <View style={styles.row}>
                      {phase.status === 'planned' ? (
                        <Button
                          label="Start"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onPress={() => void run('start the phase', () => startPhase(projectId, phase.id))}
                        />
                      ) : null}
                      <Button
                        label="Complete"
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onPress={() => void run('complete the phase', () => completePhase(projectId, phase.id))}
                      />
                    </View>
                  ) : null}
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>

      <OptionSheet
        visible={phaseSheet}
        onClose={() => setPhaseSheet(false)}
        title="Phase"
        options={phaseOptions}
        value={sprintPhaseId ?? 'none'}
        onSelect={(value) => setSprintPhaseId(value === 'none' ? null : value)}
      />

      {picking && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setPicking(null);
            if (event.type === 'set' && date) commitPicker(date);
          }}
        />
      ) : null}

      <Sheet visible={picking !== null && Platform.OS === 'ios'} onClose={() => setPicking(null)} title="Date" scrollable={false}>
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="spinner"
          themeVariant={isDark ? 'dark' : 'light'}
          onChange={(_, date) => {
            if (date) setDraftDate(date);
          }}
        />
        <Button label="Use this date" onPress={() => commitPicker(draftDate)} fullWidth />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  muted: {
    fontSize: 12.5,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  flex: { flex: 1, minWidth: 0 },
  picker: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateChip: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
