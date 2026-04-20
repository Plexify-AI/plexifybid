// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Save, Plus, Trash2, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';

type TabKey = 'general' | 'factual' | 'voice' | 'signature' | 'closing' | 'pricelist' | 'branding';

// Category dropdown for factual corrections. Value is the raw `field` string
// persisted to the DB and consumed by server/lib/user-context.js. Label is
// what the user sees in the UI.
type FactualField =
  | 'company_name'
  | 'product_name'
  | 'person_name'
  | 'person_gender'
  | 'price'
  | 'other';

const FACTUAL_CATEGORY_OPTIONS: { value: FactualField; label: string }[] = [
  { value: 'company_name',   label: 'Company name' },
  { value: 'product_name',   label: 'Product name' },
  { value: 'person_name',    label: 'Person name' },
  { value: 'person_gender',  label: 'Person gender / pronouns' },
  { value: 'price',          label: 'Price' },
  { value: 'other',          label: 'Other' },
];

const FACTUAL_MAX_CORRECTIONS = 100;

interface Correction {
  id: string;
  field: FactualField | string;     // tolerate unknown field values from older seeds
  wrong_value: string;
  correct_value: string;
  scope?: string;
  created_at?: string;
}

function factualCategoryLabel(field: string): string {
  const hit = FACTUAL_CATEGORY_OPTIONS.find(o => o.value === field);
  if (hit) return hit.label;
  // Fall back to humanising snake_case so legacy data renders cleanly.
  return field
    ? field.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
    : 'Other';
}

