'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function WelcomeAnimation() {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
  }, []);

  return (
    <div className="relative w-[200px] h-[200px] mx-auto">
      {/* Background glow */}
      <div
        className={cn(
          "absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl transition-all duration-1000",
          isAnimating ? "scale-150 opacity-100" : "scale-100 opacity-0"
        )}
      />

      {/* Animated circles */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            "absolute w-32 h-32 rounded-full border-2 border-blue-400/30 transition-all duration-700",
            isAnimating ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
          style={{ animation: "pulse-ring 2s ease-in-out infinite" }}
        />
        <div
          className={cn(
            "absolute w-24 h-24 rounded-full border-2 border-purple-400/30 transition-all duration-700 delay-150",
            isAnimating ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
          style={{ animation: "pulse-ring 2s ease-in-out infinite 0.5s" }}
        />
        <div
          className={cn(
            "absolute w-16 h-16 rounded-full border-2 border-cyan-400/30 transition-all duration-700 delay-300",
            isAnimating ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
          style={{ animation: "pulse-ring 2s ease-in-out infinite 1s" }}
        />
      </div>

      {/* Center icon - Rocket */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            "relative transition-all duration-700 delay-300",
            isAnimating ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
          style={{ animation: "float 3s ease-in-out infinite" }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
          >
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
          </svg>

          {/* Rocket trail particles */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div
              className="w-2 h-2 rounded-full bg-orange-400"
              style={{ animation: "particle 1s ease-out infinite" }}
            />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
            <div
              className="w-1.5 h-1.5 rounded-full bg-yellow-400"
              style={{ animation: "particle 1s ease-out infinite 0.2s" }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-ring {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.5;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes particle {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(20px) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
