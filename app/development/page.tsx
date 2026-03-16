import { getCurrentUser } from "@/lib/auth";
import { DevelopmentProfileLoader } from "@/components/development-profile-form";

export default async function DevelopmentPage() {
  const user = await getCurrentUser();
  const hasEmployeeLink = !!user?.employee_id;
  const userId = user?.id ?? null;

  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      {!userId ? (
        <div className="rounded-[14px] border border-[#dde5f5] bg-white shadow-[0_2px_12px_rgba(15,31,61,.07),0_0_1px_rgba(15,31,61,.1)] p-6">
          <p className="text-[13px] text-[#8a97b8] m-0">
            Please sign in to view your development profile.
          </p>
        </div>
      ) : !hasEmployeeLink ? (
        <div className="rounded-[14px] border border-[#dde5f5] bg-white shadow-[0_2px_12px_rgba(15,31,61,.07),0_0_1px_rgba(15,31,61,.1)] p-6">
          <p className="text-[13px] text-[#8a97b8] m-0">
            Your profile is not linked to an employee record. Connect your account in HR
            Administration to manage your development profile.
          </p>
        </div>
      ) : (
        <DevelopmentProfileLoader userId={userId} />
      )}
    </div>
  );
}
