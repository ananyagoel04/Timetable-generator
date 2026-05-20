import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 md:ml-[250px] flex flex-col min-h-screen transition-all duration-300">
        <Header />
        <main className="flex-1 p-4 md:p-6 overflow-auto pt-16 md:pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
