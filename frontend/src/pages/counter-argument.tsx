import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Scale, Sparkles, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService, type CounterArgumentResult } from "@/lib/apiService";

export default function CounterArgument() {
  const [facts, setFacts] = useState("");
  const [opponentPosition, setOpponentPosition] = useState("");
  const [yourSide, setYourSide] = useState<"respondent" | "petitioner" | "defendant">("respondent");
  const [stage, setStage] = useState<"trial" | "appeal" | "interim">("trial");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CounterArgumentResult | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!facts.trim() || !opponentPosition.trim()) {
      toast({
        title: "Required Fields",
        description: "Please fill in both Case Facts and Opponent Position",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.generateCounterArguments({
        facts,
        opponentPosition,
        yourSide,
        stage,
        enableRetrieval: true,
        maxAuthorities: 8,
      });

      setResult(response);
      toast({
        title: "Generated Successfully",
        description: `Counter argument generated (${response.mode} mode, ${Math.round(response.confidence * 100)}% confidence)`,
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Unable to generate counter arguments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Text copied successfully",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Counter Argument Generator</h1>
        <p className="text-muted-foreground">
          Build opposing viewpoints, rebuttals, and procedural defenses from your case facts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case Input</CardTitle>
          <CardDescription>
            Enter your case facts and the opposing side's position to generate structured counter arguments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Case Facts</label>
            <Textarea
              placeholder="Summarize relevant facts, timeline, and documents..."
              value={facts}
              onChange={(e) => setFacts(e.target.value)}
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Opponent Position</label>
            <Input
              placeholder="Example: Claimant alleges breach and seeks injunction"
              value={opponentPosition}
              onChange={(e) => setOpponentPosition(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Side</label>
              <Select value={yourSide} onValueChange={(val: any) => setYourSide(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petitioner">Petitioner</SelectItem>
                  <SelectItem value="respondent">Respondent</SelectItem>
                  <SelectItem value="defendant">Defendant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Stage</label>
              <Select value={stage} onValueChange={(val: any) => setStage(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notice">Notice</SelectItem>
                  <SelectItem value="interim">Interim</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="appeal">Appeal</SelectItem>
                  <SelectItem value="revision">Revision</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={!facts.trim() || !opponentPosition.trim() || isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Counter Argument
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">{result.summary}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="outline">{result.mode}</Badge>
                    <Badge variant="secondary">{Math.round(result.confidence * 100)}% confidence</Badge>
                    {result.retrievalUsed.ragMatches > 0 && (
                      <Badge variant="outline">{result.retrievalUsed.ragMatches} statutes found</Badge>
                    )}
                    {result.retrievalUsed.precedentMatches > 0 && (
                      <Badge variant="outline">{result.retrievalUsed.precedentMatches} precedents found</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" /> Opposing Viewpoints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {result.opposingViewpoints.map((view, idx) => (
                    <li key={idx} className="flex gap-3 text-sm">
                      <Badge variant="outline" className="font-bold flex-shrink-0">{idx + 1}</Badge>
                      <span>{view}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" /> Rebuttals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {result.rebuttals.map((rebuttal, idx) => (
                    <li key={idx} className="flex gap-3 text-sm">
                      <Badge variant="outline" className="font-bold flex-shrink-0">{idx + 1}</Badge>
                      <span>{rebuttal}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Procedural Defenses</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {result.proceduralDefenses.map((defense, idx) => (
                  <li key={idx} className="flex gap-3 text-sm">
                    <Badge variant="outline" className="font-bold flex-shrink-0">{idx + 1}</Badge>
                    <span>{defense}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {result.authorities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Supporting Authorities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.authorities.map((auth, idx) => (
                    <div key={idx} className="border-l-2 border-primary pl-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{auth.title}</p>
                          {auth.citation && <p className="text-xs text-muted-foreground">{auth.citation}</p>}
                          <p className="text-xs text-muted-foreground">{auth.source}</p>
                          <p className="text-sm mt-1">{auth.proposition}</p>
                          <p className="text-xs text-green-600 mt-1">✓ {auth.relevance}</p>
                        </div>
                        {auth.url && (
                          <Button variant="outline" size="sm" onClick={() => window.open(auth.url, "_blank")}>
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Strategy Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 list-decimal list-inside">
                {result.strategyChecklist.map((item, idx) => (
                  <li key={idx} className="text-sm">
                    {item}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const fullText = `Counter Argument Summary:\n\n${result.summary}\n\nOpposing Viewpoints:\n${result.opposingViewpoints.map((v, i) => `${i + 1}. ${v}`).join("\n")}\n\nRebuttals:\n${result.rebuttals.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\nProcedural Defenses:\n${result.proceduralDefenses.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;
                copyToClipboard(fullText);
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy All
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setFacts("");
                setOpponentPosition("");
              }}
            >
              Clear
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
