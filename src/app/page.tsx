import { redirect } from 'next/navigation';

/**
 * Home page - redirects to chat
 */
export default function HomePage() {
  redirect('/chat');
}
