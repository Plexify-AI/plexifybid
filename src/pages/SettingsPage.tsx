// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Save, Plus, Trash2, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';

type TabKey = 'signature' | 'closing' | 'pricelist';

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

  // Load preferences on mount
  useEffect(() => {
    if (!token) return;
    loadPreferences();
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
    { key: 'signature', label: 'Email Signature' },
    { key: 'closing', label: 'Closing Message' },
    { key: 'pricelist', label: 'Price List' },
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
    </div>
  );
};

export default SettingsPage;
