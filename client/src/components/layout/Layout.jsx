import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useSidebar } from '../../context/SidebarContext';

export default function Layout() {
  const { sidebarWidth } = useSidebar();

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-dark-950">
      <Sidebar />
      {/* Desktop layout */}
      <div
        className="flex-1 hidden md:flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <Header />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
      {/* Mobile layout — hamburger space at top + header */}
      <div className="flex-1 flex md:hidden flex-col min-h-screen">
        <div className="pt-14">
          <Header />
        </div>
        <main className="flex-1 p-3 sm:p-4 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
