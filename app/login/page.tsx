"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "v0.3.0";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const error = searchParams.get("error");

  return (
    <div
      className="min-h-screen flex items-center justify-center relative bg-no-repeat"
      style={{
        backgroundImage: "url('/bg1.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "50% 35%",
      }}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(160deg, rgba(10,22,50,0.72) 0%, rgba(10,22,50,0.55) 50%, rgba(10,22,50,0.82) 100%)",
        }}
        aria-hidden
      />
      {/* Top stripe */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, #0d9488, #3b82f6)" }}
        aria-hidden
      />
      <div className="absolute bottom-5 right-7 z-10 pointer-events-none">
        <span className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm">
          {APP_VERSION}
        </span>
      </div>

      {/* Card */}
      <div className="relative z-10 w-[460px] bg-white rounded-[20px] overflow-hidden mx-4">
        {/* Teal bar */}
        <div className="h-[4px] bg-[#0d9488] w-full" aria-hidden />
        <div className="p-10 px-10 pb-[34px]">
          {/* Logo row */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#0f1f3d] rounded-[10px] flex items-center justify-center shrink-0">
              <span className="font-display text-[11px] font-bold text-[#5eead4] tracking-wide">DBJ</span>
            </div>
            <div>
              <p className="font-display text-[12.5px] font-bold text-[#0f1f3d] leading-tight">Development Bank of Jamaica</p>
              <p className="font-body text-[11px] font-normal text-[#8a97b8]">Performance Management System</p>
            </div>
          </div>

          {/* Heading */}
          <h1 className="font-display text-[22px] font-bold text-[#0f1f3d] mb-1">Welcome back</h1>
          <p className="font-body text-[13px] font-normal text-[#8a97b8] mb-7">
            Sign in with your work account to continue.
          </p>

          {/* Error messages - keep existing auth logic */}
          {error === "CredentialsSignin" && (
            <p className="text-center text-sm text-destructive mb-4">
              Sign in failed. Please try again.
            </p>
          )}
          {error && error !== "CredentialsSignin" && (
            <p className="text-center text-sm text-muted-foreground mb-4">
              An error occurred. Please try again.
            </p>
          )}

          {/* Microsoft SSO button */}
          <button
            type="button"
            onClick={() => signIn("azure-ad", { callbackUrl })}
            className="w-full bg-[#0f1f3d] rounded-[12px] py-[15px] flex items-center justify-center gap-3 hover:bg-[#162e5a] hover:-translate-y-px active:scale-[0.985] transition"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <rect x="1" y="1" width="9" height="9" rx="1.5" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" rx="1.5" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" rx="1.5" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" rx="1.5" fill="#FFB900" />
            </svg>
            <span className="font-body text-[14px] font-medium text-white">Sign in with Microsoft</span>
          </button>

          {/* Card footer */}
          <div className="flex justify-between items-center mt-5 pt-[18px] border-t border-[#eef1f8]">
            <div className="flex items-center gap-2">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                <rect x="3" y="7" width="10" height="8" rx="2" stroke="#b0bac9" strokeWidth="1.3" />
                <path d="M5 7V5a3 3 0 016 0v2" stroke="#b0bac9" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span className="text-[11px] text-[#b0bac9]">Azure AD (Entra ID)</span>
            </div>
            <span className="bg-[#f0faf9] border border-[#0d9488]/25 rounded-full px-3 py-1 text-[11px] font-semibold text-[#0d9488]">
              FY 2026 – 2027
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
