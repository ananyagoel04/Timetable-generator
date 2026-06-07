import { useState, useEffect } from 'react';
import {
  BarChart3, Users, DoorOpen, BookOpen, Brain, TrendingUp, Clock,
  AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronRight, Zap,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import api from '../api/axios';
import HeatmapChart from '../components/ui/HeatmapChart';
import QualityGauge from '../components/ui/QualityGauge';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };

export default function AnalyticsDashboard() {
  const { selectedSchool, selectedSession } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [roomData, setRoomData] = useState([]);
  const [subjectData, setSubjectData] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedRec, setExpandedRec] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedSchool, selectedSession]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dashRes = await api.get('/analytics/dashboard');
      const d = dashRes.data?.data;
      setDashboard(d);

      if (d?.hasData && d?.timetableId) {
        const tid = d.timetableId;
        const [heatRes, roomRes, subjRes, recRes, histRes] = await Promise.all([
          api.get(`/analytics/teacher-heatmap?timetableId=${tid}`).catch(() => ({ data: { data: [] } })),
          api.get(`/analytics/room-efficiency?timetableId=${tid}`).catch(() => ({ data: { data: [] } })),
          api.get(`/analytics/subject-heatmap?timetableId=${tid}`).catch(() => ({ data: { data: [] } })),
          api.get(`/analytics/ai-recommendations?timetableId=${tid}`).catch(() => ({ data: { data: null } })),
          api.get('/analytics/generation-history').catch(() => ({ data: { data: [] } }))
        ]);
        setHeatmap(heatRes.data?.data || []);
        setRoomData(roomRes.data?.data || []);
        setSubjectData(subjRes.data?.data || []);
        setRecommendations(recRes.data?.data || null);
        setHistory(histRes.data?.data || []);
      }
    } catch (err) {
      toast.error('Failed to load analytics');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-primary-500" />
          <h1 className="text-2xl font-bold text-slate-800 dark:text-dark-50">Analytics</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-dark-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard?.hasData) {
    return (
      <div className="p-6 text-center py-20">
        <BarChart3 className="w-16 h-16 mx-auto text-slate-300 dark:text-dark-600 mb-4" />
        <h2 className="text-xl font-semibold text-slate-600 dark:text-dark-300 mb-2">No Timetable Data</h2>
        <p className="text-slate-400 dark:text-dark-500">Generate a timetable to see analytics and AI recommendations.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'teachers', label: 'Teacher Heatmap', icon: Users },
    { id: 'rooms', label: 'Room Efficiency', icon: DoorOpen },
    { id: 'subjects', label: 'Subject Distribution', icon: BookOpen },
    { id: 'ai', label: 'AI Insights', icon: Brain },
    { id: 'history', label: 'Generation History', icon: Clock },
  ];

  const priorityColors = {
    critical: 'border-red-500 bg-red-50 dark:bg-red-950/20',
    high: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20',
    medium: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
    low: 'border-slate-300 bg-slate-50 dark:bg-dark-800'
  };
  const priorityIcons = {
    critical: <AlertTriangle className="w-5 h-5 text-red-500" />,
    high: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    medium: <Info className="w-5 h-5 text-blue-500" />,
    low: <CheckCircle2 className="w-5 h-5 text-slate-400" />
  };

  // Transform heatmap data for HeatmapChart
  const teacherHeatRows = heatmap.map(t => ({
    label: t.name,
    values: Object.fromEntries(DAYS.map(d => [DAY_SHORT[d], t.dailyTotals?.[d] || 0]))
  }));

  const subjectHeatRows = subjectData.map(s => ({
    label: s.name,
    values: Object.fromEntries(DAYS.map(d => [DAY_SHORT[d], s.days?.[d] || 0]))
  }));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl shadow-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-dark-50">Analytics Dashboard</h1>
            <p className="text-sm text-slate-500 dark:text-dark-400">AI-powered scheduling insights</p>
          </div>
        </div>
        <button onClick={loadData} className="btn-secondary text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${activeTab === tab.id
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-dark-300 hover:bg-slate-50 dark:hover:bg-dark-700 border border-slate-200 dark:border-dark-700'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW TAB ─── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Quality Score"
              value={dashboard.qualityScore}
              suffix="/100"
              icon={<Zap className="w-5 h-5" />}
              color={dashboard.qualityScore >= 70 ? 'emerald' : dashboard.qualityScore >= 50 ? 'amber' : 'red'}
            />
            <SummaryCard
              label="Total Blocks"
              value={dashboard.totalBlocks}
              icon={<BookOpen className="w-5 h-5" />}
              color="blue"
            />
            <SummaryCard
              label="Teachers"
              value={`${dashboard.teacherStats?.assigned}/${dashboard.teacherStats?.total}`}
              icon={<Users className="w-5 h-5" />}
              color="purple"
              subtitle={`Avg: ${dashboard.teacherStats?.avgLoad} periods`}
            />
            <SummaryCard
              label="Room Usage"
              value={`${dashboard.roomStats?.utilization}%`}
              icon={<DoorOpen className="w-5 h-5" />}
              color="teal"
              subtitle={`${dashboard.roomStats?.used}/${dashboard.roomStats?.total} rooms`}
            />
          </div>

          {/* Quality Gauge + AI Quick Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-6 flex flex-col items-center">
              <QualityGauge value={dashboard.qualityScore} label="Timetable Quality" size={140} />
              <p className="text-xs text-slate-400 dark:text-dark-500 mt-2">
                Generated {dashboard.generationTimeMs ? `in ${(dashboard.generationTimeMs / 1000).toFixed(1)}s` : ''}
              </p>
            </div>
            <div className="md:col-span-2 bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-slate-700 dark:text-dark-200">AI Recommendations</h3>
                {recommendations?.summary && (
                  <span className="ml-auto text-xs bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                    {recommendations.summary.total} insights
                  </span>
                )}
              </div>
              {recommendations?.recommendations?.slice(0, 3).map((rec, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg mb-2 border-l-4 ${priorityColors[rec.priority]}`}>
                  {priorityIcons[rec.priority]}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-dark-200">{rec.title}</p>
                    <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">{rec.description}</p>
                  </div>
                </div>
              )) || <p className="text-sm text-slate-400">No recommendations available</p>}
              {(recommendations?.recommendations?.length || 0) > 3 && (
                <button onClick={() => setActiveTab('ai')} className="text-xs text-primary-500 hover:text-primary-600 mt-2 flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TEACHER HEATMAP TAB ─── */}
      {activeTab === 'teachers' && (
        <HeatmapChart
          rows={teacherHeatRows}
          columns={Object.values(DAY_SHORT)}
          title="Teacher Workload Heatmap (periods per day)"
          valueLabel="periods"
        />
      )}

      {/* ─── ROOM EFFICIENCY TAB ─── */}
      {activeTab === 'rooms' && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-6">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-dark-300 mb-4">Room Efficiency Scores</h3>
          <div className="space-y-3">
            {roomData.map((room, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-600 dark:text-dark-300 w-28 truncate" title={room.name}>{room.name}</span>
                <div className="flex-1 bg-slate-100 dark:bg-dark-700 rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2
                      ${room.utilization >= 70 ? 'bg-emerald-500' : room.utilization >= 40 ? 'bg-blue-500' : room.utilization >= 20 ? 'bg-amber-500' : 'bg-red-400'}`}
                    style={{ width: `${Math.max(room.utilization, 8)}%` }}
                  >
                    <span className="text-[10px] font-bold text-white">{room.utilization}%</span>
                  </div>
                </div>
                <span className="text-xs text-slate-400 dark:text-dark-500 w-20 text-right">{room.usedSlots}/{room.totalSlots} slots</span>
              </div>
            ))}
            {roomData.length === 0 && <p className="text-sm text-slate-400">No room data</p>}
          </div>
        </div>
      )}

      {/* ─── SUBJECT DISTRIBUTION TAB ─── */}
      {activeTab === 'subjects' && (
        <HeatmapChart
          rows={subjectHeatRows}
          columns={Object.values(DAY_SHORT)}
          title="Subject Distribution Heatmap (periods per day)"
          valueLabel="periods"
        />
      )}

      {/* ─── AI INSIGHTS TAB ─── */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['critical', 'high', 'medium', 'low'].map(p => (
              <div key={p} className={`p-3 rounded-xl border ${priorityColors[p]} text-center`}>
                <div className="text-2xl font-bold text-slate-700 dark:text-dark-200">
                  {recommendations?.summary?.[p] || 0}
                </div>
                <div className="text-xs capitalize text-slate-500 dark:text-dark-400">{p}</div>
              </div>
            ))}
          </div>
          {recommendations?.recommendations?.map((rec, i) => (
            <div key={i} className={`border-l-4 rounded-xl p-4 ${priorityColors[rec.priority]} cursor-pointer transition-all hover:shadow-md`}
              onClick={() => setExpandedRec(expandedRec === i ? null : i)}>
              <div className="flex items-start gap-3">
                {priorityIcons[rec.priority]}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-slate-700 dark:text-dark-200">{rec.title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase
                      ${rec.priority === 'critical' ? 'bg-red-200 text-red-700' :
                        rec.priority === 'high' ? 'bg-amber-200 text-amber-700' :
                        rec.priority === 'medium' ? 'bg-blue-200 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">{rec.description}</p>
                  {expandedRec === i && rec.action && (
                    <div className="mt-3 p-3 bg-white/60 dark:bg-dark-900/40 rounded-lg border border-slate-200/50 dark:border-dark-700/50">
                      <p className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1">💡 Suggested Action:</p>
                      <p className="text-xs text-slate-500 dark:text-dark-400 whitespace-pre-line">{rec.action}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── GENERATION HISTORY TAB ─── */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-dark-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-dark-400">Name</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-dark-400">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-dark-400">Quality</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-dark-400">Blocks</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-dark-400">Unplaced</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-dark-400">Conflicts</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-dark-400">Time</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-dark-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                {history.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-dark-700/30 transition-colors">
                    <td className="px-4 py-3 text-slate-700 dark:text-dark-200 font-medium truncate max-w-[160px]">{h.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                        ${h.status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
                          h.status === 'draft' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                          'bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-dark-400'}`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">
                      <span className={h.qualityScore >= 70 ? 'text-emerald-600' : h.qualityScore >= 50 ? 'text-amber-600' : 'text-red-500'}>
                        {h.qualityScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-dark-300">{h.totalBlocks}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={h.unplaced > 0 ? 'text-red-500 font-medium' : 'text-slate-400'}>{h.unplaced}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={h.conflicts > 0 ? 'text-amber-500 font-medium' : 'text-slate-400'}>{h.conflicts}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 dark:text-dark-400 text-xs">
                      {h.generationTimeMs ? `${(h.generationTimeMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 dark:text-dark-500">
                      {new Date(h.generatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, suffix = '', icon, color, subtitle }) {
  const colors = {
    emerald: 'from-emerald-500 to-teal-500',
    blue: 'from-blue-500 to-cyan-500',
    purple: 'from-purple-500 to-indigo-500',
    teal: 'from-teal-500 to-cyan-500',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-500 to-pink-500'
  };

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-dark-400 uppercase tracking-wide">{label}</span>
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${colors[color]} text-white`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-800 dark:text-dark-50">
        {value}<span className="text-sm font-normal text-slate-400">{suffix}</span>
      </div>
      {subtitle && <p className="text-xs text-slate-400 dark:text-dark-500 mt-1">{subtitle}</p>}
    </div>
  );
}
