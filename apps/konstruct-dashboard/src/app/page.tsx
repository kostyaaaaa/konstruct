import { Dashboard } from '@/components/Dashboard';
import { apps } from '@/data/apps';

export default function Page() {
  return <Dashboard apps={apps} />;
}
