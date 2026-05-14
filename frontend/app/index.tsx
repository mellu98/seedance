import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { FontAwesome, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Scene {
  scene_number: number;
  duration: number;
  title: string;
  prompt: string;
  transition: string;
}

interface Project {
  id: string;
  idea: string;
  style: string;
  aspect_ratio: string;
  mood: string;
  num_scenes: number;
  duration_per_scene: number;
  total_duration: number;
  scenes: Scene[];
  master_prompt: string;
  created_at: string;
}

const stylesList = [
  { key: 'cinematic', label: 'cinematic' },
  { key: 'documentary', label: 'documentary' },
  { key: 'commercial', label: 'commercial' },
  { key: 'music video', label: 'music video' },
] as const;

const ratiosList = [
  { key: '9:16', label: '9:16' },
  { key: '16:9', label: '16:9' },
  { key: '1:1', label: '1:1' },
] as const;

const moodsList = [
  { key: 'drammatico', label: 'drammatico' },
  { key: 'energico', label: 'energico' },
  { key: 'calmo', label: 'calmo' },
  { key: 'epico', label: 'epico' },
] as const;

const presets = [
  { key: 'reel-15', label: 'Reel 15s', scenes: 3, duration: 5, testID: 'preset-reel-15' },
  { key: 'spot-30', label: 'Spot 30s', scenes: 2, duration: 15, testID: 'preset-spot-30' },
  { key: 'trailer-60', label: 'Trailer 60s', scenes: 4, duration: 15, testID: 'preset-trailer-60' },
] as const;

// ── Styles ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  maxWidth: {
    width: '100%',
    maxWidth: 560,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#00FFFF',
    marginTop: 4,
    fontWeight: '600',
  },
  badge: {
    marginTop: 10,
    backgroundColor: 'rgba(0,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.3)',
  },
  badgeText: {
    color: '#00FFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    width: '100%',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  label: {
    color: '#AAAAAA',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textarea: {
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 6,
    marginRight: 6,
  },
  pillActive: {
    backgroundColor: 'rgba(0,255,255,0.15)',
    borderColor: '#00FFFF',
  },
  pillText: {
    color: '#AAAAAA',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#00FFFF',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  presetCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  presetCardActive: {
    borderColor: '#00FFFF',
    backgroundColor: 'rgba(0,255,255,0.08)',
  },
  presetLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  presetSub: {
    color: '#888888',
    fontSize: 11,
  },
  sliderRow: {
    marginTop: 8,
  },
  sliderValue: {
    color: '#00FFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  totalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  totalText: {
    color: '#CCCCCC',
    fontSize: 13,
    textAlign: 'center',
  },
  totalHighlight: {
    color: '#00FFFF',
    fontWeight: '700',
  },
  cta: {
    backgroundColor: '#00FFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
    width: '100%',
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '800',
  },
  errorBanner: {
    backgroundColor: 'rgba(255,50,50,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,50,50,0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#FF5555',
    fontSize: 13,
  },
  sceneCard: {
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    width: '100%',
  },
  sceneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sceneTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sceneDuration: {
    color: '#00FFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  promptText: {
    color: '#DDDDDD',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 20,
    marginBottom: 8,
  },
  transitionText: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 10,
  },
  copyBtnSmall: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  copyBtnSmallText: {
    color: '#00FFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  masterCard: {
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    width: '100%',
  },
  masterTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  masterText: {
    color: '#DDDDDD',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 20,
    marginBottom: 10,
  },
  sectionHeader: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 8,
    width: '100%',
  },
  historyItem: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    width: '100%',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyIdea: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  historyDate: {
    color: '#888888',
    fontSize: 11,
  },
  historyTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  tagText: {
    color: '#AAAAAA',
    fontSize: 11,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  historyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyActionText: {
    color: '#00FFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    marginTop: 8,
    marginBottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtnText: {
    color: '#FF5555',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyHistory: {
    alignItems: 'center',
    marginVertical: 20,
  },
  emptyHistoryText: {
    color: '#666666',
    fontSize: 14,
    marginTop: 8,
  },
});

export default function Index() {
  const [idea, setIdea] = useState('');
  const [style, setStyle] = useState<string>('cinematic');
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [mood, setMood] = useState<string>('drammatico');
  const [numScenes, setNumScenes] = useState(3);
  const [durationPerScene, setDurationPerScene] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const totalDuration = numScenes * durationPerScene;

  const fetchProjects = useCallback(async () => {
    if (!BACKEND_URL) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects`);
      if (!res.ok) throw new Error('Errore caricamento cronologia');
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      // silent fail for history auto-load
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const applyPreset = (scenes: number, duration: number, key: string) => {
    setNumScenes(scenes);
    setDurationPerScene(duration);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 800);
  };

  const showCopied = (key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleGenerate = async () => {
    if (!BACKEND_URL) {
      setError('Variabile EXPO_PUBLIC_BACKEND_URL mancante');
      return;
    }
    if (!idea.trim()) {
      setError('Inserisci un\'idea per generare lo storyboard');
      return;
    }
    setLoading(true);
    setError(null);
    setGenerated(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/generate-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: idea.trim(),
          style,
          aspect_ratio: aspectRatio,
          mood,
          num_scenes: numScenes,
          duration_per_scene: durationPerScene,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Errore durante la generazione');
      }
      setGenerated(data as Project);
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  const formatCopyAll = (project: Project) => {
    const lines = [
      'PROMPT POWER AI – SEEDANCE 2.0 EDITION',
      '',
      `Idea:\n${project.idea}`,
      '',
      'Settings:',
      `Style: ${project.style}`,
      `Aspect ratio: ${project.aspect_ratio}`,
      `Mood: ${project.mood}`,
      `Scenes: ${project.num_scenes}`,
      `Duration per scene: ${project.duration_per_scene}s`,
      `Total duration: ${project.total_duration}s`,
      '',
      `MASTER PROMPT:\n${project.master_prompt}`,
      '',
    ];
    project.scenes.forEach((s) => {
      lines.push(`SCENE ${s.scene_number} – ${s.title} – ${s.duration}s`);
      lines.push(`Prompt:\n${s.prompt}`);
      lines.push(`Transition: ${s.transition}`);
      lines.push('');
    });
    return lines.join('\n');
  };

  const copyText = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    showCopied(key);
  };

  const openProject = (project: Project) => {
    setIdea(project.idea);
    setStyle(project.style);
    setAspectRatio(project.aspect_ratio);
    setMood(project.mood);
    setNumScenes(project.num_scenes);
    setDurationPerScene(project.duration_per_scene);
    setGenerated(project);
    setExpandedProject(null);
  };

  const deleteProject = async (id: string) => {
    if (!BACKEND_URL) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Errore eliminazione');
      await fetchProjects();
      if (generated?.id === id) setGenerated(null);
    } catch (err: any) {
      setError(err.message || 'Errore eliminazione');
    }
  };

  const clearAll = async () => {
    if (!BACKEND_URL) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Errore svuotamento');
      await fetchProjects();
      setGenerated(null);
    } catch (err: any) {
      setError(err.message || 'Errore svuotamento');
    }
  };

  const renderPills = (
    items: readonly { key: string; label: string }[],
    selected: string,
    onSelect: (k: string) => void,
    testPrefix: string
  ) => (
    <View style={S.pillsRow}>
      {items.map((item) => {
        const active = selected === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            testID={`${testPrefix}-${item.key.replace(/[: ]/g, '-')}`}
            style={[S.pill, active && S.pillActive]}
            onPress={() => onSelect(item.key)}
          >
            <Text style={[S.pillText, active && S.pillTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={S.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={S.scrollContent}>
          <View style={S.maxWidth}>
            {/* Header */}
            <View style={S.header}>
              <Text style={S.title}>Prompt Power AI</Text>
              <Text style={S.subtitle}>Seedance 2.0 Edition</Text>
              <View style={S.badge}>
                <Text style={S.badgeText}>SEEDANCE 2.0 · {totalDuration}s</Text>
              </View>
            </View>

            {/* Error banner */}
            {error && (
              <View style={S.errorBanner}>
                <Text style={S.errorText}>{error}</Text>
              </View>
            )}

            {!BACKEND_URL && (
              <View style={S.errorBanner}>
                <Text style={S.errorText}>
                  Configura EXPO_PUBLIC_BACKEND_URL nel file .env
                </Text>
              </View>
            )}

            {/* Idea */}
            <View style={S.card}>
              <Text style={S.label}>Idea grezza</Text>
              <TextInput
                testID="idea-input"
                style={S.textarea}
                multiline
                placeholder="Descrivi la tua idea in poche parole..."
                placeholderTextColor="#666666"
                value={idea}
                onChangeText={setIdea}
                maxLength={800}
              />
            </View>

            {/* Style */}
            <View style={S.card}>
              <Text style={S.label}>Stile</Text>
              {renderPills(stylesList as any, style, setStyle, 'style')}
            </View>

            {/* Aspect ratio */}
            <View style={S.card}>
              <Text style={S.label}>Aspect ratio</Text>
              {renderPills(ratiosList as any, aspectRatio, setAspectRatio, 'ratio')}
            </View>

            {/* Mood */}
            <View style={S.card}>
              <Text style={S.label}>Mood</Text>
              {renderPills(moodsList as any, mood, setMood, 'mood')}
            </View>

            {/* Presets */}
            <View style={S.card}>
              <Text style={S.label}>Preset rapidi</Text>
              <View style={S.presetsRow}>
                {presets.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    testID={p.testID}
                    style={[
                      S.presetCard,
                      numScenes === p.scenes && durationPerScene === p.duration && S.presetCardActive,
                    ]}
                    onPress={() => applyPreset(p.scenes, p.duration, p.key)}
                  >
                    <Text style={S.presetLabel}>{p.label}</Text>
                    <Text style={S.presetSub}>
                      {p.scenes} × {p.duration}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sliders */}
            <View style={S.card}>
              <Text style={S.label}>Numero scene</Text>
              <Text style={S.sliderValue}>{numScenes}</Text>
              <Slider
                testID="num-scenes-slider"
                style={{ width: '100%', height: 30 }}
                minimumValue={1}
                maximumValue={6}
                step={1}
                value={numScenes}
                onValueChange={(v: number) => setNumScenes(Math.round(v))}
                minimumTrackTintColor="#00FFFF"
                maximumTrackTintColor="#333333"
                thumbTintColor="#00FFFF"
              />

              <Text style={[S.label, { marginTop: 12 }]}>Durata per scena</Text>
              <Text style={S.sliderValue}>{durationPerScene}s</Text>
              <Slider
                testID="duration-slider"
                style={{ width: '100%', height: 30 }}
                minimumValue={3}
                maximumValue={15}
                step={1}
                value={durationPerScene}
                onValueChange={(v: number) => setDurationPerScene(Math.round(v))}
                minimumTrackTintColor="#00FFFF"
                maximumTrackTintColor="#333333"
                thumbTintColor="#00FFFF"
              />

              <View style={S.totalRow}>
                <Text style={S.totalText}>
                  Totale: <Text style={S.totalHighlight}>{totalDuration}s</Text> · ogni scena è una generazione Seedance separata (max 15s)
                </Text>
              </View>
            </View>

            {/* CTA */}
            <TouchableOpacity
              testID="generate-button"
              style={[S.cta, loading && S.ctaDisabled]}
              onPress={handleGenerate}
              disabled={loading || !BACKEND_URL}
            >
              {loading ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={S.ctaText}>Genera storyboard Seedance</Text>
              )}
            </TouchableOpacity>

            {/* Output */}
            {generated && (
              <>
                <Text style={S.sectionHeader}>Storyboard generato</Text>

                {/* Master Prompt */}
                <View style={S.masterCard}>
                  <Text style={S.masterTitle}>Master Prompt</Text>
                  <Text style={S.masterText}>{generated.master_prompt}</Text>
                  <TouchableOpacity
                    testID="copy-master-button"
                    style={S.copyBtnSmall}
                    onPress={() => copyText(generated.master_prompt, 'master')}
                  >
                    <FontAwesome name="copy" size={12} color="#00FFFF" />
                    <Text style={S.copyBtnSmallText}>
                      {copiedKey === 'master' ? 'Copiato' : 'Copia master'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Copy all */}
                <TouchableOpacity
                  testID="copy-all-button"
                  style={[S.cta, { marginBottom: 16 }]}
                  onPress={() => copyText(formatCopyAll(generated), 'all')}
                >
                  <Text style={S.ctaText}>
                    {copiedKey === 'all' ? 'Copiato' : 'Copia tutto'}
                  </Text>
                </TouchableOpacity>

                {/* Scenes */}
                {generated.scenes.map((scene) => (
                  <View key={scene.scene_number} style={S.sceneCard}>
                    <View style={S.sceneHeader}>
                      <Text style={S.sceneTitle}>
                        Scena {scene.scene_number} – {scene.title}
                      </Text>
                      <Text style={S.sceneDuration}>{scene.duration}s</Text>
                    </View>
                    <Text style={S.promptText}>{scene.prompt}</Text>
                    <Text style={S.transitionText}>Transition: {scene.transition}</Text>
                    <TouchableOpacity
                      testID={`copy-scene-${scene.scene_number}-button`}
                      style={S.copyBtnSmall}
                      onPress={() => copyText(scene.prompt, `scene-${scene.scene_number}`)}
                    >
                      <FontAwesome name="copy" size={12} color="#00FFFF" />
                      <Text style={S.copyBtnSmallText}>
                        {copiedKey === `scene-${scene.scene_number}` ? 'Copiato' : 'Copia singolo'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* History */}
            <Text style={S.sectionHeader}>Cronologia</Text>
            {projects.length === 0 ? (
              <View style={S.emptyHistory}>
                <Ionicons name="time-outline" size={32} color="#444444" />
                <Text style={S.emptyHistoryText}>Nessun progetto ancora salvato</Text>
              </View>
            ) : (
              <View style={{ width: '100%' }} testID="project-history-list">
                {projects.map((proj) => {
                  const expanded = expandedProject === proj.id;
                  return (
                    <View key={proj.id} style={S.historyItem}>
                      <TouchableOpacity
                        style={S.historyHeader}
                        onPress={() => setExpandedProject(expanded ? null : proj.id)}
                      >
                        <Text style={S.historyIdea} numberOfLines={1}>
                          {proj.idea}
                        </Text>
                        <Text style={S.historyDate}>
                          {new Date(proj.created_at).toLocaleDateString('it-IT')}
                        </Text>
                      </TouchableOpacity>
                      <View style={S.historyTags}>
                        <View style={S.tag}>
                          <Text style={S.tagText}>
                            {proj.num_scenes}×{proj.duration_per_scene}s
                          </Text>
                        </View>
                        <View style={S.tag}>
                          <Text style={S.tagText}>{proj.style}</Text>
                        </View>
                        <View style={S.tag}>
                          <Text style={S.tagText}>{proj.aspect_ratio}</Text>
                        </View>
                      </View>
                      {expanded && (
                        <View style={S.historyActions}>
                          <TouchableOpacity
                            testID={`open-project-${proj.id}`}
                            style={S.historyActionBtn}
                            onPress={() => openProject(proj)}
                          >
                            <Ionicons name="open-outline" size={14} color="#00FFFF" />
                            <Text style={S.historyActionText}>Apri</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            testID={`copy-project-${proj.id}`}
                            style={S.historyActionBtn}
                            onPress={() => copyText(formatCopyAll(proj), `proj-${proj.id}`)}
                          >
                            <FontAwesome name="copy" size={12} color="#00FFFF" />
                            <Text style={S.historyActionText}>
                              {copiedKey === `proj-${proj.id}` ? 'Copiato' : 'Copia tutto'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            testID={`delete-project-${proj.id}`}
                            style={S.historyActionBtn}
                            onPress={() => deleteProject(proj.id)}
                          >
                            <MaterialIcons name="delete-outline" size={14} color="#FF5555" />
                            <Text style={[S.historyActionText, { color: '#FF5555' }]}>Elimina</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
                <TouchableOpacity
                  testID="clear-projects-button"
                  style={S.clearBtn}
                  onPress={clearAll}
                >
                  <MaterialIcons name="delete-sweep" size={16} color="#FF5555" />
                  <Text style={S.clearBtnText}>Svuota cronologia</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