function newCorrectionId(): string {
  try {
    // crypto.randomUUID is available in modern browsers; fall back if missing.
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Voice Corrections (Sprint B / B2) — captured auto from Deal Room "Teach Plexify" button.
interface VoiceCorrection {
  id: string;
  original_snippet: string;
  corrected_snippet: string;
  context?: string;
  created_at?: string;
}

const VOICE_MAX_CORRECTIONS = 50;

// Common IANA timezones — not exhaustive; user can't enter custom values
// in B1, but the backend stores whatever string is sent.
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— Not set —' },
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
  { value: 'Europe/London', label: 'UK (London)' },
  { value: 'Europe/Berlin', label: 'Central Europe (Berlin)' },
  { value: 'Australia/Sydney', label: 'Australia (Sydney)' },
  { value: 'UTC', label: 'UTC' },
];

interface PriceItem {
  product: string;
  sku: string;
  msrp: string;
  map: string;
  category: string;
}

interface Preferences {
  email_signature?: string;
  default_closing?: string;
  include_closing?: boolean;
  price_list?: PriceItem[];
  default_price_column?: string;
  price_note?: string;
}

const SettingsPage: React.FC = () => {
  const { token } = useSandbox();
  const [activeTab, setActiveTab] = useState<TabKey>('signature');
  const [prefs, setPrefs] = useState<Preferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Signature state
  const [signature, setSignature] = useState('');
  const [showSigPreview, setShowSigPreview] = useState(false);

  // Closing state
  const [closing, setClosing] = useState('Best regards,');
  const [includeClosing, setIncludeClosing] = useState(true);

  // Price list state
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [defaultPriceCol, setDefaultPriceCol] = useState('map');
  const [priceNote, setPriceNote] = useState('');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [newRow, setNewRow] = useState<PriceItem>({ product: '', sku: '', msrp: '', map: '', category: '' });
  const [showAddRow, setShowAddRow] = useState(false);

  // General-tab state (Sprint B / B1 — backed by /api/user-preferences/general)
  const [timezone, setTimezone] = useState('');

  // Factual corrections state (Sprint B / B5B — backed by /api/user-preferences/factual_corrections)
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [editingCorrectionId, setEditingCorrectionId] = useState<string | null>(null);
  const [newCorrection, setNewCorrection] = useState<{ field: FactualField; wrong_value: string; correct_value: string }>({
    field: 'company_name',
    wrong_value: '',
    correct_value: '',
  });
  const [showAddCorrection, setShowAddCorrection] = useState(false);

  // Voice corrections state (Sprint B / B2 — auto-captured by Deal Room "Teach Plexify")
  const [voiceCorrections, setVoiceCorrections] = useState<VoiceCorrection[]>([]);

  // Branding state (Brand DNA foundation, email slice v1 — /api/brand/email-images)
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroAltText, setHeroAltText] = useState('');
  const [footerImageUrl, setFooterImageUrl] = useState<string | null>(null);
  const [footerAltText, setFooterAltText] = useState('');
  const [brandingBusy, setBrandingBusy] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const heroFileRef = React.useRef<HTMLInputElement>(null);
  const footerFileRef = React.useRef<HTMLInputElement>(null);

  // Load preferences on mount
  useEffect(() => {
    if (!token) return;
    loadPreferences();
    loadGeneralPreferences();
    loadFactualCorrections();
    loadVoiceCorrections();
    loadBrandingImages();
  }, [token]);

  const loadPreferences = async () => {
    try {
      const res = await fetch('/api/preferences', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const p = data.preferences || {};
      setPrefs(p);
      setSignature(p.email_signature || '');
      setClosing(p.default_closing || 'Best regards,');
      setIncludeClosing(p.include_closing !== false);
      setPriceList(p.price_list || []);
      setDefaultPriceCol(p.default_price_column || 'map');
      setPriceNote(p.price_note || '');
    } catch (err) {
      console.error('[settings] Failed to load preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = useCallback(async (updates: Partial<Preferences>) => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPrefs(data.preferences || {});
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[settings] Failed to save:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [token]);

  const loadGeneralPreferences = async () => {
    try {
      const res = await fetch('/api/user-preferences/general', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const p = data.preferences || {};
      setTimezone(typeof p.timezone === 'string' ? p.timezone : '');
    } catch (err) {
      console.error('[settings] Failed to load general preferences:', err);
    }
  };

  const saveGeneralPreferences = useCallback(async (updates: Record<string, unknown>) => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/user-preferences/general', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[settings] Failed to save general:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [token]);

  const handleSaveGeneral = () => saveGeneralPreferences({ timezone });

  // --- Factual Corrections (B5B) -------------------------------------------

  const loadFactualCorrections = async () => {
    try {
      const res = await fetch('/api/user-preferences/factual_corrections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.preferences?.corrections) ? data.preferences.corrections : [];
      setCorrections(list);
    } catch (err) {
      console.error('[settings] Failed to load factual corrections:', err);
      setCorrections([]);
    }
  };

  const saveFactualCorrections = useCallback(async (list: Correction[]) => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/user-preferences/factual_corrections', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ corrections: list, max_corrections: FACTUAL_MAX_CORRECTIONS }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[settings] Failed to save factual corrections:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [token]);

  const handleSaveFactualCorrections = () => saveFactualCorrections(corrections);

  const handleAddCorrection = () => {
    const wrong = newCorrection.wrong_value.trim();
    const correct = newCorrection.correct_value.trim();
    if (!wrong || !correct) return;
    if (corrections.length >= FACTUAL_MAX_CORRECTIONS) return;
    const row: Correction = {
      id: newCorrectionId(),
      field: newCorrection.field,
      wrong_value: wrong,
      correct_value: correct,
      scope: 'global',
      created_at: new Date().toISOString(),
    };
    setCorrections([...corrections, row]);
    setNewCorrection({ field: 'company_name', wrong_value: '', correct_value: '' });
    setShowAddCorrection(false);
  };

  const handleDeleteCorrection = (id: string) => {
    setCorrections(corrections.filter(c => c.id !== id));
    if (editingCorrectionId === id) setEditingCorrectionId(null);
  };

  const handleUpdateCorrection = (id: string, patch: Partial<Correction>) => {
    setCorrections(corrections.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  // --- Voice Corrections (B2) ----------------------------------------------

  const loadVoiceCorrections = async () => {
    try {
      const res = await fetch('/api/user-preferences/voice_corrections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.preferences?.corrections) ? data.preferences.corrections : [];
      setVoiceCorrections(list);
    } catch (err) {
      console.error('[settings] Failed to load voice corrections:', err);
      setVoiceCorrections([]);
    }
  };

  const persistVoiceCorrections = useCallback(async (list: VoiceCorrection[]) => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/user-preferences/voice_corrections', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ corrections: list, max_corrections: VOICE_MAX_CORRECTIONS }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[settings] Failed to save voice corrections:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [token]);

  const handleDeleteVoiceCorrection = (id: string) => {
    const next = voiceCorrections.filter(c => c.id !== id);
    setVoiceCorrections(next);
    persistVoiceCorrections(next);
  };

  const handleClearAllVoiceCorrections = () => {
    if (!voiceCorrections.length) return;
    if (!window.confirm(`Clear all ${voiceCorrections.length} voice corrections? This cannot be undone.`)) return;
    setVoiceCorrections([]);
    persistVoiceCorrections([]);
  };

  // --- Branding (Brand DNA foundation, email slice v1) ---------------------

  const loadBrandingImages = async () => {
    try {
      const res = await fetch('/api/brand/email-images', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHeroImageUrl(data.hero_image_url || null);
      setHeroAltText(typeof data.hero_alt_text === 'string' ? data.hero_alt_text : '');
      setFooterImageUrl(data.footer_image_url || null);
      setFooterAltText(typeof data.footer_alt_text === 'string' ? data.footer_alt_text : '');
    } catch (err) {
      console.error('[settings] Failed to load branding images:', err);
    }
  };

  const handleUploadBranding = async () => {
    const heroFile = heroFileRef.current?.files?.[0] || null;
    const footerFile = footerFileRef.current?.files?.[0] || null;

    // Require alt text when a new file is selected. (Existing image + new alt
    // text without a new file is handled further down via alt-only save.)
    if (heroFile && !heroAltText.trim()) {
      setBrandingError('Hero alt text is required. Describe what the image shows.');
      return;
    }
    if (footerFile && !footerAltText.trim()) {
      setBrandingError('Footer alt text is required. Describe what the image shows.');
      return;
    }
    if (!heroFile && !footerFile) {
      // Allow saving alt-text only when the image already exists.
      if (!heroImageUrl && !footerImageUrl) {
        setBrandingError('Pick at least one image to upload.');
        return;
      }
    }

    setBrandingBusy(true);
    setBrandingError(null);
    setSaveStatus('idle');

    try {
      const form = new FormData();
      if (heroFile) form.append('hero', heroFile);
      if (footerFile) form.append('footer', footerFile);
      // Alt text is sent unconditionally — server only applies it to the side
      // that was uploaded in this request.
      form.append('hero_alt_text', heroAltText);
      form.append('footer_alt_text', footerAltText);

      const res = await fetch('/api/brand/email-images', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setHeroImageUrl(data.hero_image_url || heroImageUrl);
      setFooterImageUrl(data.footer_image_url || footerImageUrl);
      if (heroFileRef.current) heroFileRef.current.value = '';
      if (footerFileRef.current) footerFileRef.current.value = '';
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      console.error('[settings] Branding upload failed:', err);
      setBrandingError(err.message || 'Upload failed');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setBrandingBusy(false);
    }
  };

  const handleDeleteBranding = async (side: 'hero' | 'footer') => {
    if (!window.confirm(`Remove the ${side} image? This cannot be undone.`)) return;
    setBrandingBusy(true);
    setBrandingError(null);
    setSaveStatus('idle');
    try {
      const res = await fetch(`/api/brand/email-images?side=${side}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      if (side === 'hero') {
        setHeroImageUrl(null);
        setHeroAltText('');
        if (heroFileRef.current) heroFileRef.current.value = '';
      } else {
        setFooterImageUrl(null);
        setFooterAltText('');
        if (footerFileRef.current) footerFileRef.current.value = '';
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      console.error('[settings] Branding delete failed:', err);
      setBrandingError(err.message || 'Delete failed');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setBrandingBusy(false);
    }
  };

  function formatCapturedAt(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const handleSaveSignature = () => savePreferences({ email_signature: signature });
  const handleSaveClosing = () => savePreferences({ default_closing: closing, include_closing: includeClosing });
  const handleSavePriceList = () => savePreferences({
    price_list: priceList,
    default_price_column: defaultPriceCol,
    price_note: priceNote,
  });

  const handleAddRow = () => {
    if (!newRow.product.trim()) return;
    setPriceList([...priceList, { ...newRow }]);
    setNewRow({ product: '', sku: '', msrp: '', map: '', category: '' });
    setShowAddRow(false);
  };

  const handleDeleteRow = (index: number) => {
    setPriceList(priceList.filter((_, i) => i !== index));
  };

  const handleUpdateRow = (index: number, field: keyof PriceItem, value: string) => {
    const updated = [...priceList];
    updated[index] = { ...updated[index], [field]: value };
    setPriceList(updated);
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'factual', label: 'Factual Corrections' },
    { key: 'voice', label: 'Voice Corrections' },
    { key: 'signature', label: 'Email Signature' },
    { key: 'closing', label: 'Closing Message' },
    { key: 'pricelist', label: 'Price List' },
    { key: 'branding', label: 'Branding' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <Settings size={20} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-gray-400">Email preferences, signature, and price list</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800/40 rounded-lg p-1 border border-gray-700/40">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Save status indicator */}
      {saveStatus !== 'idle' && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
          saveStatus === 'saved' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' :
          'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {saveStatus === 'saved' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {saveStatus === 'saved' ? 'Saved' : 'Failed to save. Try again.'}
        </div>
      )}

      {/* ── GENERAL TAB (Sprint B / B1) ── */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">General Preferences</h3>
            <p className="text-xs text-gray-500 mb-4">
              Per-user settings. Stored separately from the tenant-wide email preferences.
            </p>

            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-2">Timezone</label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full max-w-md bg-gray-900/60 border border-gray-600/40 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
              >
                {TIMEZONE_OPTIONS.map(opt => (
                  <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Used by Powerflow to anchor your daily pipeline. Falls back to the tenant timezone when unset.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveGeneral}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save General
            </button>
          </div>
        </div>
      )}

      {/* ── FACTUAL CORRECTIONS TAB (Sprint B / B5B) ── */}
      {activeTab === 'factual' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">Factual Corrections</h3>
            <p className="text-xs text-gray-500 mb-4">
              Teach Plexify the exact terms to use in AI-generated content. These override
              the AI's default guesses and apply across AskPlexi, Deal Room generation, and all outreach.
            </p>

            {/* Table or empty state */}
            {corrections.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700/40">
                      <th className="pb-2 pr-3 font-medium w-48">Category</th>
                      <th className="pb-2 pr-3 font-medium">Wrong Value</th>
                      <th className="pb-2 pr-3 font-medium">Correct Value</th>
                      <th className="pb-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {corrections.map(item => (
                      <tr key={item.id} className="border-b border-gray-800/30 group">
                        <td className="py-2 pr-3">
                          {editingCorrectionId === item.id ? (
                            <select
                              value={item.field}
                              onChange={e => handleUpdateCorrection(item.id, { field: e.target.value })}
                              className="w-full bg-gray-900/60 border border-gray-600/40 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
                            >
                              {FACTUAL_CATEGORY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                              {/* Preserve unknown legacy field values */}
                              {!FACTUAL_CATEGORY_OPTIONS.some(o => o.value === item.field) && (
                                <option value={item.field}>{factualCategoryLabel(item.field)}</option>
                              )}
                            </select>
                          ) : (
                            <span
                              className="text-gray-300 text-xs uppercase tracking-wide cursor-pointer hover:text-white"
                              onClick={() => setEditingCorrectionId(item.id)}
                            >{factualCategoryLabel(item.field)}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 align-top">
                          {editingCorrectionId === item.id ? (
                            <input
                              value={item.wrong_value}
                              onChange={e => handleUpdateCorrection(item.id, { wrong_value: e.target.value })}
                              className="w-full bg-gray-900/60 border border-gray-600/40 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
                            />
                          ) : (
                            <span
                              className="text-red-300/80 cursor-pointer hover:text-red-200 break-words"
                              onClick={() => setEditingCorrectionId(item.id)}
                            >{item.wrong_value}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 align-top">
                          {editingCorrectionId === item.id ? (
                            <input
                              value={item.correct_value}
                              onChange={e => handleUpdateCorrection(item.id, { correct_value: e.target.value })}
                              className="w-full bg-gray-900/60 border border-gray-600/40 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
                            />
                          ) : (
                            <span
                              className="text-emerald-300 font-medium cursor-pointer hover:text-emerald-200 break-words"
                              onClick={() => setEditingCorrectionId(item.id)}
                            >{item.correct_value}</span>
                          )}
                        </td>
                        <td className="py-2 align-top">
                          {editingCorrectionId === item.id ? (
                            <button
                              onClick={() => setEditingCorrectionId(null)}
                              className="text-xs text-purple-400 hover:text-purple-300"
                            >Done</button>
                          ) : (
                            <button
                              onClick={() => handleDeleteCorrection(item.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                              title="Delete correction"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                No factual corrections yet. Add your first one below.
              </div>
            )}

            {/* Add row form */}
            {showAddCorrection ? (
              <div className="mt-4 p-4 bg-gray-900/40 rounded-lg border border-gray-700/30 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={newCorrection.field}
                    onChange={e => setNewCorrection({ ...newCorrection, field: e.target.value as FactualField })}
                    className="bg-gray-900/60 border border-gray-600/40 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
                  >
                    {FACTUAL_CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    value={newCorrection.wrong_value}
                    onChange={e => setNewCorrection({ ...newCorrection, wrong_value: e.target.value })}
                    placeholder='Wrong value (e.g. "Multivision")'
                    className="bg-gray-900/60 border border-gray-600/40 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                  <input
                    value={newCorrection.correct_value}
                    onChange={e => setNewCorrection({ ...newCorrection, correct_value: e.target.value })}
                    placeholder='Correct value (e.g. "Multivista")'
                    className="bg-gray-900/60 border border-gray-600/40 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddCorrection}
                    disabled={!newCorrection.wrong_value.trim() || !newCorrection.correct_value.trim()}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                  >Add Correction</button>
                  <button
                    onClick={() => {
                      setShowAddCorrection(false);
                      setNewCorrection({ field: 'company_name', wrong_value: '', correct_value: '' });
                    }}
                    className="px-4 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCorrection(true)}
                disabled={corrections.length >= FACTUAL_MAX_CORRECTIONS}
                className="mt-4 flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={corrections.length >= FACTUAL_MAX_CORRECTIONS ? 'Maximum 100 corrections reached' : undefined}
              >
                <Plus size={14} /> Add Correction
              </button>
            )}

            {corrections.length > 0 && (
              <div className="mt-4 text-xs text-gray-500">
                {corrections.length} correction{corrections.length !== 1 ? 's' : ''} configured
                {corrections.length >= FACTUAL_MAX_CORRECTIONS ? ' — at cap' : ''}.
                Changes apply after you click "Save Corrections" below.
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveFactualCorrections}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Corrections
            </button>
          </div>
        </div>
      )}

      {/* ── VOICE CORRECTIONS TAB (Sprint B / B2) ── */}
      {activeTab === 'voice' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">Voice Corrections</h3>
                <p className="text-xs text-gray-500">
                  Style edits Plexify has learned from your revisions to AI-generated content.
                  Captured when you click <span className="text-purple-300">"Teach Plexify"</span> in the Deal Room editor.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs">
                  {voiceCorrections.length} learned
                  {voiceCorrections.length >= VOICE_MAX_CORRECTIONS ? ' (cap)' : ''}
                </span>
                {voiceCorrections.length > 0 && (
                  <button
                    onClick={handleClearAllVoiceCorrections}
                    className="text-xs text-gray-400 hover:text-red-300 transition-colors"
                  >Clear all</button>
                )}
              </div>
            </div>

            {voiceCorrections.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700/40">
                      <th className="pb-2 pr-3 font-medium w-40">Context</th>
                      <th className="pb-2 pr-3 font-medium">AI wrote</th>
                      <th className="pb-2 pr-3 font-medium">You changed to</th>
                      <th className="pb-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {voiceCorrections.map(item => (
                      <tr key={item.id} className="border-b border-gray-800/30 group align-top">
                        <td className="py-2 pr-3 align-top">
                          <div className="text-xs text-gray-400 font-mono break-words">
                            {item.context || '—'}
                          </div>
                          {item.created_at && (
                            <div className="text-[10px] text-gray-600 mt-1">
                              {formatCapturedAt(item.created_at)}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 align-top">
                          <span className="text-red-300/80 break-words">{item.original_snippet}</span>
                        </td>
                        <td className="py-2 pr-3 align-top">
                          <span className="text-emerald-300 font-medium break-words">{item.corrected_snippet}</span>
                        </td>
                        <td className="py-2 align-top">
                          <button
                            onClick={() => handleDeleteVoiceCorrection(item.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                            title="Delete this correction"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500 text-sm">
                No style corrections captured yet.<br/>
                Edit an AI-generated Deal Room artifact and click <span className="text-purple-300">"Teach Plexify"</span> — Plexify will learn your style patterns.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SIGNATURE TAB ── */}
      {activeTab === 'signature' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">Email Signature</h3>
            <p className="text-xs text-gray-500 mb-4">
              HTML signature appended to all outreach emails (single and batch). Supports rich HTML with images, links, and formatting.
            </p>
            <textarea
              value={signature}
              onChange={e => setSignature(e.target.value)}
              placeholder="Paste your HTML signature here, or type plain text..."
              rows={10}
              className="w-full bg-gray-900/60 border border-gray-600/40 rounded-lg p-3 text-sm text-gray-200 font-mono placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-y"
            />

            {/* Preview toggle */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => setShowSigPreview(!showSigPreview)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                {showSigPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                {showSigPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>

            {showSigPreview && signature && (
              <div className="mt-3 p-4 bg-white rounded-lg border border-gray-300">
                <div dangerouslySetInnerHTML={{ __html: signature }} />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSignature}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Signature
            </button>
          </div>
        </div>
      )}

      {/* ── CLOSING TAB ── */}
      {activeTab === 'closing' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">Default Closing</h3>
            <p className="text-xs text-gray-500 mb-4">
              Controls how AI-generated emails end. The closing phrase replaces generic sign-offs like "Best regards."
            </p>

            {/* Toggle */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setIncludeClosing(!includeClosing)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  includeClosing ? 'bg-purple-600' : 'bg-gray-600'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  includeClosing ? 'left-[22px]' : 'left-0.5'
                }`} />
              </button>
              <span className="text-sm text-gray-300">
                {includeClosing ? 'Include closing phrase' : 'No closing phrase — end after content'}
              </span>
            </div>

            {includeClosing && (
              <input
                type="text"
                value={closing}
                onChange={e => setClosing(e.target.value)}
                placeholder="e.g. Cheers, / Talk soon, / Best,"
                className="w-full max-w-md bg-gray-900/60 border border-gray-600/40 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              />
            )}

            {/* Preview */}
            <div className="mt-4 p-3 bg-gray-900/40 rounded-lg border border-gray-700/30">
              <p className="text-xs text-gray-500 mb-2">Preview (end of email):</p>
              <div className="text-sm text-gray-300">
                <p className="text-gray-400 italic">...last paragraph of email content.</p>
                {includeClosing && (
                  <>
                    <p className="mt-3">{closing}</p>
                    <p>[Your Name]</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveClosing}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Closing
            </button>
          </div>
        </div>
      )}

      {/* ── PRICE LIST TAB ── */}
      {activeTab === 'pricelist' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">Product Price List</h3>
            <p className="text-xs text-gray-500 mb-4">
              Prices injected into AI-generated emails. The LLM uses ONLY these values — no guessing or rounding.
            </p>

            {/* Default price column */}
            <div className="mb-4 flex items-center gap-3">
              <label className="text-sm text-gray-400">Default pricing column:</label>
              <select
                value={defaultPriceCol}
                onChange={e => setDefaultPriceCol(e.target.value)}
                className="bg-gray-900/60 border border-gray-600/40 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value="map">MAP (Minimum Advertised)</option>
                <option value="msrp">MSRP (List Price)</option>
              </select>
            </div>

            {/* Price note */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-1">Pricing instructions for AI:</label>
              <input
                type="text"
                value={priceNote}
                onChange={e => setPriceNote(e.target.value)}
                placeholder="e.g. Use MAP pricing in all outreach unless user explicitly requests MSRP."
                className="w-full bg-gray-900/60 border border-gray-600/40 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Price table */}
            {priceList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700/40">
                      <th className="pb-2 pr-3 font-medium">Product</th>
                      <th className="pb-2 pr-3 font-medium">SKU</th>
                      <th className="pb-2 pr-3 font-medium">MSRP</th>
                      <th className="pb-2 pr-3 font-medium">MAP</th>
                      <th className="pb-2 pr-3 font-medium">Category</th>
                      <th className="pb-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceList.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-800/30 group">
                        <td className="py-2 pr-3">
                          {editingRow === idx ? (
                            <input
                              value={item.product}
                              onChange={e => handleUpdateRow(idx, 'product', e.target.value)}
                              className="w-full bg-gray-900/60 border border-gray-600/40 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
                            />
                          ) : (
                            <span
                              className="text-gray-200 cursor-pointer hover:text-white"
                              onClick={() => setEditingRow(idx)}
                            >{item.product}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {editingRow === idx ? (
                            <input
                              value={item.sku}
                              onChange={e => handleUpdateRow(idx, 'sku', e.target.value)}
                              className="w-28 bg-gray-900/60 border border-gray-600/40 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
                            />
                          ) : (
                            <span className="text-gray-400 font-mono text-xs">{item.sku}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {editingRow === idx ? (
                            <input
                              value={item.msrp}
                              onChange={e => handleUpdateRow(idx, 'msrp', e.target.value)}
                              className="w-24 bg-gray-900/60 border border-gray-600/40 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
                            />
                          ) : (
                            <span className="text-gray-300">{item.msrp}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {editingRow === idx ? (
                            <input
                              value={item.map}
                              onChange={e => handleUpdateRow(idx, 'map', e.target.value)}
                              className="w-24 bg-gray-900/60 border border-gray-600/40 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
                            />
                          ) : (
                            <span className="text-emerald-400 font-medium">{item.map}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {editingRow === idx ? (
                            <input
                              value={item.category}
                              onChange={e => handleUpdateRow(idx, 'category', e.target.value)}
                              className="w-28 bg-gray-900/60 border border-gray-600/40 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50"
                            />
                          ) : (
                            <span className="text-gray-500 text-xs">{item.category}</span>
                          )}
                        </td>
                        <td className="py-2">
                          {editingRow === idx ? (
                            <button
                              onClick={() => setEditingRow(null)}
                              className="text-xs text-purple-400 hover:text-purple-300"
                            >Done</button>
                          ) : (
                            <button
                              onClick={() => handleDeleteRow(idx)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                No products configured. Add your first product below.
              </div>
            )}

            {/* Add row form */}
            {showAddRow ? (
              <div className="mt-4 p-4 bg-gray-900/40 rounded-lg border border-gray-700/30 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={newRow.product}
                    onChange={e => setNewRow({ ...newRow, product: e.target.value })}
                    placeholder="Product name"
                    className="bg-gray-900/60 border border-gray-600/40 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                  <input
                    value={newRow.sku}
                    onChange={e => setNewRow({ ...newRow, sku: e.target.value })}
                    placeholder="SKU"
                    className="bg-gray-900/60 border border-gray-600/40 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                  <input
                    value={newRow.msrp}
                    onChange={e => setNewRow({ ...newRow, msrp: e.target.value })}
                    placeholder="MSRP (e.g. $249.99)"
                    className="bg-gray-900/60 border border-gray-600/40 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                  <input
                    value={newRow.map}
                    onChange={e => setNewRow({ ...newRow, map: e.target.value })}
                    placeholder="MAP (e.g. $199.99)"
                    className="bg-gray-900/60 border border-gray-600/40 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                  <input
                    value={newRow.category}
                    onChange={e => setNewRow({ ...newRow, category: e.target.value })}
                    placeholder="Category"
                    className="bg-gray-900/60 border border-gray-600/40 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddRow}
                    disabled={!newRow.product.trim()}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                  >Add Product</button>
                  <button
                    onClick={() => { setShowAddRow(false); setNewRow({ product: '', sku: '', msrp: '', map: '', category: '' }); }}
                    className="px-4 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddRow(true)}
                className="mt-4 flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <Plus size={14} /> Add Product
              </button>
            )}

            {priceList.length > 0 && (
              <div className="mt-4 text-xs text-gray-500">
                {priceList.length} product{priceList.length !== 1 ? 's' : ''} configured.
                Changes are saved when you click "Save Price List" below.
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSavePriceList}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Price List
            </button>
          </div>
        </div>
      )}

      {/* ── BRANDING TAB (Brand DNA foundation, email slice v1) ── */}
      {activeTab === 'branding' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">Email Branding</h3>
            <p className="text-xs text-gray-500 mb-4">
              Hero and footer images appended to every AskPlexi email draft. PNG, JPEG, or WEBP.
              Max 2MB per image. Alt text is required — it's what the recipient sees when their
              email client disables images (which also reduces spam flags).
            </p>

            {brandingError && (
              <div className="mb-4 px-4 py-2 rounded-lg text-sm flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400">
                <AlertTriangle size={14} />
                {brandingError}
              </div>
            )}

            {/* Hero block */}
            <div className="mb-6 pb-6 border-b border-gray-700/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-200">Hero image</h4>
                  <p className="text-xs text-gray-500">Appears at the top of every email, above the body.</p>
                </div>
                {heroImageUrl && (
                  <button
                    onClick={() => handleDeleteBranding('hero')}
                    disabled={brandingBusy}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>

              {heroImageUrl ? (
                <div className="mb-3 p-3 rounded-lg bg-gray-900/40 border border-gray-700/30">
                  <img
                    src={heroImageUrl}
                    alt={heroAltText || 'Hero image preview'}
                    className="max-w-full max-h-40 rounded"
                  />
                  <p className="text-xs text-gray-500 mt-2 break-all">{heroImageUrl}</p>
                </div>
              ) : (
                <div className="mb-3 p-6 rounded-lg bg-gray-900/40 border border-dashed border-gray-700/50 text-center text-xs text-gray-500">
                  No hero image configured.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs text-gray-400 block">
                  {heroImageUrl ? 'Replace hero image' : 'Upload hero image'}
                </label>
                <input
                  ref={heroFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full text-sm text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-purple-600/30 file:text-purple-200 hover:file:bg-purple-600/40 file:cursor-pointer"
                />
                <label className="text-xs text-gray-400 block mt-3">
                  Hero alt text <span className="text-red-400">*</span>
                </label>
                <input
                  value={heroAltText}
                  onChange={e => setHeroAltText(e.target.value)}
                  placeholder="e.g. SunnAx Technologies — award-winning drawing tablets"
                  className="w-full bg-gray-900/60 border border-gray-600/40 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
                <p className="text-xs text-gray-500">
                  Describe what the image shows for email clients that disable images — reduces spam flags.
                </p>
              </div>
            </div>

            {/* Footer block */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-200">Footer image</h4>
                  <p className="text-xs text-gray-500">Appears at the bottom of every email, below the signature.</p>
                </div>
                {footerImageUrl && (
                  <button
                    onClick={() => handleDeleteBranding('footer')}
                    disabled={brandingBusy}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>

              {footerImageUrl ? (
                <div className="mb-3 p-3 rounded-lg bg-gray-900/40 border border-gray-700/30">
                  <img
                    src={footerImageUrl}
                    alt={footerAltText || 'Footer image preview'}
                    className="max-w-full max-h-40 rounded"
                  />
                  <p className="text-xs text-gray-500 mt-2 break-all">{footerImageUrl}</p>
                </div>
              ) : (
                <div className="mb-3 p-6 rounded-lg bg-gray-900/40 border border-dashed border-gray-700/50 text-center text-xs text-gray-500">
                  No footer image configured.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs text-gray-400 block">
                  {footerImageUrl ? 'Replace footer image' : 'Upload footer image'}
                </label>
                <input
                  ref={footerFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full text-sm text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-purple-600/30 file:text-purple-200 hover:file:bg-purple-600/40 file:cursor-pointer"
                />
                <label className="text-xs text-gray-400 block mt-3">
                  Footer alt text <span className="text-red-400">*</span>
                </label>
                <input
                  value={footerAltText}
                  onChange={e => setFooterAltText(e.target.value)}
                  placeholder="e.g. SunnAx — visit sunnax.com to learn more"
                  className="w-full bg-gray-900/60 border border-gray-600/40 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
                <p className="text-xs text-gray-500">
                  Describe what the image shows for email clients that disable images — reduces spam flags.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleUploadBranding}
              disabled={brandingBusy}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {brandingBusy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Branding
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
