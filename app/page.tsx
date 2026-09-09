'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleStop,
  Clock3,
  Download,
  ExternalLink,
  FileDown,
  FileImage,
  FileUp,
  GitCommitHorizontal,
  LayoutDashboard,
  Play,
  Plus,
  ReceiptText,
  Settings,
  TimerReset,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Entry = {
  id: number;
  task: string;
  client: string;
  hourlyRateCents: number;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  status: 'running' | 'completed';
  commitUrl: string | null;
  screenshotUrl: string | null;
  notes: string | null;
};

type View = 'dashboard' | 'report' | 'clients' | 'settings';
type SettingsData = {
  displayName: string;
  initials: string;
  defaultRateCents: number;
  currency: string;
  timezone: string;
  weekStartsOn: number;
};

const dayFormatter = new Intl.DateTimeFormat('en-AU', { weekday: 'short' });
const dateFormatter = new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat('en-AU', { hour: '2-digit', minute: '2-digit' });
const moneyFormatter = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins.toString().padStart(2, '0')}m` : `${mins}m`;
}

function getMonday(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = '';
    } else cell += character;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function csvDateTime(date: string, time: string, fallbackYear: number) {
  const value = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T${time}:00`).toISOString();
  const parsed = new Date(`${value} ${fallbackYear} ${time}`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Could not read date “${date}”.`);
  return parsed.toISOString();
}

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [task, setTask] = useState('');
  const [client, setClient] = useState('');
  const [rate, setRate] = useState('150');
  const [commitUrl, setCommitUrl] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTask, setManualTask] = useState('');
  const [manualClient, setManualClient] = useState('');
  const [manualRate, setManualRate] = useState('150');
  const [manualDate, setManualDate] = useState(localDateValue());
  const [manualStart, setManualStart] = useState('09:00');
  const [manualEnd, setManualEnd] = useState('10:00');
  const [manualCommit, setManualCommit] = useState('');
  const [manualScreenshot, setManualScreenshot] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [reportWeekStart, setReportWeekStart] = useState(() => getMonday());
  const [settings, setSettings] = useState<SettingsData>({ displayName: 'Sabrina', initials: 'SB', defaultRateCents: 15000, currency: 'AUD', timezone: 'Australia/Sydney', weekStartsOn: 1 });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const importInput = useRef<HTMLInputElement>(null);

  const running = entries.find((entry) => entry.status === 'running');

  useEffect(() => {
    fetch('/api/entries')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setEntries(data.entries);
      })
      .catch((reason) => setError(reason.message || 'Unable to load your time entries.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setSettings(data.settings);
        setRate(String(data.settings.defaultRateCents / 100));
        setManualRate(String(data.settings.defaultRateCents / 100));
      })
      .catch((reason) => setError(reason.message || 'Unable to load settings.'));
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const weekStart = getMonday();
  const weekEntries = entries.filter((entry) => new Date(entry.startedAt) >= weekStart);
  const completed = weekEntries.filter((entry) => entry.status === 'completed');
  const totalMinutes = completed.reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);
  const totalValue = completed.reduce((sum, entry) => sum + ((entry.durationMinutes ?? 0) / 60) * (entry.hourlyRateCents / 100), 0);
  const clients = new Set(completed.map((entry) => entry.client)).size;

  const dailyTotals = useMemo(() => {
    return Array.from({ length: 5 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      const minutes = completed.filter((entry) => new Date(entry.startedAt).toDateString() === date.toDateString()).reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);
      return { label: dayFormatter.format(date), minutes };
    });
  }, [completed, weekStart]);
  const maxDaily = Math.max(480, ...dailyTotals.map((day) => day.minutes));

  const reportWeekEnd = new Date(reportWeekStart);
  reportWeekEnd.setDate(reportWeekEnd.getDate() + 7);
  const reportEntries = entries.filter((entry) => entry.status === 'completed' && new Date(entry.startedAt) >= reportWeekStart && new Date(entry.startedAt) < reportWeekEnd);
  const reportMinutes = reportEntries.reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);
  const reportValue = reportEntries.reduce((sum, entry) => sum + ((entry.durationMinutes ?? 0) / 60) * (entry.hourlyRateCents / 100), 0);
  const clientStats = Array.from(new Set(entries.filter((entry) => entry.status === 'completed').map((entry) => entry.client))).map((clientName) => {
    const clientEntries = entries.filter((entry) => entry.status === 'completed' && entry.client === clientName);
    return {
      name: clientName,
      entries: clientEntries.length,
      minutes: clientEntries.reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0),
      value: clientEntries.reduce((sum, entry) => sum + ((entry.durationMinutes ?? 0) / 60) * (entry.hourlyRateCents / 100), 0),
      lastActive: clientEntries.map((entry) => new Date(entry.startedAt)).sort((a, b) => b.getTime() - a.getTime())[0],
    };
  }).sort((a, b) => b.value - a.value);

  async function startTimer(event: React.FormEvent) {
    event.preventDefault();
    if (running) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', task, client, hourlyRate: Number(rate) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEntries((current) => [data.entry, ...current]);
      setNow(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to start timer.');
    } finally {
      setSaving(false);
    }
  }

  async function stopTimer() {
    if (!running) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop', id: running.id, commitUrl, screenshotUrl, notes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEntries((current) => current.map((entry) => entry.id === data.entry.id ? data.entry : entry));
      setTask(''); setClient(''); setCommitUrl(''); setScreenshotUrl(''); setNotes('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to stop timer.');
    } finally {
      setSaving(false);
    }
  }

  async function addPastWork(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual',
          task: manualTask,
          client: manualClient,
          hourlyRate: Number(manualRate),
          startedAt: new Date(`${manualDate}T${manualStart}:00`).toISOString(),
          endedAt: new Date(`${manualDate}T${manualEnd}:00`).toISOString(),
          commitUrl: manualCommit,
          screenshotUrl: manualScreenshot,
          notes: manualNotes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEntries((current) => [data.entry, ...current]);
      setManualOpen(false);
      setManualTask(''); setManualClient(''); setManualCommit(''); setManualScreenshot(''); setManualNotes('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add past work.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry: Entry) {
    const confirmed = window.confirm(
      `Delete “${entry.task}”? This cannot be undone.`,
    );
    if (!confirmed) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/entries?id=${entry.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEntries((current) => current.filter((item) => item.id !== data.deletedId));
      if (entry.status === 'running') {
        setTask(''); setClient(''); setCommitUrl(''); setScreenshotUrl(''); setNotes('');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete entry.');
    } finally {
      setSaving(false);
    }
  }

  function exportReport(records: Entry[] = completed, startDate: Date = weekStart) {
    const rows = [['Task', 'Client', 'Date', 'Started', 'Ended', 'Hours', 'Rate AUD', 'Value AUD', 'Commit', 'Screenshot', 'Notes', 'Started At ISO', 'Ended At ISO']];
    records.forEach((entry) => rows.push([entry.task, entry.client, dateFormatter.format(new Date(entry.startedAt)), timeFormatter.format(new Date(entry.startedAt)), entry.endedAt ? timeFormatter.format(new Date(entry.endedAt)) : '', ((entry.durationMinutes ?? 0) / 60).toFixed(2), (entry.hourlyRateCents / 100).toFixed(2), (((entry.durationMinutes ?? 0) / 60) * (entry.hourlyRateCents / 100)).toFixed(2), entry.commitUrl ?? '', entry.screenshotUrl ?? '', entry.notes ?? '', entry.startedAt, entry.endedAt ?? '']));
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `time-report-${startDate.toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportEvidencePdf(records: Entry[] = reportEntries, startDate: Date = reportWeekStart) {
    if (!records.length) { setError('Add or import at least one completed entry before exporting a PDF.'); return; }
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setError('Your browser blocked the PDF window. Allow pop-ups and try again.'); return; }
    printWindow.opener = null;
    const document = printWindow.document;
    document.title = `Time report ${startDate.toISOString().slice(0, 10)}`;
    document.head.innerHTML = '<style>@page{margin:18mm}body{color:#202522;font:12px Arial,sans-serif}h1{font-size:25px;margin:0 0 5px}h2{font-size:16px;margin:0}p{color:#626b66;margin:0 0 18px}.summary{display:flex;gap:25px;border:1px solid #d7ddd8;padding:13px 15px;margin:20px 0}.summary strong{display:block;color:#202522;font-size:16px}.entry{break-inside:avoid;border-top:1px solid #d7ddd8;padding:18px 0}.meta{display:flex;justify-content:space-between;gap:18px;margin-top:6px}.notes{margin-top:10px;color:#454d48}.evidence{margin-top:13px}.evidence img{display:block;max-width:100%;max-height:130mm;border:1px solid #d7ddd8;border-radius:4px}.muted{color:#727a75;font-size:11px}@media print{.entry{page-break-inside:avoid}}</style>';
    const body = document.body;
    const heading = document.createElement('h1'); heading.textContent = 'Weekly time report'; body.append(heading);
    const subtitle = document.createElement('p'); subtitle.textContent = `${dateFormatter.format(startDate)} – ${dateFormatter.format(new Date(startDate.getTime() + 6 * 86400000))} · Evidence included`; body.append(subtitle);
    const summary = document.createElement('div'); summary.className = 'summary';
    [['Hours worked', formatDuration(records.reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0))], ['Billable value', moneyFormatter.format(records.reduce((sum, entry) => sum + ((entry.durationMinutes ?? 0) / 60) * (entry.hourlyRateCents / 100), 0))], ['Entries', String(records.length)]].forEach(([label, value]) => { const item = document.createElement('div'); const name = document.createElement('span'); name.textContent = label; const amount = document.createElement('strong'); amount.textContent = value; item.append(name, amount); summary.append(item); });
    body.append(summary);
    records.forEach((entry) => {
      const section = document.createElement('section'); section.className = 'entry';
      const title = document.createElement('h2'); title.textContent = entry.task; section.append(title);
      const meta = document.createElement('div'); meta.className = 'meta'; const left = document.createElement('span'); left.textContent = `${entry.client} · ${dateFormatter.format(new Date(entry.startedAt))}`; const right = document.createElement('span'); right.textContent = `${timeFormatter.format(new Date(entry.startedAt))} – ${entry.endedAt ? timeFormatter.format(new Date(entry.endedAt)) : ''} · ${formatDuration(entry.durationMinutes ?? 0)} · ${moneyFormatter.format(((entry.durationMinutes ?? 0) / 60) * (entry.hourlyRateCents / 100))}`; meta.append(left, right); section.append(meta);
      if (entry.notes) { const notes = document.createElement('div'); notes.className = 'notes'; notes.textContent = entry.notes; section.append(notes); }
      if (entry.screenshotUrl) { const evidence = document.createElement('div'); evidence.className = 'evidence'; const label = document.createElement('div'); label.className = 'muted'; label.textContent = 'Screenshot evidence'; const image = document.createElement('img'); image.src = entry.screenshotUrl; image.alt = `Screenshot evidence for ${entry.task}`; image.onerror = () => { image.remove(); const unavailable = document.createElement('div'); unavailable.className = 'muted'; unavailable.textContent = `Image unavailable: ${entry.screenshotUrl}`; evidence.append(unavailable); }; evidence.append(label, image); section.append(evidence); }
      body.append(section);
    });
    const images = Array.from(document.images);
    Promise.race([Promise.all(images.map((image) => new Promise<void>((resolve) => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => resolve(), { once: true }); }))), new Promise((resolve) => window.setTimeout(resolve, 4000))]).then(() => { printWindow.focus(); printWindow.print(); });
  }

  async function importReport(file: File) {
    setSaving(true); setError(''); setImportMessage('');
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error('This CSV does not contain any work entries.');
      const headings = rows[0].map((heading) => heading.trim().toLowerCase());
      const column = (name: string) => headings.indexOf(name.toLowerCase());
      const required = ['task', 'client', 'date', 'started', 'ended', 'rate aud'];
      if (required.some((name) => column(name) < 0)) throw new Error('Choose a CSV exported by Time Tracker.');
      const weekMatch = file.name.match(/time-report-(\d{4})-\d{2}-\d{2}/);
      const fallbackYear = weekMatch ? Number(weekMatch[1]) : new Date().getFullYear();
      const imported = rows.slice(1).map((row) => {
        const value = (name: string) => row[column(name)]?.trim() ?? '';
        const startedAt = value('started at iso') || csvDateTime(value('date'), value('started'), fallbackYear);
        const endedAt = value('ended at iso') || csvDateTime(value('date'), value('ended'), fallbackYear);
        return { task: value('task'), client: value('client'), hourlyRate: Number(value('rate aud')), startedAt, endedAt, commitUrl: value('commit'), screenshotUrl: value('screenshot'), notes: value('notes') };
      });
      const response = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'import', entries: imported }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEntries((current) => [...data.entries, ...current]);
      const importedWeek = new Date(imported[0].startedAt); setReportWeekStart(getMonday(importedWeek)); setActiveView('report');
      setImportMessage(`${data.entries.length} ${data.entries.length === 1 ? 'entry' : 'entries'} imported.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to import this CSV.'); }
    finally { setSaving(false); if (importInput.current) importInput.current.value = ''; }
  }

  function moveReportWeek(direction: number) {
    setReportWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + direction * 7);
      return next;
    });
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSettingsSaved(false);
    setError('');
    try {
      const response = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: settings.displayName, initials: settings.initials, defaultRate: settings.defaultRateCents / 100 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSettings(data.settings);
      setRate(String(data.settings.defaultRateCents / 100));
      setManualRate(String(data.settings.defaultRateCents / 100));
      setSettingsSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  }

  const elapsedSeconds = running ? Math.max(0, Math.floor((now - new Date(running.startedAt).getTime()) / 1000)) : 0;
  const elapsed = `${Math.floor(elapsedSeconds / 3600).toString().padStart(2, '0')}:${Math.floor((elapsedSeconds % 3600) / 60).toString().padStart(2, '0')}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`;

  return (
    <main className="min-h-screen bg-[#e7e8e4] text-[#252a27]">
      <input ref={importInput} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importReport(file); }} />
      <aside className="fixed inset-y-0 left-0 hidden w-[78px] flex-col items-center border-r border-[#ced1cc] bg-[#d9dcd7] py-6 md:flex">
        <div className="grid size-10 place-items-center rounded-[15px] bg-[#28332e] text-sm font-black text-[#d8c0b5]">TT</div>
        <nav className="mt-12 flex flex-col gap-3" aria-label="Primary navigation">
          <button className={`nav-icon ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')} aria-label="Dashboard" title="Dashboard"><LayoutDashboard /></button>
          <button className={`nav-icon ${activeView === 'report' ? 'active' : ''}`} onClick={() => setActiveView('report')} aria-label="Weekly report" title="Weekly report"><BarChart3 /></button>
          <button className={`nav-icon ${activeView === 'clients' ? 'active' : ''}`} onClick={() => setActiveView('clients')} aria-label="Clients" title="Clients"><ReceiptText /></button>
        </nav>
        <button className={`nav-icon mt-auto ${activeView === 'settings' ? 'active' : ''}`} onClick={() => setActiveView('settings')} aria-label="Settings" title="Settings"><Settings /></button>
      </aside>

      <div className="md:pl-[78px]">
        <header className="flex h-[72px] items-center justify-between border-b border-[#dedbd2] px-5 md:px-8 lg:px-10">
          <div><p className="text-sm font-bold tracking-[-.02em]">Time Tracker</p><p className="text-[11px] text-[#727a75]">Work log & evidence</p></div>
          <div className="flex items-center gap-3"><span className="hidden text-xs text-[#67706b] sm:inline">Week of {dateFormatter.format(weekStart)}</span><button onClick={() => setActiveView('settings')} className="grid size-9 place-items-center rounded-full bg-[#36423c] text-xs font-bold text-white" aria-label="Open settings">{settings.initials}</button></div>
        </header>

        <nav className="mobile-nav md:hidden" aria-label="Mobile navigation">
          <button className={activeView === 'dashboard' ? 'active' : ''} onClick={() => setActiveView('dashboard')}><LayoutDashboard />Today</button>
          <button className={activeView === 'report' ? 'active' : ''} onClick={() => setActiveView('report')}><BarChart3 />Reports</button>
          <button className={activeView === 'clients' ? 'active' : ''} onClick={() => setActiveView('clients')}><ReceiptText />Clients</button>
          <button className={activeView === 'settings' ? 'active' : ''} onClick={() => setActiveView('settings')}><Settings />Settings</button>
        </nav>

        <div className="mx-auto max-w-[1480px] px-5 py-7 md:px-8 lg:px-10">
          {error && <div role="alert" className="mb-5 rounded-xl border border-[#b98676] bg-[#eadbd5] px-4 py-3 text-sm text-[#743f31]">{error}</div>}
          {activeView === 'dashboard' && <>
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="kicker">Today · {dateFormatter.format(new Date())}</p><h1 className="mt-1 text-3xl font-bold tracking-[-.05em] md:text-[2.6rem]">Track the work. Prove the value.</h1></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-10 rounded-xl border-[#bec3bd] bg-[#f6f6f3] px-4" onClick={() => setManualOpen(true)}><Plus /> Add past work</Button><Button variant="outline" className="h-10 rounded-xl border-[#bec3bd] bg-[#f6f6f3] px-4" onClick={() => importInput.current?.click()} disabled={saving}><FileUp /> Import week</Button><Button variant="outline" className="h-10 rounded-xl border-[#bec3bd] bg-[#f6f6f3] px-4" onClick={() => exportReport()}><Download /> Export week</Button></div>
          </div>

          <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <div className="overflow-hidden rounded-[22px] border border-[#353e39] bg-[#252c28] text-white shadow-[0_18px_50px_rgba(40,39,34,.09)]">
              <div className="grid gap-8 p-6 lg:grid-cols-[1fr_auto] lg:p-8">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#d8c0b5]"><span className={`size-2 rounded-full ${running ? 'animate-pulse bg-[#b77a65]' : 'bg-white/30'}`} />{running ? 'Timer running' : 'Ready to focus'}</div>
                  {running ? <><h2 className="mt-4 text-2xl font-semibold tracking-[-.04em]">{running.task}</h2><p className="mt-1 text-sm text-white/55">{running.client} · {moneyFormatter.format(running.hourlyRateCents / 100)}/hr</p></> : <><h2 className="mt-4 text-2xl font-semibold tracking-[-.04em]">What are you working on?</h2><p className="mt-1 text-sm text-white/50">Set the task, client and rate before you start.</p></>}
                </div>
                <div className="font-mono text-[clamp(2.6rem,6vw,4.8rem)] font-medium leading-none tracking-[-.08em] tabular-nums text-[#f6f4ed]">{elapsed}</div>
              </div>

              {!running ? (
                <form onSubmit={startTimer} className="grid gap-3 border-t border-white/10 bg-white/[.04] p-5 md:grid-cols-[1.6fr_1fr_120px_auto] md:p-6">
                  <label className="field-label"><span>Task</span><Input value={task} onChange={(event) => setTask(event.target.value)} placeholder="e.g. Booking flow API" required className="timer-input" /></label>
                  <label className="field-label"><span>Client</span><Input value={client} onChange={(event) => setClient(event.target.value)} placeholder="Client name" required className="timer-input" /></label>
                  <label className="field-label"><span>Rate / hr</span><Input value={rate} onChange={(event) => setRate(event.target.value)} min="0" step="1" type="number" required className="timer-input" /></label>
                  <Button disabled={saving} type="submit" className="mt-auto h-11 rounded-xl bg-[#a86e5b] px-5 font-bold text-white hover:bg-[#925b49]"><Play fill="currentColor" /> Start</Button>
                </form>
              ) : (
                <div className="border-t border-white/10 bg-white/[.04] p-5 md:p-6">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <label className="field-label"><span>Commit link</span><div className="relative"><GitCommitHorizontal className="field-icon" /><Input value={commitUrl} onChange={(event) => setCommitUrl(event.target.value)} placeholder="github.com/.../commit/..." className="timer-input pl-10" /></div></label>
                    <label className="field-label"><span>Screenshot link</span><div className="relative"><FileImage className="field-icon" /><Input value={screenshotUrl} onChange={(event) => setScreenshotUrl(event.target.value)} placeholder="Paste evidence URL" className="timer-input pl-10" /></div></label>
                    <label className="field-label"><span>What was completed?</span><Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Short outcome note" className="timer-input" /></label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-white/45">Started at {timeFormatter.format(new Date(running.startedAt))}</p><div className="flex gap-2"><Button disabled={saving} variant="ghost" onClick={() => deleteEntry(running)} className="h-11 rounded-xl px-4 text-white/65 hover:bg-white/10 hover:text-white"><Trash2 /> Discard</Button><Button disabled={saving} onClick={stopTimer} className="h-11 rounded-xl bg-[#a86e5b] px-5 font-bold text-white hover:bg-[#925b49]"><CircleStop /> Stop & save</Button></div></div>
                </div>
              )}
            </div>

            <div className="rounded-[22px] border border-[#43534c] bg-[#3d4b45] p-6 text-[#f6f3ed] lg:p-7">
              <div className="flex items-center justify-between"><p className="kicker text-[#c8d0cb]">This week</p><CalendarDays className="size-5 text-[#d8c0b5]" /></div>
              <p className="mt-6 text-5xl font-bold tracking-[-.07em]">{formatDuration(totalMinutes)}</p>
              <p className="mt-1 text-sm text-[#c0c8c3]">billable time logged</p>
              <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-5"><div><p className="text-xs text-[#b7c0ba]">Value</p><p className="mt-1 text-xl font-bold">{moneyFormatter.format(totalValue)}</p></div><div><p className="text-xs text-[#b7c0ba]">Clients</p><p className="mt-1 text-xl font-bold">{clients}</p></div></div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[.68fr_1.32fr]">
            <div className="rounded-[22px] border border-[#ced1cc] bg-[#f5f5f2] p-6">
              <div className="flex items-center justify-between"><div><p className="kicker">Weekly rhythm</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Hours by day</h2></div><TimerReset className="size-5 text-[#8a8981]" /></div>
              <div className="mt-8 flex h-40 items-end justify-between gap-3">{dailyTotals.map((day) => <div key={day.label} className="flex h-full flex-1 flex-col justify-end"><span className="mb-2 text-center text-[10px] font-semibold text-[#6c746f]">{day.minutes ? formatDuration(day.minutes) : '—'}</span><div className="w-full rounded-t-lg bg-[#657a70] transition-all" style={{ height: `${Math.max(day.minutes ? 12 : 3, (day.minutes / maxDaily) * 100)}%` }} /><span className="mt-3 text-center text-[10px] font-bold uppercase tracking-wider text-[#747c77]">{day.label}</span></div>)}</div>
            </div>

            <div className="overflow-hidden rounded-[22px] border border-[#ced1cc] bg-[#f5f5f2]">
              <div className="flex items-center justify-between border-b border-[#d9dcd7] px-6 py-5"><div><p className="kicker">Evidence log</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Recent work</h2></div><button className="text-xs font-bold text-[#5a6c64]">View all <ArrowUpRight className="ml-1 inline size-3.5" /></button></div>
              {loading ? <div className="grid min-h-52 place-items-center text-sm text-[#8a8981]">Loading your work…</div> : completed.length === 0 ? <div className="grid min-h-52 place-items-center px-6 text-center"><div><Clock3 className="mx-auto size-7 text-[#aaa89f]" /><p className="mt-3 text-sm font-semibold">No completed entries this week</p><p className="mt-1 text-xs text-[#8a8981]">Your first saved timer will appear here with its evidence.</p></div></div> : <div>{completed.slice(0, 5).map((entry) => <article key={entry.id} className="grid gap-3 border-b border-[#d9dcd7] px-6 py-4 last:border-0 md:grid-cols-[1fr_150px_110px_128px] md:items-center"><div><div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[#657a70]" /><h3 className="text-sm font-bold">{entry.task}</h3></div><p className="mt-1 pl-6 text-xs text-[#737b76]">{entry.client} · {dateFormatter.format(new Date(entry.startedAt))}</p></div><div className="text-xs"><p className="text-[#737b76]">{timeFormatter.format(new Date(entry.startedAt))} → {entry.endedAt ? timeFormatter.format(new Date(entry.endedAt)) : ''}</p><p className="mt-1 font-semibold">{moneyFormatter.format(entry.hourlyRateCents / 100)}/hr</p></div><p className="text-sm font-bold md:text-right">{formatDuration(entry.durationMinutes ?? 0)}</p><div className="flex gap-2 md:justify-end">{entry.commitUrl && <a href={entry.commitUrl} target="_blank" rel="noreferrer" className="evidence-link" aria-label="Open commit"><GitCommitHorizontal /></a>}{entry.screenshotUrl && <a href={entry.screenshotUrl} target="_blank" rel="noreferrer" className="evidence-link" aria-label="Open screenshot"><FileImage /></a>}<button onClick={() => deleteEntry(entry)} className="evidence-link hover:!border-[#a86e5b] hover:!bg-[#eadbd5] hover:!text-[#7f4d3d]" aria-label={`Delete ${entry.task}`}><Trash2 /></button></div></article>)}</div>}
            </div>
          </section>
          </>}

          {activeView === 'report' && (
            <section>
              <div className="page-heading"><div><p className="kicker">Weekly report</p><h1>Time, value and evidence.</h1><p>Review any week and export a client-ready work log.</p></div><Button onClick={() => { const current = getMonday(); setReportWeekStart(current); }} variant="outline" className="h-10 rounded-xl bg-[#f5f5f2]">This week</Button></div>
              <div className="week-switcher"><button onClick={() => moveReportWeek(-1)} aria-label="Previous week"><ChevronLeft /></button><div><strong>{dateFormatter.format(reportWeekStart)} – {dateFormatter.format(new Date(reportWeekEnd.getTime() - 86400000))}</strong><span>{reportEntries.length} completed {reportEntries.length === 1 ? 'entry' : 'entries'}</span></div><button onClick={() => moveReportWeek(1)} disabled={reportWeekStart >= getMonday()} aria-label="Next week"><ChevronRight /></button></div>
              <div className="metric-grid"><div className="metric-card dark"><span>Hours worked</span><strong>{formatDuration(reportMinutes)}</strong></div><div className="metric-card"><span>Billable value</span><strong>{moneyFormatter.format(reportValue)}</strong></div><div className="metric-card"><span>Clients</span><strong>{new Set(reportEntries.map((entry) => entry.client)).size}</strong></div></div>
              <div className="data-panel mt-5"><div className="panel-heading"><div><p className="kicker">Work log</p><h2>Entries for this week</h2></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="rounded-xl" onClick={() => importInput.current?.click()} disabled={saving}><FileUp /> Import CSV</Button><Button variant="outline" className="rounded-xl" onClick={() => exportEvidencePdf(reportEntries, reportWeekStart)} disabled={!reportEntries.length}><FileDown /> Export PDF</Button><Button variant="outline" className="rounded-xl" onClick={() => exportReport(reportEntries, reportWeekStart)}><Download /> Export CSV</Button></div></div>{importMessage && <p className="mx-6 mt-4 rounded-xl bg-[#e4eee7] px-4 py-3 text-sm font-semibold text-[#3d604a]">{importMessage}</p>}{reportEntries.length === 0 ? <div className="empty-panel"><BarChart3 /><strong>No work recorded for this week</strong><span>Use the timer or import an exported work week.</span></div> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Task</th><th>Client</th><th>Time</th><th>Rate</th><th>Value</th><th>Evidence</th></tr></thead><tbody>{reportEntries.map((entry) => <tr key={entry.id}><td>{dateFormatter.format(new Date(entry.startedAt))}</td><td><strong>{entry.task}</strong></td><td>{entry.client}</td><td>{formatDuration(entry.durationMinutes ?? 0)}</td><td>{moneyFormatter.format(entry.hourlyRateCents / 100)}</td><td>{moneyFormatter.format(((entry.durationMinutes ?? 0) / 60) * (entry.hourlyRateCents / 100))}</td><td><div className="flex gap-2">{entry.commitUrl && <a aria-label="Open commit" className="evidence-link" href={entry.commitUrl} target="_blank" rel="noreferrer"><GitCommitHorizontal /></a>}{entry.screenshotUrl && <a aria-label="Open screenshot" className="evidence-link" href={entry.screenshotUrl} target="_blank" rel="noreferrer"><FileImage /></a>}</div></td></tr>)}</tbody></table></div>}</div>
            </section>
          )}

          {activeView === 'clients' && (
            <section>
              <div className="page-heading"><div><p className="kicker">Clients</p><h1>Where your time goes.</h1><p>Client totals are calculated automatically from your completed entries.</p></div><Button onClick={() => { setActiveView('dashboard'); setManualOpen(true); }} className="h-10 rounded-xl bg-[#3d4b45] px-4 text-white"><Plus /> Add work</Button></div>
              {clientStats.length === 0 ? <div className="data-panel empty-panel mt-6"><UserRound /><strong>No clients yet</strong><span>A client appears here after you save their first time entry.</span></div> : <div className="client-grid mt-6">{clientStats.map((item) => <article className="client-card" key={item.name}><div className="client-avatar">{item.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</div><div className="mt-5 flex items-start justify-between gap-3"><div><h2>{item.name}</h2><p>Last activity {dateFormatter.format(item.lastActive)}</p></div><strong>{moneyFormatter.format(item.value)}</strong></div><div className="client-stats"><div><span>Hours</span><strong>{formatDuration(item.minutes)}</strong></div><div><span>Entries</span><strong>{item.entries}</strong></div></div></article>)}</div>}
            </section>
          )}

          {activeView === 'settings' && (
            <section>
              <div className="page-heading"><div><p className="kicker">Settings</p><h1>Make it yours.</h1><p>These defaults are stored on the server and available across your devices.</p></div></div>
              <form onSubmit={saveSettings} className="settings-card mt-6"><div className="settings-section"><div><h2>Profile</h2><p>Used to personalise your workspace.</p></div><div className="settings-fields"><label className="manual-field"><span>Display name</span><Input value={settings.displayName} onChange={(event) => setSettings((current) => ({ ...current, displayName: event.target.value }))} required /></label><label className="manual-field"><span>Initials</span><Input value={settings.initials} maxLength={3} onChange={(event) => setSettings((current) => ({ ...current, initials: event.target.value.toUpperCase() }))} required /></label></div></div><div className="settings-section"><div><h2>Time & billing</h2><p>Applied when you start or manually add work.</p></div><div className="settings-fields"><label className="manual-field"><span>Default hourly rate (AUD)</span><Input type="number" min="0" value={settings.defaultRateCents / 100} onChange={(event) => setSettings((current) => ({ ...current, defaultRateCents: Number(event.target.value) * 100 }))} required /></label><label className="manual-field"><span>Currency</span><Input value="AUD — Australian Dollar" disabled /></label><label className="manual-field"><span>Timezone</span><Input value="Australia/Sydney" disabled /></label><label className="manual-field"><span>Week starts</span><Input value="Monday" disabled /></label></div></div><div className="settings-actions"><span>{settingsSaved ? 'Settings saved.' : ''}</span><Button disabled={saving} type="submit" className="h-10 rounded-xl bg-[#3d4b45] px-5 text-white">Save settings</Button></div></form>
            </section>
          )}
        </div>
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[22px] bg-[#f5f5f2] p-0 sm:max-w-2xl">
          <form onSubmit={addPastWork}>
            <DialogHeader className="border-b border-[#d9dcd7] px-6 py-5">
              <DialogTitle className="text-xl font-bold tracking-[-.035em]">Add past work</DialogTitle>
              <DialogDescription>Log work you completed earlier. Duration is calculated from the start and end times.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <label className="manual-field sm:col-span-2"><span>Task</span><Input value={manualTask} onChange={(event) => setManualTask(event.target.value)} placeholder="What did you work on?" required /></label>
              <label className="manual-field"><span>Client</span><Input value={manualClient} onChange={(event) => setManualClient(event.target.value)} placeholder="Client name" required /></label>
              <label className="manual-field"><span>Rate / hour (AUD)</span><Input type="number" min="0" step="1" value={manualRate} onChange={(event) => setManualRate(event.target.value)} required /></label>
              <label className="manual-field"><span>Date</span><Input type="date" max={localDateValue()} value={manualDate} onChange={(event) => setManualDate(event.target.value)} required /></label>
              <div className="grid grid-cols-2 gap-3"><label className="manual-field"><span>Started</span><Input type="time" value={manualStart} onChange={(event) => setManualStart(event.target.value)} required /></label><label className="manual-field"><span>Finished</span><Input type="time" value={manualEnd} onChange={(event) => setManualEnd(event.target.value)} required /></label></div>
              <label className="manual-field"><span>Commit link</span><Input type="url" value={manualCommit} onChange={(event) => setManualCommit(event.target.value)} placeholder="https://github.com/…" /></label>
              <label className="manual-field"><span>Screenshot link</span><Input type="url" value={manualScreenshot} onChange={(event) => setManualScreenshot(event.target.value)} placeholder="https://…" /></label>
              <label className="manual-field sm:col-span-2"><span>What was completed?</span><Input value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} placeholder="Short summary of the outcome" /></label>
            </div>
            <DialogFooter className="m-0 rounded-b-[22px] border-[#d9dcd7] bg-[#e9ebe7] px-6 py-4"><Button type="button" variant="ghost" onClick={() => setManualOpen(false)} className="h-10 rounded-xl px-4">Cancel</Button><Button type="submit" disabled={saving} className="h-10 rounded-xl bg-[#3d4b45] px-5 text-white hover:bg-[#2f3a35]">Save past work</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
