import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useSidebar } from '../../context/SidebarContext';

export default function Layout() {
  const { sidebarWidth } = useSidebar();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div
        className="flex-1 hidden md:flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
      {/* Mobile layout - no margin, hamburger space */}
      <div className="flex-1 flex md:hidden flex-col min-h-screen">
        <main className="flex-1 p-4 pt-16 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
