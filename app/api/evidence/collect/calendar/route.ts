import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvidenceForEmployee } from "@/lib/evidence-auth";
import { getGraphToken } from "@/lib/azure-graph-token";
import { EVIDENCE_WEIGHTS } from "@/lib/evidence-weights";
import { createHash } from "crypto";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

const GRAPH_BASE = process.env.AZURE_GRAPH_BASE_URL ?? "https://graph.microsoft.com/v1.0";

const NOISE_SUBJECTS = [
  "standup",
  "stand-up",
  "1:1",
  "one on one",
  "one-on-one",
  "sync",
  "check-in",
  "check in",
  "catch-up",
  "catch up",
];

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { employeeId, reviewStart, reviewEnd, graphToken: passedToken } = body as {
      employeeId: string;
      reviewStart?: string;
      reviewEnd?: string;
      graphToken?: string | null;
    };
    if (!employeeId) return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });

    if (!canAccessEvidenceForEmployee(user, employeeId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const token = passedToken ?? (await getGraphToken());
    if (!token) {
      console.warn("[calendar-collector] No Graph token — returning stub");
      return NextResponse.json({
        collected: 0,
        note: "Azure Graph not connected",
        diagnosis: {
          graphEventsReturned: 0,
          stored: 0,
          dropped: {
            cancelled: 0,
            shortSubject: 0,
            fewAttendees: 0,
            noiseSubject: 0,
            tooShort: 0,
            outOfOffice: 0,
            notOrganizerOrRecurring: 0,
            outsideDateRange: 0,
          },
        },
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: employee } = await supabase
      .from("employees")
      .select("email, aad_object_id")
      .eq("employee_id", employeeId)
      .single();

    if (!employee?.email) {
      console.warn("[calendar-collector] No email found for employee", employeeId);
      return NextResponse.json({
        collected: 0,
        diagnosis: {
          graphEventsReturned: 0,
          stored: 0,
          dropped: {
            cancelled: 0,
            shortSubject: 0,
            fewAttendees: 0,
            noiseSubject: 0,
            tooShort: 0,
            outOfOffice: 0,
            notOrganizerOrRecurring: 0,
            outsideDateRange: 0,
          },
        },
      });
    }

    const userId = employee.aad_object_id ?? employee.email;

    const startDate = reviewStart ?? new Date().toISOString().slice(0, 10);
    const endDate = reviewEnd ?? startDate;

    const filter =
      `start/dateTime ge '${startDate}T00:00:00Z' and end/dateTime le '${endDate}T23:59:59Z'`;
    const select = [
      "id",
      "subject",
      "organizer",
      "attendees",
      "start",
      "end",
      "recurrence",
      "isCancelled",
      "type",
    ].join(",");

    let events: Array<{
      id?: string;
      subject?: string;
      organizer?: { emailAddress?: { address?: string } };
      attendees?: unknown[];
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      recurrence?: unknown;
      isCancelled?: boolean;
      type?: string;
    }> = [];

    try {
      const graphRes = await fetch(
        `${GRAPH_BASE}/users/${encodeURIComponent(userId)}/events` +
          `?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ConsistencyLevel: "eventual",
          },
        }
      );
      if (!graphRes.ok) {
        console.error("[calendar-collector] Graph error:", await graphRes.text());
        return NextResponse.json({
          collected: 0,
          error: "Graph API error",
          diagnosis: {
          graphEventsReturned: 0,
          stored: 0,
          dropped: {
            cancelled: 0,
            shortSubject: 0,
            fewAttendees: 0,
            noiseSubject: 0,
            tooShort: 0,
            outOfOffice: 0,
            notOrganizerOrRecurring: 0,
            outsideDateRange: 0,
          },
        },
        });
      }
      const data = (await graphRes.json()) as { value?: typeof events };
      events = data.value ?? [];
    } catch (e) {
      console.error("[calendar-collector] Fetch error:", e);
      return NextResponse.json({
        collected: 0,
        error: "Fetch failed",
        diagnosis: {
          graphEventsReturned: 0,
          stored: 0,
          dropped: {
            cancelled: 0,
            shortSubject: 0,
            fewAttendees: 0,
            noiseSubject: 0,
            tooShort: 0,
            outOfOffice: 0,
            notOrganizerOrRecurring: 0,
            outsideDateRange: 0,
          },
        },
      });
    }

    const rawCount = events.length;
    let dropCancelled = 0;
    let dropSubject = 0;
    let dropAttendees = 0;
    let dropNoise = 0;
    let dropDuration = 0;
    let dropOOO = 0;
    let dropNotOrganizer = 0;
    let dropDateRange = 0;
    let collected = 0;

    for (const event of events) {
      if (event.isCancelled) {
        dropCancelled++;
        continue;
      }
      const subjectTrim = event.subject?.trim() ?? "";
      if (!event.subject || subjectTrim.length <= 5) {
        dropSubject++;
        continue;
      }
      if ((event.attendees?.length ?? 0) <= 2) {
        dropAttendees++;
        continue;
      }

      const subjectLower = event.subject.toLowerCase();
      if (NOISE_SUBJECTS.some((n) => subjectLower.includes(n))) {
        dropNoise++;
        continue;
      }

      const startMs = new Date(event.start?.dateTime ?? 0).getTime();
      const endMs = new Date(event.end?.dateTime ?? 0).getTime();
      const durationMins = (endMs - startMs) / 60_000;
      if (durationMins < 15) {
        dropDuration++;
        continue;
      }

      if (event.type === "singleInstance" && subjectLower.includes("out of office")) {
        dropOOO++;
        continue;
      }

      const organizerEmail = event.organizer?.emailAddress?.address?.toLowerCase();
      const employeeEmail = employee.email.toLowerCase();
      const isOrganizerFallback = (event.attendees as Array<{ type?: string; emailAddress?: { address?: string }; status?: { response?: string } }> | undefined)?.some(
        (a) =>
          a.type === "required" &&
          a.emailAddress?.address?.toLowerCase() === employeeEmail &&
          a.status?.response === "organizer"
      );
      const isOrganizer = organizerEmail === employeeEmail || !!isOrganizerFallback;
      const isRecurring = !!event.recurrence;

      let activityType: string;
      if (isOrganizer) {
        activityType = "meeting_organized";
      } else if (isRecurring) {
        activityType = "meeting_attended";
      } else {
        dropNotOrganizer++;
        continue;
      }

      const weight = EVIDENCE_WEIGHTS[activityType] ?? 10;
      const activityDate = (event.start?.dateTime ?? "").slice(0, 10);

      if (!activityDate || activityDate < startDate || activityDate > endDate) {
        dropDateRange++;
        continue;
      }

      const fingerprint = createHash("md5")
        .update(`calendar:${activityType}:${event.subject}:${activityDate}:${event.id ?? ""}`)
        .digest("hex");

      const { error } = await supabase
        .from("evidence_items")
        .upsert(
          {
            employee_id: employeeId,
            source_system: "calendar",
            activity_type: activityType,
            title: event.subject,
            description: null,
            activity_date: activityDate,
            confidence_weight: weight,
            fingerprint,
          },
          { onConflict: "fingerprint", ignoreDuplicates: true }
        );

      if (!error) collected++;
    }

    console.log(
      `[calendar-collector] raw=${rawCount} | stored=${collected} | dropped: cancelled=${dropCancelled} shortSubject=${dropSubject} fewAttendees=${dropAttendees} noise=${dropNoise} tooShort=${dropDuration} ooo=${dropOOO} notOrganizerOrRecurring=${dropNotOrganizer} outsideRange=${dropDateRange}`
    );

    return NextResponse.json({
      collected,
      diagnosis: {
        graphEventsReturned: rawCount,
        stored: collected,
        dropped: {
          cancelled: dropCancelled,
          shortSubject: dropSubject,
          fewAttendees: dropAttendees,
          noiseSubject: dropNoise,
          tooShort: dropDuration,
          outOfOffice: dropOOO,
          notOrganizerOrRecurring: dropNotOrganizer,
          outsideDateRange: dropDateRange,
        },
      },
    });
  } catch (e) {
    console.error("[evidence/collect/calendar]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
