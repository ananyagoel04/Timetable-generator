import { useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';

const pageTitles = {
  '/': 'Dashboard',
  '/setup': 'Setup Wizard',
  '/timetable': 'Timetable Editor',
  '/generator': 'Timetable Generator',
  '/conflicts': 'Conflict Center',
  '/teachers': 'Teacher Management',
  '/classes': 'Class Management',
  '/subjects': 'Subject Management',
  '/rooms': 'Room Management',
  '/requirements': 'Weekly Subject Periods',
  '/combinations': 'Combined Classes',
  '/rules': 'Rules & Preferences',
  '/absences': 'Absence Tracker',
  '/substitutions': 'Substitution Manager',
  '/replacements': 'Teacher Replacements',
};

export default function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'TimeCraft';

  return (
    <header className="sticky top-0 z-30 bg-dark-950/80 backdrop-blur-xl border-b border-dark-700/50">
      <div className="flex items-center justify-between h-16 px-6">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-xs text-dark-400">Academic Year 2025–26</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input type="text" placeholder="Search..." className="input-field pl-9 py-2 text-sm w-56" />
          </div>
          <button className="relative p-2.5 rounded-xl bg-dark-800 border border-dark-700/50 text-dark-400 hover:text-white hover:bg-dark-700 transition-all">
            <Bell size={18} />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">3</span>
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-primary-500/20">
            A
          </div>
        </div>
      </div>
    </header>
  );
}
