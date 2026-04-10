import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search as SearchIcon,
  Calendar,
  FileText,
  ChevronRight,
  Loader2,
  Building2,
  Scale,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LegalActRecord {
  enactment_date: string;
  act_number: string;
  short_title: string;
  view_url: string;
  state?: string;
}

interface JudgmentRecord {
  title: string;
  judgment_date: string;
  court: string;
  category: string;
  doctype: string;
  doc_source: string;
  doc_id: string;
  view_url: string;
  fragment_url?: string;
  year: string;
}

interface EnrichedAct extends LegalActRecord {
  normalizedTitle: string;
  jurisdiction: "State" | "Central";
  stateName: string;
  derivedSections: string[];
  year: string;
  searchBlob: string;
}

interface EnrichedJudgment extends JudgmentRecord {
  stateName: string;
  jurisdiction: "State" | "Central";
  searchBlob: string;
}

type LegacyJudgmentRecord = {
  case_number?: string;
  title?: string;
  court?: string;
  date?: string;
  excerpt?: string;
  view_url?: string;
};

const SEARCH_CACHE_LIMIT = 80;

const INDIA_STATES_AND_UTS = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const COURT_STATE_ALIASES: Array<{ pattern: RegExp; state: string }> = [
  { pattern: /madras high court/i, state: "Tamil Nadu" },
  { pattern: /bombay high court/i, state: "Maharashtra" },
  { pattern: /orissa high court/i, state: "Odisha" },
  { pattern: /allahabad high court/i, state: "Uttar Pradesh" },
  { pattern: /uttaranchal high court/i, state: "Uttarakhand" },
  { pattern: /punjab-haryana high court/i, state: "Punjab" },
  { pattern: /jaipur|jodhpur/i, state: "Rajasthan" },
  { pattern: /delhi district court/i, state: "Delhi" },
  { pattern: /bangalore district court/i, state: "Karnataka" },
];

function extractStateFromTitle(title: string): string {
  const lower = title.toLowerCase();
  const matched = INDIA_STATES_AND_UTS.find((state) => lower.includes(state.toLowerCase()));
  if (matched) {
    return matched;
  }
  if (/(bombay|mumbai)/i.test(title)) {
    return "Maharashtra";
  }
  return "Central";
}

function inferStateFromCourt(court: string, category: string): string {
  const lowerCourt = court.toLowerCase();
  const lowerCategory = category.toLowerCase();

  for (const alias of COURT_STATE_ALIASES) {
    if (alias.pattern.test(court)) {
      return alias.state;
    }
  }

  const matchedState = INDIA_STATES_AND_UTS.find((state) => lowerCourt.includes(state.toLowerCase()));
  if (matchedState) {
    return matchedState;
  }

  if (lowerCourt.includes("supreme court") || lowerCategory.includes("tribunal")) {
    return "Central";
  }

  return "Central";
}

function tokenizeQuery(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreSearchBlob(searchBlob: string, rawQuery: string, queryTokens: string[]): number {
  if (!queryTokens.length) {
    return 1;
  }

  let score = 0;
  const phrase = rawQuery.trim().toLowerCase();

  if (phrase && searchBlob.includes(phrase)) {
    score += 60;
  }

  for (const token of queryTokens) {
    if (searchBlob.includes(token)) {
      score += token.length >= 6 ? 12 : 8;
    }
  }

  return score;
}

function normalizeLegacyJudgment(record: LegacyJudgmentRecord): JudgmentRecord {
  const dateText = record.date || "";
  const year = dateText.match(/\b(18|19|20)\d{2}\b/)?.[0] || "Unknown";
  const fallbackId =
    record.case_number?.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "") ||
    record.title?.slice(0, 40).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "") ||
    `legacy-${Math.random().toString(36).slice(2, 10)}`;

  return {
    title: record.title || "Untitled Judgment",
    judgment_date: dateText,
    court: record.court || "Unknown Court",
    category: "High Courts",
    doctype: "legacy",
    doc_source: record.court || "Unknown Court",
    doc_id: fallbackId,
    view_url: record.view_url || "#",
    year,
  };
}

