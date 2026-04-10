import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Brain, AlertTriangle, CheckCircle2, Trophy, BarChart3, Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService, type CasePredictionResult } from "@/lib/apiService";

export default function CasePredict() {
  const [caseDescription, setCaseDescription] = useState("");
  const [caseType, setCaseType] = useState("civil");
  const [jurisdiction, setJurisdiction] = useState("india");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CasePredictionResult | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!caseDescription.trim()) {
      toast({
        title: "Required Field",
        description: "Please provide case description for analysis",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.predictCaseOutcome({
        caseDescription,
        caseType: caseType as any,
        jurisdiction: jurisdiction as any,
      });

      setResult(response);
      toast({
        title: "Analysis Complete",
        description: `Success Probability: ${Math.round(response.successProbability * 100)}%`,
      });
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message || "Unable to analyze case",
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
      description: "Analysis copied successfully",
    });
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 0.7) return "bg-green-100 text-green-900";
    if (probability >= 0.5) return "bg-yellow-100 text-yellow-900";
    return "bg-red-100 text-red-900";
  };

  const getRiskLevel = (risk: number) => {
    if (risk <= 0.3) return { label: "Low", color: "bg-green-100 text-green-900" };
    if (risk <= 0.6) return { label: "Medium", color: "bg-yellow-100 text-yellow-900" };
    return { label: "High", color: "bg-red-100 text-red-900" };
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">CasePredictAI</h1>
        <p className="text-muted-foreground">
          Advanced case outcome predictions with AI analysis, risk assessment, and strategic guidance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case Analysis Input</CardTitle>
          <CardDescription>
            Provide comprehensive case details for AI-powered outcome prediction and strategic analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Case Description</label>
            <Textarea
              placeholder="Describe your case including parties, key facts, legal issues, evidence, arguments, and any other relevant details..."
              value={caseDescription}
              onChange={(e) => setCaseDescription(e.target.value)}
              rows={8}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Case Type</label>
              <Select value={caseType} onValueChange={setCaseType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="civil">Civil</SelectItem>
                  <SelectItem value="criminal">Criminal</SelectItem>
                  <SelectItem value="constitutional">Constitutional</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="family">Family</SelectItem>
                  <SelectItem value="labor">Labor</SelectItem>
                  <SelectItem value="intellectual-property">Intellectual Property</SelectItem>
                  <SelectItem value="administrative">Administrative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Jurisdiction</label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="india">India</SelectItem>
                  <SelectItem value="maharashtra">Maharashtra</SelectItem>
                  <SelectItem value="delhi">Delhi</SelectItem>
                  <SelectItem value="supreme-court">Supreme Court</SelectItem>
                  <SelectItem value="high-court">High Court</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleAnalyze} disabled={!caseDescription.trim() || isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Case...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Predict Case Outcome
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Success Probability Card */}
          <Card className={`border-2 ${getProbabilityColor(result.successProbability)} border-opacity-50`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-5 w-5" />
                    <p className="font-semibold text-lg">Success Probability</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{Math.round(result.successProbability * 100)}%</span>
                    <span className="text-sm text-muted-foreground">probability of favorable outcome</span>
                  </div>
                  <p className="text-sm mt-2">{result.successReasoning}</p>
                </div>
                <BarChart3 className="h-12 w-12 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Overall Assessment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Overall Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed">{result.overallAssessment}</p>
            </CardContent>
          </Card>

          {/* Court Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Court Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Judicial Patterns</p>
                <p className="text-sm text-muted-foreground">{result.courtAnalysis.judicialPatterns}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Precedent Alignment</p>
                <p className="text-sm text-muted-foreground">{result.courtAnalysis.precedentAlignment}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Case Strength</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${result.courtAnalysis.caseStrength * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{Math.round(result.courtAnalysis.caseStrength * 100)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Evidence Assessment */}
          <Card>
            <CardHeader>
              <CardTitle>Evidence Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.evidenceAssessment.map((evidence, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                  <div className="flex-shrink-0 mt-1">
                    {evidence.strength >= 0.7 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : evidence.strength >= 0.4 ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{evidence.type}</p>
                    <p className="text-sm text-muted-foreground">{evidence.analysis}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-orange-500 h-1.5 rounded-full" 
                          style={{ width: `${evidence.strength * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium">{Math.round(evidence.strength * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Strategic Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Strategic Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 list-decimal list-inside">
                {result.strategicRecommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm">
                    <span className="font-medium">{rec.action}</span>
                    <p className="text-xs text-muted-foreground ml-5 mt-0.5">{rec.reasoning}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Financial Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Badge className={getRiskLevel(result.riskAssessment.financialRisk).color}>
                    {getRiskLevel(result.riskAssessment.financialRisk).label}
                  </Badge>
                  <span className="text-2xl font-bold">{Math.round(result.riskAssessment.financialRisk * 100)}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{result.riskAssessment.financialRiskDetails}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Procedural Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Badge className={getRiskLevel(result.riskAssessment.proceduralRisk).color}>
                    {getRiskLevel(result.riskAssessment.proceduralRisk).label}
                  </Badge>
                  <span className="text-2xl font-bold">{Math.round(result.riskAssessment.proceduralRisk * 100)}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{result.riskAssessment.proceduralRiskDetails}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Litigation Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Badge className={getRiskLevel(result.riskAssessment.litigationRisk).color}>
                    {getRiskLevel(result.riskAssessment.litigationRisk).label}
                  </Badge>
                  <span className="text-2xl font-bold">{Math.round(result.riskAssessment.litigationRisk * 100)}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{result.riskAssessment.litigationRiskDetails}</p>
              </CardContent>
            </Card>
          </div>

          {/* Precedent Analysis */}
          {result.precedentAnalysis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Relevant Precedents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.precedentAnalysis.map((precedent, idx) => (
                    <div key={idx} className="border-l-2 border-primary pl-4 pb-2">
                      <p className="font-medium text-sm">{precedent.caseTitle}</p>
                      <p className="text-xs text-muted-foreground">{precedent.citation}</p>
                      <p className="text-sm mt-1">{precedent.applicability}</p>
                      <Badge className="mt-2" variant="outline">{precedent.relevanceScore}% relevant</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Key Strengths and Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-base text-green-900">Key Strengths</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.keyStrengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-base text-red-900">Key Weaknesses</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.keyWeaknesses.map((weakness, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{weakness}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Time and Cost Estimates */}
          <Card>
            <CardHeader>
              <CardTitle>Time & Cost Estimates</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-2">Estimated Duration</p>
                <p className="text-lg font-semibold">{result.estimatedDuration}</p>
                <p className="text-xs text-muted-foreground mt-1">Based on case complexity and judicial workload</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Estimated Legal Costs</p>
                <p className="text-lg font-semibold">{result.estimatedCosts}</p>
                <p className="text-xs text-muted-foreground mt-1">Includes lawyer fees and court expenses</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const fullAnalysis = `CasePredictAI Analysis Report
Success Probability: ${Math.round(result.successProbability * 100)}%

${result.overallAssessment}

Key Strengths:
${result.keyStrengths.map(s => `- ${s}`).join('\n')}

Key Weaknesses:
${result.keyWeaknesses.map(w => `- ${w}`).join('\n')}

Strategic Recommendations:
${result.strategicRecommendations.map((r, i) => `${i + 1}. ${r.action}: ${r.reasoning}`).join('\n')}`;
                copyToClipboard(fullAnalysis);
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setCaseDescription("");
              }}
            >
              New Analysis
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
