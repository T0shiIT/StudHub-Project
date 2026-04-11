import { Outlet } from 'react-router-dom';
import Header from './header';
import Sidebar from './sidebar';

export default function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}