import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';

export default async function RootPage() {
  const session = await readSession();
  redirect(session ? '/dashboard' : '/login');
}
