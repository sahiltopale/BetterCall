import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MaharashtraAct {
  enactment_date: string;
  act_number: string;
  short_title: string;
  view_url: string;
}

interface MaharashtraHighCourtCase {
  case_number: string;
  title: string;
  court: string;
  date: string;
  judges: string[];
  excerpt: string;
  citations: string[];
  verdict: string;
  view_url: string;
}

export default function Search() {
  const [allActs, setAllActs] = useState<MaharashtraAct[]>([]);
  const [allCases, setAllCases] = useState<MaharashtraHighCourtCase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const urlQuery = new URLSearchParams(window.location.search).get("q");
    if (urlQuery) {
      setSearchQuery(urlQuery);
      setActiveSearch(urlQuery);
    }
  }, []);

  useEffect(() => {
    const loadActs = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [actsResponse, casesResponse] = await Promise.all([
          fetch("/acts_maharashtra.json"),
          fetch("/maharashtra_high_court_cases.json"),
        ]);

        if (!actsResponse.ok) {
          throw new Error(`Unable to load Maharashtra acts (${actsResponse.status})`);
        }

        if (!casesResponse.ok) {
          throw new Error(`Unable to load Maharashtra High Court cases (${casesResponse.status})`);
        }

        const [actsData, casesData] = await Promise.all([
          actsResponse.json(),
          casesResponse.json(),
        ]);

        setAllActs(Array.isArray(actsData) ? actsData : []);
        setAllCases(Array.isArray(casesData) ? casesData : []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load Maharashtra acts";
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

    loadActs();
  }, [toast]);

  const filteredActs = useMemo(() => {
    const query = activeSearch.trim().toLowerCase();
    if (!query) {
      return allActs;
    }

    return allActs.filter((act) => {
      return (
        act.short_title.toLowerCase().includes(query) ||
        act.act_number.toLowerCase().includes(query) ||
        act.enactment_date.toLowerCase().includes(query)
      );
    });
  }, [allActs, activeSearch]);

  const filteredCases = useMemo(() => {
    const query = activeSearch.trim().toLowerCase();
    if (!query) {
      return allCases;
    }

    return allCases.filter((caseItem) => {
      return (
        caseItem.case_number.toLowerCase().includes(query) ||
        caseItem.title.toLowerCase().includes(query) ||
        caseItem.court.toLowerCase().includes(query) ||
        caseItem.date.toLowerCase().includes(query) ||
        caseItem.judges.some((judge) => judge.toLowerCase().includes(query)) ||
        caseItem.excerpt.toLowerCase().includes(query) ||
        caseItem.citations.some((citation) => citation.toLowerCase().includes(query)) ||
        caseItem.verdict.toLowerCase().includes(query)
      );
    });
  }, [allCases, activeSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
  };

  const hasSearch = activeSearch.length > 0;

  const highlightedActsCount = hasSearch ? filteredActs.length : allActs.length;
  const highlightedCasesCount = hasSearch ? filteredCases.length : allCases.length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Search Maharashtra Acts</h1>
        <p className="text-muted-foreground">
          Browse Maharashtra Acts and Maharashtra High Court cases in one local search view.
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
                  placeholder="Search by act title, act number, or date..."
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
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Maharashtra legal data...
            </span>
          ) : (
            <>
              Showing <span className="font-semibold text-foreground">{highlightedActsCount.toLocaleString()}</span> acts and <span className="font-semibold text-foreground">{highlightedCasesCount.toLocaleString()}</span> cases
            </>
          )}
        </p>
        {hasSearch && <Badge variant="secondary">Search: {activeSearch}</Badge>}
      </div>

      {!isLoading && loadError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Unable to load acts data</h3>
            <p className="text-muted-foreground">{loadError}</p>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !loadError && (filteredActs.length > 0 || filteredCases.length > 0) ? (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Maharashtra Acts</h2>
              <Badge variant="outline">{filteredActs.length.toLocaleString()} items</Badge>
            </div>
            {filteredActs.length > 0 ? (
              <div className="space-y-4">
                {filteredActs.map((act) => (
                  <Card key={`${act.short_title}-${act.act_number}`} className="hover-elevate">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">
                              Act No. {act.act_number}
                            </Badge>
                            <Badge variant="secondary">Maharashtra</Badge>
                          </div>
                          <CardTitle className="text-lg mb-2">{act.short_title}</CardTitle>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {act.enactment_date}
                            </div>
                          </div>
                        </div>
                        <a href={act.view_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            View Act
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </a>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No Maharashtra Acts match your search.
                </CardContent>
              </Card>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Maharashtra High Court Cases</h2>
              <Badge variant="outline">{filteredCases.length.toLocaleString()} items</Badge>
            </div>
            {filteredCases.length > 0 ? (
              <div className="space-y-4">
                {filteredCases.map((caseItem) => (
                  <Card key={caseItem.case_number} className="hover-elevate">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">
                              {caseItem.case_number}
                            </Badge>
                            <Badge variant="secondary">{caseItem.court}</Badge>
                          </div>
                          <CardTitle className="text-lg mb-2">{caseItem.title}</CardTitle>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {caseItem.date}
                            </div>
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              {caseItem.judges.join(", ")}
                            </div>
                          </div>
                        </div>
                        <a href={caseItem.view_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            View Case
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </a>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm line-clamp-3">{caseItem.excerpt}</p>
                      <div className="flex flex-wrap gap-2">
                        {caseItem.citations.map((citation) => (
                          <Badge key={citation} variant="outline">
                            {citation}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Outcome:</span> {caseItem.verdict}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No Maharashtra High Court cases match your search.
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      ) : null}

      {!isLoading && !loadError && filteredActs.length === 0 && filteredCases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No matching records found</h3>
            <p className="text-muted-foreground">Try a different act title, case title, court, date, or citation.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
