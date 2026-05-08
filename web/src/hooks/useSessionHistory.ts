import { useState, useEffect } from 'react';

export interface Session {
  id: string;
  name: string;
  lastMessage: string;
  updatedAt: number;
}

const STORAGE_KEY = 'agent-sessions';

export function useSessionHistory() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(
    `session-${Date.now()}`
  );

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSessions(JSON.parse(stored));
  }, []);

  const saveSessions = (list: Session[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    setSessions(list);
  };

  const addSession = (name: string) => {
    const newSession: Session = {
      id: `session-${Date.now()}`,
      name,
      lastMessage: '',
      updatedAt: Date.now(),
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setCurrentSessionId(newSession.id);
    return newSession.id;
  };

  const updateLastMessage = (sessionId: string, text: string) => {
    const updated = sessions.map((s) =>
      s.id === sessionId
        ? { ...s, lastMessage: text.slice(0, 50), updatedAt: Date.now() }
        : s
    );
    saveSessions(updated);
  };

  const deleteSession = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id);
    saveSessions(updated);
    if (currentSessionId === id && updated.length > 0) {
      setCurrentSessionId(updated[0].id);
    }
  };

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    addSession,
    updateLastMessage,
    deleteSession,
  };
}