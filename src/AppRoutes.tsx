import { Link, Route, Routes } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { HomePage } from '@/features/home/HomePage';
import { MyTasksPage } from '@/features/my-tasks/MyTasksPage';
import { ProjectPage } from '@/features/projects/ProjectPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/my-tasks" element={<MyTasksPage />} />
      <Route path="/projects/:projectId" element={<ProjectPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route
        path="*"
        element={
          <EmptyState
            icon={Compass}
            title="Page not found"
            message="The page you are looking for does not exist."
            action={<Link to="/" className="btn-primary">Go home</Link>}
          />
        }
      />
    </Routes>
  );
}
