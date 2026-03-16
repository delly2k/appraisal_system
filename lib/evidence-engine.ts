import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CLUSTER_THRESHOLDS,
  EVIDENCE_WEIGHTS,
  STRONG_SIGNAL_TYPES,
} from "./evidence-weights";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "have",
  "been",
  "will",
  "into",
  "over",
  "our",
  "their",
  "your",
  "its",
  "was",
  "are",
  "has",
  "but",
  "not",
  "they",
  "all",
  "one",
  "can",
  "it",
  "is",
  "in",
  "of",
  "to",
  "a",
  "an",
  "at",
  "be",
  "by",
  "or",
  "as",
  "on",
  "up",
  "do",
  "if",
  "so",
  "no",
  "we",
  "he",
  "she",
  "his",
  "her",
  "pdf",
  "xlsx",
  "docx",
  "pptx",
  "mp4",
  "csv",
  "xls",
  "mp3",
]);

export interface EvidenceItem {
  id: string;
  employee_id: string;
  source_system: string;
  activity_type: string;
  title: string;
  description: string | null;
  activity_date: string;
  reference_url: string | null;
  related_goal_id: string | null;
  confidence_weight: number;
  cluster_id: string | null;
}

export interface QualifyingCluster {
  clusterId: string;
  topic: string;
  score: number;
  items: EvidenceItem[];
}

export interface ClusterDiagnosis {
  itemsInWindow: number;
  rawClusterCount: number;
  qualifyingClusterCount: number;
  disqualified: Array<{
    topic: string;
    itemCount: number;
    score: number;
    reason: "score" | "signals" | "noStrongSignal";
  }>;
}

function tokenize(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function tokensOverlap(a: string[], b: string[]): boolean {
  const kw = new Set(a);
  return b.some((w) => [...kw].some((k) => k.includes(w) || w.includes(k)));
}

function parseDate(s: string): number {
  return new Date(s).getTime();
}

function withinDays(ms1: number, ms2: number, days: number): boolean {
  return Math.abs(ms1 - ms2) <= days * 24 * 60 * 60 * 1000;
}

function hasStrongSignal(items: EvidenceItem[]): boolean {
  return items.some((i) => STRONG_SIGNAL_TYPES.has(i.activity_type));
}

export async function clusterEvidenceItems(
  supabase: SupabaseClient,
  employeeId: string,
  reviewStart: string,
  reviewEnd: string
): Promise<{ clusters: QualifyingCluster[]; diagnosis: ClusterDiagnosis }> {
  const { data: rows } = await supabase
    .from("evidence_items")
    .select("id, employee_id, source_system, activity_type, title, description, activity_date, reference_url, related_goal_id, confidence_weight, cluster_id")
    .eq("employee_id", employeeId)
    .gte("activity_date", reviewStart)
    .lte("activity_date", reviewEnd)
    .is("cluster_id", null);

  const items = (rows ?? []) as EvidenceItem[];
  if (items.length === 0) {
    return {
      clusters: [],
      diagnosis: {
        itemsInWindow: 0,
        rawClusterCount: 0,
        qualifyingClusterCount: 0,
        disqualified: [],
      },
    };
  }

  const tokensByItem = new Map<string, string[]>();
  for (const i of items) {
    tokensByItem.set(i.id, tokenize(i.title));
  }

  const uf = new Map<string, string>();
  for (const i of items) uf.set(i.id, i.id);

  function find(x: string): string {
    const p = uf.get(x)!;
    if (p !== x) uf.set(x, find(p));
    return uf.get(x)!;
  }

  function union(a: string, b: string) {
    uf.set(find(a), find(b));
  }

  const strongTypes = STRONG_SIGNAL_TYPES as ReadonlySet<string>;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const ai = items[i];
      const aj = items[j];
      const withinWindow = withinDays(
        parseDate(ai.activity_date),
        parseDate(aj.activity_date),
        CLUSTER_THRESHOLDS.TIME_WINDOW
      );
      const sharedGoal = !!(ai.related_goal_id && ai.related_goal_id === aj.related_goal_id);
      const sharedKw = tokensOverlap(tokensByItem.get(ai.id) ?? [], tokensByItem.get(aj.id) ?? []);
      const itemIsStrong = strongTypes.has(ai.activity_type);
      const otherIsStrong = strongTypes.has(aj.activity_type);
      const timeAndStrong = withinWindow && (itemIsStrong || otherIsStrong);
      if (sharedGoal || sharedKw || timeAndStrong) union(ai.id, aj.id);
    }
  }

  const groups = new Map<string, EvidenceItem[]>();
  for (const i of items) {
    const root = find(i.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const rawClusters = [...groups.values()];
  const qualifyingRoots = new Set<string>();

  const result: QualifyingCluster[] = [];

  for (const members of rawClusters) {
    if (members.length < CLUSTER_THRESHOLDS.MIN_SIGNALS) continue;
    const score = members.reduce((s, m) => s + (m.confidence_weight ?? 0), 0);
    if (score < CLUSTER_THRESHOLDS.MIN_SCORE) continue;
    if (!hasStrongSignal(members)) continue;

    qualifyingRoots.add(find(members[0]?.id ?? ""));
    const clusterId = crypto.randomUUID();
    const topicWord = (() => {
      const counts = new Map<string, number>();
      for (const m of members) {
        for (const t of tokenize(m.title)) {
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      return sorted[0]?.[0] ?? members[0]?.title ?? "Activity";
    })();

    for (const m of members) {
      await supabase
        .from("evidence_items")
        .update({ cluster_id: clusterId })
        .eq("id", m.id);
    }

    result.push({
      clusterId,
      topic: topicWord,
      score,
      items: members,
    });
  }

  const strongTypesArr = STRONG_SIGNAL_TYPES as ReadonlySet<string>;
  const disqualified = rawClusters
    .filter((c) => !qualifyingRoots.has(find(c[0]?.id ?? "")))
    .map((c) => {
      const score = c.reduce((s, m) => s + (m.confidence_weight ?? 0), 0);
      const hasStrong = c.some((m) => strongTypesArr.has(m.activity_type));
      const reason: "score" | "signals" | "noStrongSignal" = !hasStrong
        ? "noStrongSignal"
        : c.length < CLUSTER_THRESHOLDS.MIN_SIGNALS
          ? "signals"
          : "score";
      return {
        topic: (c[0]?.title?.slice(0, 40) ?? "").trim() || "Activity",
        itemCount: c.length,
        score,
        reason,
      };
    });

  const diagnosis: ClusterDiagnosis = {
    itemsInWindow: items.length,
    rawClusterCount: rawClusters.length,
    qualifyingClusterCount: result.length,
    disqualified,
  };

  console.log(
    `[evidence-engine] itemsInWindow=${items.length} rawClusters=${rawClusters.length} qualifying=${result.length}`
  );
  disqualified.forEach((d) =>
    console.log(`[evidence-engine] DISQUALIFIED "${d.topic}" items=${d.itemCount} score=${d.score} reason=${d.reason}`)
  );

  return { clusters: result, diagnosis };
}
