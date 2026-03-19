"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/utils/cn";

interface TopNavProps {
  onMenuClick?: () => void;
  className?: string;
}

const MenuIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const BellIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const HelpIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const UserIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LogOutIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const pathLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/appraisals": "My Appraisals",
  "/feedback": "360 Feedback",
  "/development": "Development Profile",
  "/profile": "My Profile",
  "/manager/reviews": "Team Reviews",
  "/admin/appraisals": "All Appraisals",
  "/admin": "HR Administration",
  "/admin/360": "All 360 Reviews",
  "/admin/users": "User administration",
};

function getBreadcrumb(pathname: string): { parent: string | null; current: string } {
  const label = pathLabels[pathname];
  if (label) {
    return { parent: "Home", current: label };
  }
  
  if (pathname.startsWith("/appraisals/")) {
    return { parent: "My Appraisals", current: "Appraisal Details" };
  }
  if (pathname.startsWith("/feedback/cycles/") && pathname.includes("/review/")) {
    return { parent: "360 Feedback", current: "Complete review" };
  }
  if (pathname.startsWith("/feedback/cycles/") && pathname.includes("/report")) {
    return { parent: "360 Feedback", current: "Report" };
  }
  if (pathname.startsWith("/feedback/")) {
    return { parent: "360 Feedback", current: "Feedback cycle" };
  }
  if (pathname.startsWith("/admin/")) {
    return { parent: "HR Administration", current: pathname.split("/").pop() || "Details" };
  }
  if (pathname.startsWith("/manager/")) {
    return { parent: "Team Reviews", current: "Details" };
  }
  
  return { parent: null, current: "Page" };
}

export function TopNav({ onMenuClick, className }: TopNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const { user, signOut } = useAuth();
  const breadcrumb = getBreadcrumb(pathname);

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "U";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-[60px] shrink-0 items-center justify-between bg-white px-6",
        className
      )}
      style={{ borderBottom: "1px solid var(--border-color)" }}
    >
      {/* Left: Mobile menu + Breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface lg:hidden"
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
        >
          <MenuIcon />
        </button>
        
        <nav className="flex items-center gap-1.5 text-sm">
          {breadcrumb.parent && (
            <>
              <span className="text-text-muted">{breadcrumb.parent}</span>
              <ChevronRightIcon />
            </>
          )}
          <span className="font-semibold text-text-primary">{breadcrumb.current}</span>
        </nav>
      </div>

      {/* Right: Action buttons + User menu */}
      <div className="flex items-center gap-2">
        {/* Notifications button */}
        <button
          className="relative flex h-[34px] w-[34px] items-center justify-center rounded-lg border text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          style={{ borderColor: "var(--border-color)" }}
          title="Notifications"
        >
          <BellIcon />
          {/* Red notification dot */}
          <span
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: "var(--rose)",
              boxShadow: "0 0 0 1.5px white",
            }}
          />
        </button>

        {/* Help button */}
        <button
          className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          style={{ borderColor: "var(--border-color)" }}
          title="Help"
        >
          <HelpIcon />
        </button>

        {/* User dropdown */}
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative ml-2 h-9 w-9 rounded-full p-0">
              <Avatar className="h-9 w-9">
                <AvatarFallback
                  className="font-display text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="font-display text-sm font-medium">{user?.name ?? "User"}</p>
                <p className="text-xs text-text-muted">{user?.email ?? "—"}</p>
                {user?.roles?.length ? (
                  <p className="text-xs text-text-muted capitalize">
                    {user.roles.join(", ")}
                  </p>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <Link href="/profile">
                <UserIcon />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2"
              onClick={() => {
                setOpen(false);
                setSignOutOpen(true);
              }}
            >
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
          <DialogContent showClose={false} className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="font-display">Sign out</DialogTitle>
              <DialogDescription>Are you sure you want to sign out?</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setSignOutOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={async () => {
                  setSignOutOpen(false);
                  await signOut();
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
