'use client';

import { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

interface GameScrollContextType {
  scrollY: number;
  onScroll: (y: number) => void;
  registerColumn: (element: HTMLDivElement) => void;
  unregisterColumn: (element: HTMLDivElement) => void;
}

const GameScrollContext = createContext<GameScrollContextType | null>(null);

export function useGameScroll() {
  const context = useContext(GameScrollContext);
  return context;
}

interface GameScrollProviderProps {
  children: ReactNode;
  isActive: boolean;
}

export function GameScrollProvider({ children, isActive }: GameScrollProviderProps) {
  const scrollYRef = useRef(0);
  const columnsRef = useRef<Set<HTMLDivElement>>(new Set());
  const isScrollingRef = useRef(false);

  const onScroll = useCallback((y: number) => {
    if (!isActive) return;

    scrollYRef.current = y;

    // Sync all columns
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      columnsRef.current.forEach((column) => {
        if (column.scrollTop !== y) {
          column.scrollTop = y;
        }
      });
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    }
  }, [isActive]);

  const registerColumn = useCallback((element: HTMLDivElement) => {
    columnsRef.current.add(element);
  }, []);

  const unregisterColumn = useCallback((element: HTMLDivElement) => {
    columnsRef.current.delete(element);
  }, []);

  return (
    <GameScrollContext.Provider value={{ scrollY: scrollYRef.current, onScroll, registerColumn, unregisterColumn }}>
      {children}
    </GameScrollContext.Provider>
  );
}
