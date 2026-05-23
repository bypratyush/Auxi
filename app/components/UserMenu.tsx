'use client';

import { useEffect, useState, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { User } from '@supabase/supabase-js';

export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    const extractData = (user: User | null | undefined) => {
      if (!user) {
        setEmail(null);
        setFirstName(null);
        return;
      }
      setEmail(user.email ?? null);
      const fullName = user.user_metadata?.full_name;
      if (fullName) {
        setFirstName(fullName.split(' ')[0]);
      } else {
        setFirstName(null);
      }
    };

    supabase.auth.getUser().then(({ data }) => {
      if (active) extractData(data.user);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      extractData(session?.user);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!email) return null;

  const displayText = firstName ? firstName : short(email);
  const initial = displayText.charAt(0).toUpperCase();

  return (
    <div className="user-menu" ref={menuRef}>
      <button 
        type="button" 
        className="user-card-btn" 
        title={email}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="user-avatar">{initial}</span>
        <span className="user-full_name">{displayText}</span>
        <svg className={`user-chevron ${isOpen ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>

      {isOpen && (
        <div className="user-dropdown">
          <form action="/auth/signout" method="post" className="user-signout-form">
            <button type="submit" className="user-signout" aria-label="Sign out">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function short(email: string): string {
  if (email.length <= 24) return email;
  const [local, domain] = email.split('@');
  if (!domain) return email.slice(0, 23) + '…';
  return `${local.slice(0, 12)}…@${domain}`;
}