function getFromCache<T>(cache: Map<string, T>, key: string): T | undefined {
  const value = cache.get(key);
  if (value !== undefined) {
    cache.delete(key);
    cache.set(key, value);
  }
  return value;
}

function setInCache<T>(cache: Map<string, T>, key: string, value: T): void {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  if (cache.size > SEARCH_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      cache.delete(oldest);
    }
  }
}

export default function Search() {
  const [allActs, setAllActs] = useState<EnrichedAct[]>([]);
  const [allJudgments, setAllJudgments] = useState<EnrichedJudgment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("All States");
  const [contentFilter, setContentFilter] = useState<"all" | "acts" | "sections" | "judgments">("all");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [actNumberExact, setActNumberExact] = useState("");
  const [actsDisplayLimit, setActsDisplayLimit] = useState(120);
  const [judgmentsDisplayLimit, setJudgmentsDisplayLimit] = useState(120);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const actsSearchCacheRef = useRef(new Map<string, EnrichedAct[]>());
  const judgmentsSearchCacheRef = useRef(new Map<string, EnrichedJudgment[]>());
  const { toast } = useToast();
  const deferredSearch = useDeferredValue(activeSearch);

  const enrichAct = (act: LegalActRecord): EnrichedAct => {
    const normalizedTitle = act.short_title.replace(/\s+/g, " ").trim();
    const sourceState = (act.state || "").trim();
    const detectedState = extractStateFromTitle(normalizedTitle);
    const stateName = sourceState || detectedState;

    const jurisdiction: "State" | "Central" = stateName === "Central" ? "Central" : "State";

    const sectionPatterns = [
      /Section\s+\d+[A-Za-z]?/gi,
      /Article\s+\d+[A-Za-z]?/gi,
      /Order\s+[IVXLC]+\s+Rule\s+\d+/gi,
      /Rule\s+\d+/gi,
    ];

    const sections = sectionPatterns
      .flatMap((pattern) => normalizedTitle.match(pattern) || [])
      .map((s) => s.trim());

    const year =
      normalizedTitle.match(/\b(18|19|20)\d{2}\b/)?.[0] ||
      act.enactment_date.match(/\b(18|19|20)\d{2}\b/)?.[0] ||
      "Unknown";

    return {
      ...act,
      normalizedTitle,
      jurisdiction,
      stateName,
      derivedSections: [...new Set(sections)],
      year,
      searchBlob: `${normalizedTitle} ${act.act_number} ${act.enactment_date} ${year} ${jurisdiction} ${stateName} ${sections.join(" ")}`.toLowerCase(),
    };
  };

  const enrichJudgment = (j: JudgmentRecord): EnrichedJudgment => {
    const stateName = inferStateFromCourt(j.court || j.doc_source || "", j.category || "");
    const jurisdiction: "State" | "Central" = stateName === "Central" ? "Central" : "State";

    return {
      ...j,
      stateName,
      jurisdiction,
      searchBlob: `${j.title} ${j.court} ${j.doc_source} ${j.category} ${j.doctype} ${j.judgment_date} ${j.year} ${stateName}`.toLowerCase(),
    };
  };

  const dedupeActs = (acts: EnrichedAct[]): EnrichedAct[] => {
    const byKey = new Map<string, EnrichedAct>();
    for (const act of acts) {
      const key = `${act.normalizedTitle.toLowerCase()}::${act.act_number}`;
      if (!byKey.has(key)) {
        byKey.set(key, act);
      }
    }
    return Array.from(byKey.values());
  };

  const dedupeJudgments = (items: EnrichedJudgment[]): EnrichedJudgment[] => {
    const byKey = new Map<string, EnrichedJudgment>();
    for (const item of items) {
      const key = `${item.doc_id}::${item.doctype}`;
      if (!byKey.has(key)) {
        byKey.set(key, item);
      }
    }
    return Array.from(byKey.values());
  };

  useEffect(() => {
    const urlQuery = new URLSearchParams(window.location.search).get("q");
    if (urlQuery) {
      setSearchQuery(urlQuery);
      setActiveSearch(urlQuery);
    }
  }, []);

  useEffect(() => {
    actsSearchCacheRef.current.clear();
  }, [allActs]);

  useEffect(() => {
    judgmentsSearchCacheRef.current.clear();
  }, [allJudgments]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const loadRequiredJson = async <T,>(path: string, label: string): Promise<T[]> => {
          const response = await fetch(path);
          if (!response.ok) {
            throw new Error(`Unable to load ${label} (${response.status})`);
          }
          const payload = await response.json();
          return Array.isArray(payload) ? (payload as T[]) : [];
        };

        const loadOptionalJson = async <T,>(path: string): Promise<T[]> => {
          const response = await fetch(path);
          if (!response.ok) {
            return [];
          }
          const payload = await response.json();
          return Array.isArray(payload) ? (payload as T[]) : [];
        };

        const [stateActsData, centralActsData, maharashtraActsData, judgmentsData, legacyJudgmentsData] = await Promise.all([
          loadRequiredJson<LegalActRecord>("/acts_all_states.json", "state acts database"),
          loadRequiredJson<LegalActRecord>("/acts_central.json", "central acts database"),
          loadOptionalJson<LegalActRecord>("/acts_maharashtra.json"),
          loadRequiredJson<JudgmentRecord>("/judgments_all_india.json", "judgments database"),
          loadOptionalJson<LegacyJudgmentRecord>("/maharashtra_high_court_cases.json"),
        ]);

        const acts = dedupeActs(
          [...stateActsData, ...centralActsData, ...maharashtraActsData]
            .map(enrichAct)
            .sort((a, b) => a.normalizedTitle.localeCompare(b.normalizedTitle))
        );

        const judgments = dedupeJudgments(
          [...judgmentsData, ...legacyJudgmentsData.map(normalizeLegacyJudgment)]
            .map(enrichJudgment)
            .sort((a, b) => Number(b.year) - Number(a.year) || a.title.localeCompare(b.title))
        );

        setAllActs(acts);
        setAllJudgments(judgments);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load legal datasets";
        setLoadError(message);
        toast({
          title: "Data Load Failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [toast]);

  const filteredActs = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const queryTokens = tokenizeQuery(query);
    const fromYear = Number(yearFrom);
    const toYear = Number(yearTo);
    const exactAct = actNumberExact.trim().toLowerCase();
    const cacheKey = [query, selectedState, contentFilter, yearFrom.trim(), yearTo.trim(), exactAct].join("||");
    const cached = getFromCache(actsSearchCacheRef.current, cacheKey);
    if (cached) {
      return cached;
    }

    const rankedActs: Array<{ item: EnrichedAct; score: number }> = [];

    for (const act of allActs) {
      if (contentFilter === "judgments") {
        continue;
      }

      if (selectedState !== "All States") {
        if (selectedState === "Central" && act.jurisdiction !== "Central") {
          continue;
        }
        if (selectedState !== "Central" && act.stateName !== selectedState) {
          continue;
        }
      }

      if (contentFilter === "sections" && act.derivedSections.length === 0) {
        continue;
      }

      if (Number.isFinite(fromYear) && yearFrom.trim() !== "" && Number(act.year) < fromYear) {
        continue;
      }
      if (Number.isFinite(toYear) && yearTo.trim() !== "" && Number(act.year) > toYear) {
        continue;
      }
      if (exactAct && act.act_number.toLowerCase() !== exactAct) {
        continue;
      }

      const score = scoreSearchBlob(act.searchBlob, query, queryTokens);
      if (queryTokens.length > 0 && score <= 0) {
        continue;
      }

      rankedActs.push({ item: act, score });
    }

    rankedActs.sort((a, b) => b.score - a.score || Number(b.item.year) - Number(a.item.year) || a.item.normalizedTitle.localeCompare(b.item.normalizedTitle));
    const computed = rankedActs.map((entry) => entry.item);
    setInCache(actsSearchCacheRef.current, cacheKey, computed);
    return computed;
  }, [allActs, deferredSearch, selectedState, contentFilter, yearFrom, yearTo, actNumberExact]);

  const filteredJudgments = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const queryTokens = tokenizeQuery(query);
    const fromYear = Number(yearFrom);
    const toYear = Number(yearTo);
    const cacheKey = [query, selectedState, contentFilter, yearFrom.trim(), yearTo.trim()].join("||");
    const cached = getFromCache(judgmentsSearchCacheRef.current, cacheKey);
    if (cached) {
      return cached;
    }

    const rankedJudgments: Array<{ item: EnrichedJudgment; score: number }> = [];

    for (const j of allJudgments) {
      if (contentFilter === "acts" || contentFilter === "sections") {
        continue;
      }

      if (selectedState !== "All States") {
        if (selectedState === "Central" && j.jurisdiction !== "Central") {
          continue;
        }
        if (selectedState !== "Central" && j.stateName !== selectedState) {
          continue;
        }
      }

      if (Number.isFinite(fromYear) && yearFrom.trim() !== "" && Number(j.year) < fromYear) {
        continue;
      }
      if (Number.isFinite(toYear) && yearTo.trim() !== "" && Number(j.year) > toYear) {
        continue;
      }

      const score = scoreSearchBlob(j.searchBlob, query, queryTokens);
      if (queryTokens.length > 0 && score <= 0) {
        continue;
      }

      rankedJudgments.push({ item: j, score });
    }

    rankedJudgments.sort((a, b) => b.score - a.score || Number(b.item.year) - Number(a.item.year) || a.item.title.localeCompare(b.item.title));
    const computed = rankedJudgments.map((entry) => entry.item);
    setInCache(judgmentsSearchCacheRef.current, cacheKey, computed);
    return computed;
  }, [allJudgments, deferredSearch, selectedState, contentFilter, yearFrom, yearTo]);

  const visibleActs = useMemo(() => filteredActs.slice(0, actsDisplayLimit), [filteredActs, actsDisplayLimit]);
  const visibleJudgments = useMemo(
    () => filteredJudgments.slice(0, judgmentsDisplayLimit),
    [filteredJudgments, judgmentsDisplayLimit]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setActsDisplayLimit(120);
    setJudgmentsDisplayLimit(120);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
    setActsDisplayLimit(120);
    setJudgmentsDisplayLimit(120);
  };

  const clearFilters = () => {
    setSelectedState("All States");
    setContentFilter("all");
    setYearFrom("");
    setYearTo("");
    setActNumberExact("");
    setActsDisplayLimit(120);
    setJudgmentsDisplayLimit(120);
  };

  const hasSearch = activeSearch.length > 0;

  const stateActsCount = filteredActs.filter((act) => act.jurisdiction === "State").length;
  const centralActsCount = filteredActs.filter((act) => act.jurisdiction === "Central").length;
  const stateJudgmentCount = filteredJudgments.filter((j) => j.jurisdiction === "State").length;
  const centralJudgmentCount = filteredJudgments.filter((j) => j.jurisdiction === "Central").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Search Acts and Judgments</h1>
        <p className="text-muted-foreground">
          One India Code and IndiaKanoon-style explorer with local filtering by state, year, act number, sections, and judgments.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search acts, sections, courts, or judgment titles..."
                  className="pl-12 h-12"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Button type="submit" size="lg" data-testid="button-search">
                Search
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={clearSearch}>
                Clear
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                data-testid="select-state-filter"
              >
                <option value="All States">All States</option>
                <option value="Central">Central</option>
                {INDIA_STATES_AND_UTS.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>

              <Input
                type="number"
                placeholder="Year from"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                data-testid="input-year-from"
              />

              <Input
                type="number"
                placeholder="Year to"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                data-testid="input-year-to"
              />

              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Exact Act No."
                  value={actNumberExact}
                  onChange={(e) => setActNumberExact(e.target.value)}
                  data-testid="input-act-number-exact"
                />
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Reset
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" size="sm" variant={contentFilter === "all" ? "default" : "outline"} onClick={() => setContentFilter("all")}>All</Button>
              <Button type="button" size="sm" variant={contentFilter === "acts" ? "default" : "outline"} onClick={() => setContentFilter("acts")}>Acts</Button>
              <Button type="button" size="sm" variant={contentFilter === "sections" ? "default" : "outline"} onClick={() => setContentFilter("sections")}>Sections</Button>
              <Button type="button" size="sm" variant={contentFilter === "judgments" ? "default" : "outline"} onClick={() => setContentFilter("judgments")}>Judgments</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading acts and judgments databases...
            </span>
          ) : (
            <>
              Acts: <span className="font-semibold text-foreground">{filteredActs.length.toLocaleString()}</span> ({stateActsCount.toLocaleString()} state, {centralActsCount.toLocaleString()} central) | Judgments: <span className="font-semibold text-foreground">{filteredJudgments.length.toLocaleString()}</span> ({stateJudgmentCount.toLocaleString()} state, {centralJudgmentCount.toLocaleString()} central)
            </>
          )}
        </p>
        {hasSearch && <Badge variant="secondary">Search: {activeSearch}</Badge>}
      </div>

      {!isLoading && loadError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Unable to load legal data</h3>
            <p className="text-muted-foreground">{loadError}</p>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !loadError && visibleActs.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Acts</h2>
          {visibleActs.map((act) => (
            <Card key={`${act.normalizedTitle}-${act.act_number}`} className="hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">Act No. {act.act_number}</Badge>
                      <Badge variant={act.jurisdiction === "State" ? "secondary" : "default"}>{act.jurisdiction}</Badge>
                      <Badge variant="outline">{act.stateName}</Badge>
                      <Badge variant="outline">Year: {act.year}</Badge>
                    </div>
                    <CardTitle className="text-lg">{act.normalizedTitle}</CardTitle>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {act.enactment_date}
                      </div>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {act.jurisdiction === "State" ? "State Law" : "Central Law"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {act.derivedSections.length > 0 ? (
                        act.derivedSections.map((section) => (
                          <Badge key={`${act.act_number}-${section}`} variant="outline">{section}</Badge>
                        ))
                      ) : (
                        <Badge variant="outline">Full Act</Badge>
                      )}
                    </div>
                  </div>
                  <a href={act.view_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">Open<ChevronRight className="h-4 w-4 ml-1" /></Button>
                  </a>
                </div>
              </CardHeader>
            </Card>
          ))}

          {visibleActs.length < filteredActs.length ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setActsDisplayLimit((prev) => prev + 120)}>
                Load More Acts ({(filteredActs.length - visibleActs.length).toLocaleString()} remaining)
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !loadError && visibleJudgments.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Judgments</h2>
          {visibleJudgments.map((j) => (
            <Card key={`${j.doctype}-${j.doc_id}`} className="hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">Doc {j.doc_id}</Badge>
                      <Badge variant={j.jurisdiction === "State" ? "secondary" : "default"}>{j.jurisdiction}</Badge>
                      <Badge variant="outline">{j.stateName}</Badge>
                      <Badge variant="outline">{j.category}</Badge>
                    </div>
                    <CardTitle className="text-lg">{j.title}</CardTitle>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Scale className="h-4 w-4" />
                        {j.court}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {j.judgment_date || j.year}
                      </div>
                    </div>
                  </div>
                  <a href={j.view_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">Open<ChevronRight className="h-4 w-4 ml-1" /></Button>
                  </a>
                </div>
              </CardHeader>
            </Card>
          ))}

          {visibleJudgments.length < filteredJudgments.length ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setJudgmentsDisplayLimit((prev) => prev + 120)}>
                Load More Judgments ({(filteredJudgments.length - visibleJudgments.length).toLocaleString()} remaining)
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !loadError && filteredActs.length === 0 && filteredJudgments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No matching records found</h3>
            <p className="text-muted-foreground">Try a different act title, section, court, judgment title, year, or state.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
