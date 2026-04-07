"use client";

import { SignIn } from "@clerk/nextjs";

interface LoginOverlayProps {
  onClose: () => void;
}

export default function LoginOverlay({ onClose }: LoginOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 rounded-full bg-white p-1.5 shadow-md hover:bg-gray-100 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-500">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        <SignIn
          routing="hash"
          fallbackRedirectUrl="/new"
          appearance={{
            elements: {
              card: "shadow-2xl",
            },
          }}
        />
      </div>
    </div>
  );
}
