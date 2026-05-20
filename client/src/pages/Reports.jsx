import { useState, useEffect } from 'react';
import { Calendar, Users, BookOpen, Printer, Download, Filter } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Reports() {
  const [tab, setTab] = useState('day-wise');
  const [timetables, setTimetables] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedTT, setSelectedTT] = useState('');
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [maxPeriod, setMaxPeriod] = useState(8);

  useEffect(() => {
    Promise.all([
      api.get('/timetable/list').then(r => { const d = r.data || []; setTimetables(d); if (d.length) setSelectedTT(d[0]._id); }),
      api.get('/classes').then(r => { const d = r.data || []; setClasses(d); if (d.length) setSelectedClass(d[0]._id); }),
      api.get('/teachers').then(r => { const d = r.data || []; setTeachers(d); if (d.length) setSelectedTeacher(d[0]._id); })
    ]);
  }, []);

  const fetchReport = async () => {
    if (!selectedTT) return toast.error('Select a timetable');
    setLoading(true);
    try {
      let r;
      if (tab === 'day-wise') {
        r = await api.get(`/reports/day-wise?timetableId=${selectedTT}&day=${selectedDay}`);
        setReportData(r.data);
      } else if (tab === 'class-weekly') {
        if (!selectedClass) return toast.error('Select a class');
        r = await api.get(`/reports/class-weekly/${selectedClass}?timetableId=${selectedTT}`);
        setReportData(r.data); setMaxPeriod(r.data?.maxPeriod || 8);
      } else {
        if (!selectedTeacher) return toast.error('Select a teacher');
        r = await api.get(`/reports/teacher-weekly/${selectedTeacher}?timetableId=${selectedTT}`);
        setReportData(r.data); setMaxPeriod(r.data?.maxPeriod || 8);
      }
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selectedTT) fetchReport(); }, [tab, selectedTT, selectedDay, selectedClass, selectedTeacher]);

  const exportCSV = () => {
    if (!reportData) return;
    let csv = '';
    if (tab === 'day-wise' && reportData.report) {
      csv = 'Class,' + Array.from({ length: 10 }, (_, i) => `P${i + 1}`).join(',') + '\n';
      reportData.report.forEach(cr => {
        const row = [cr.class.name];
        for (let p = 1; p <= 10; p++) {
          const slot = cr.periods.find(s => s.period === p);
          row.push(slot?.subject?.name || (slot?.type === 'reserved' ? 'Break' : ''));
        }
        csv += row.join(',') + '\n';
      });
    } else if (tab === 'class-weekly' && reportData.schedule) {
      csv = 'Period,' + DAYS.join(',') + '\n';
      for (let p = 1; p <= maxPeriod; p++) {
        const row = [`P${p}`];
        DAYS.forEach(d => {
          const slot = reportData.schedule[d]?.find(s => s.period === p);
          row.push(slot?.subject?.name || '');
        });
        csv += row.join(',') + '\n';
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `report_${tab}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'day-wise', label: 'Day-Wise', icon: Calendar },
    { id: 'class-weekly', label: 'Class Weekly', icon: BookOpen },
    { id: 'teacher-weekly', label: 'Teacher Weekly', icon: Users }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="page-title">Reports</h1><p className="page-subtitle">Generate and export timetable reports</p></div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 no-print"><Printer size={16} /> Print</button>
          <button onClick={exportCSV} className="btn-primary flex items-center gap-2 no-print"><Download size={16} /> Export CSV</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card p-1.5 flex gap-1 no-print">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                ${tab === t.id ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' : 'text-dark-400 hover:text-white hover:bg-dark-800/60'}`}>
              <Icon size={16} />{t.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end no-print">
        <div className="min-w-[180px]">
          <label className="text-xs text-dark-400 mb-1 block">Timetable</label>
          <select value={selectedTT} onChange={e => setSelectedTT(e.target.value)} className="select-field">
            {timetables.map(t => <option key={t._id} value={t._id}>{t.name} ({t.status})</option>)}
          </select>
        </div>
        {tab === 'day-wise' && (
          <div className="min-w-[140px]">
            <label className="text-xs text-dark-400 mb-1 block">Day</label>
            <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="select-field">
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        {tab === 'class-weekly' && (
          <div className="min-w-[160px]">
            <label className="text-xs text-dark-400 mb-1 block">Class</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="select-field">
              {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {tab === 'teacher-weekly' && (
          <div className="min-w-[180px]">
            <label className="text-xs text-dark-400 mb-1 block">Teacher</label>
            <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} className="select-field">
              {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={fetchReport} className="btn-secondary flex items-center gap-2"><Filter size={14} />Refresh</button>
      </div>

      {/* Report Content */}
      {loading ? <div className="text-center py-16 text-dark-400">Loading report...</div> : !reportData ? (
        <div className="glass-card p-16 text-center text-dark-500">Select filters and generate a report</div>
      ) : tab === 'day-wise' ? (
        <DayWiseReport data={reportData} />
      ) : tab === 'class-weekly' ? (
        <WeeklyGridReport data={reportData} maxPeriod={maxPeriod} type="class" />
      ) : (
        <WeeklyGridReport data={reportData} maxPeriod={maxPeriod} type="teacher" />
      )}
    </div>
  );
}

function DayWiseReport({ data }) {
  if (!data?.report?.length) return <div className="glass-card p-12 text-center text-dark-500">No data for this day</div>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-dark-400">{data.day} — {data.classCount} classes</p>
      {data.report.map(cr => (
        <div key={cr.class._id} className="glass-card p-4">
          <p className="text-sm font-semibold text-white mb-2">{cr.class.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {cr.periods.map((slot, i) => (
              <div key={i} className="px-3 py-2 rounded-lg text-xs min-w-[80px] border"
                style={{
                  borderColor: slot.subject?.color ? `${slot.subject.color}40` : '#334155',
                  background: slot.subject?.color ? `${slot.subject.color}15` : slot.type === 'reserved' ? '#1e293b' : 'transparent'
                }}>
                <p className="font-medium" style={{ color: slot.subject?.color || '#94a3b8' }}>
                  {slot.subject?.name || (slot.type === 'reserved' ? 'Break' : `P${slot.period}`)}
                </p>
                {slot.teacher && <p className="text-dark-500 text-[10px]">{slot.teacher.name}</p>}
                {slot.room && <p className="text-dark-600 text-[10px]">{slot.room.name}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeeklyGridReport({ data, maxPeriod, type }) {
  const schedule = data?.schedule || {};
  const title = type === 'class' ? data?.class?.name : data?.teacher?.name;
  return (
    <div className="glass-card overflow-hidden">
      {title && <div className="px-4 py-3 border-b border-dark-700/50"><p className="text-sm font-semibold text-white">{title}</p>
        {type === 'teacher' && <p className="text-xs text-dark-400">{data.totalPeriods} teaching periods this week</p>}
      </div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] print-table">
          <thead>
            <tr className="table-header">
              <th className="p-3 text-left w-20">Period</th>
              {DAYS.map(d => <th key={d} className="p-3 text-center">{d.slice(0, 3)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxPeriod }, (_, i) => i + 1).map(p => (
              <tr key={p} className="table-row">
                <td className="p-3 text-xs font-medium text-dark-400">P{p}</td>
                {DAYS.map(d => {
                  const slot = schedule[d]?.find(s => s.period === p);
                  if (!slot) return <td key={d} className="p-3 text-center text-dark-600 text-xs">—</td>;
                  if (slot.type === 'reserved' && !slot.subject) {
                    return <td key={d} className="p-3 text-center bg-dark-800/30 text-dark-500 text-xs">Break</td>;
                  }
                  return (
                    <td key={d} className="p-2 text-center" style={{ borderLeft: slot.subject?.color ? `3px solid ${slot.subject.color}` : undefined }}>
                      <p className="text-xs font-medium text-white">{slot.subject?.name || '—'}</p>
                      {type === 'class' && slot.teacher && <p className="text-[10px] text-dark-400">{slot.teacher.name}</p>}
                      {type === 'teacher' && slot.classes && <p className="text-[10px] text-dark-400">{slot.classes.map(c => c.name).join(', ')}</p>}
                      {slot.room && <p className="text-[10px] text-dark-500">{slot.room.name}</p>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
