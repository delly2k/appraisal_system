"use client";

interface ProfileHeroProps {
  fullName: string;
  jobTitle: string | null;
  divisionName: string | null;
  isActive: boolean;
  directReportsCount: number;
}

const BuildingIcon = () => (
  <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
  </svg>
);

const CheckIcon = () => (
  <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const UsersIcon = () => (
  <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

function getInitials(fullname: string): string {
  return fullname
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ProfileHero({
  fullName,
  jobTitle,
  divisionName,
  isActive,
  directReportsCount,
}: ProfileHeroProps) {
  const initials = getInitials(fullName);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f1f3d 0%, #1a3260 50%, #243d73 100%)",
        padding: "32px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Blue glow */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          right: "-50px",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Main row: Avatar + Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Sora, sans-serif",
                fontSize: "28px",
                fontWeight: 700,
                color: "white",
                border: "3px solid rgba(255,255,255,0.2)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              {initials}
            </div>
            {/* Status dot */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  bottom: "4px",
                  right: "4px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  border: "3px solid #0f1f3d",
                }}
              />
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                color: "white",
                fontFamily: "Sora, sans-serif",
                fontSize: "24px",
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {fullName}
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: "14px",
                margin: "4px 0 0 0",
              }}
            >
              {jobTitle || "No job title assigned"}
            </p>

            {/* Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" }}>
              {divisionName && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background: "rgba(59,130,246,0.25)",
                    color: "#93c5fd",
                    border: "1px solid rgba(59,130,246,0.4)",
                  }}
                >
                  <BuildingIcon />
                  {divisionName}
                </span>
              )}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 500,
                  background: isActive ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                  color: isActive ? "#86efac" : "#fca5a5",
                  border: `1px solid ${isActive ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                }}
              >
                <CheckIcon />
                {isActive ? "Active" : "Inactive"}
              </span>
              {directReportsCount > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background: "rgba(251,191,36,0.2)",
                    color: "#fcd34d",
                    border: "1px solid rgba(251,191,36,0.4)",
                  }}
                >
                  <UsersIcon />
                  {directReportsCount} Report{directReportsCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
