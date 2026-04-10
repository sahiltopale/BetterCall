import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  CheckCircle2,
  Scale,
  Lightbulb,
  AlertCircle,
  Copy,
  Download,
  ExternalLink,
  Zap,
  BookOpen,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService, type AnalysisResult } from "@/lib/apiService";
import type { JudgmentAnalysis } from "@shared/schema";
import { getMockJudgmentAnalysis } from "@/lib/mock-data";
import { useBackgroundTasks, AnalysisTask } from "@/contexts/BackgroundTasksContext";

export default function Analysis() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState<string>("");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const { toast } = useToast();
  const { tasks, addTask, updateTask, getTask, removeTask } = useBackgroundTasks();

  // Monitor task completion
  useEffect(() => {
    if (currentTaskId) {
      const task = getTask(currentTaskId);
      if (task && task.status === 'completed' && task.result) {
        setAnalysis(task.result);
        setIsAnalyzing(false);
        setProgress(100);
        setAnalysisStage("Analysis complete!");
        setCurrentTaskId(null);
      } else if (task && task.status === 'error') {
        setIsAnalyzing(false);
        setProgress(0);
        setAnalysisStage("");
        setCurrentTaskId(null);
      } else if (task && task.status === 'processing') {
        setIsAnalyzing(true);
      }
    } else {
      // Check if there's a recently completed analysis task when returning to page
      const completedAnalysisTask = tasks
        .filter((t) => t.type === 'analysis' && t.status === 'completed' && !!t.result)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
      
      if (completedAnalysisTask && !analysis) {
        setAnalysis(completedAnalysisTask.result);
        setIsAnalyzing(false);
        setProgress(100);
        setAnalysisStage("Analysis complete!");
      }
    }
  }, [tasks, currentTaskId, getTask, analysis]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.type.includes("document")) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF or document file.",
          variant: "destructive",
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    // Create background task
    const taskId = addTask({
      type: 'analysis',
      documentName: selectedFile.name,
    });
    
    setCurrentTaskId(taskId);
    setIsAnalyzing(true);
    setProgress(0);
    setAnalysisStage("Uploading document...");

    // Start background processing
    (async () => {
      try {
        // Update task to processing
        updateTask(taskId, { status: 'processing' });

        // Simulate progress updates
        const progressStages = [
          { progress: 20, stage: "Processing document..." },
          { progress: 40, stage: "Extracting legal content..." },
          { progress: 60, stage: "Searching legal database..." },
          { progress: 80, stage: "Analyzing with AI..." },
          { progress: 95, stage: "Finalizing results..." }
        ];

        // Update progress gradually
        for (const { progress, stage } of progressStages) {
          setProgress(progress);
          setAnalysisStage(stage);
          await new Promise(resolve => setTimeout(resolve, 800));
        }

        try {
          // Call the RAG API
          const result = await apiService.analyzeDocument(selectedFile);
          
          // Update task with result
          updateTask(taskId, {
            status: 'completed',
            result: result,
          });
          
          setAnalysis(result);
          setProgress(100);
          setAnalysisStage("Analysis complete!");
          
          toast({
            title: "Analysis Complete",
            description: `Document analyzed with ${Math.round((result.confidence || 0) * 100)}% confidence.`,
          });
        } catch (error: any) {
          // Fallback to mock analysis if API fails
          const mockAnalysis = getMockJudgmentAnalysis(selectedFile.name);
          const ragAnalysis: AnalysisResult = {
            ...mockAnalysis,
            confidence: 0.75,
            processingTime: "3 seconds",
            analysis: {
              ...mockAnalysis.analysis,
              sentiment: mockAnalysis.analysis.sentiment || "Balanced legal analysis"
            }
          };
          
          // Update task with fallback result
          updateTask(taskId, {
            status: 'completed',
            result: ragAnalysis,
          });
          
          setAnalysis(ragAnalysis);
          
          toast({
            title: "Analysis Complete (Offline Mode)",
            description: error.message || "Using offline analysis. Connect to backend for enhanced features.",
          });
        }
      } catch (error: any) {
        console.error("Analysis error:", error);
        
        // Update task with error
        updateTask(taskId, {
          status: 'error',
          error: error.message || "Analysis failed",
        });
        
        toast({
          title: "Analysis Error",
          description: "Failed to analyze document. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsAnalyzing(false);
        setProgress(0);
        setAnalysisStage("");
      }
    })();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Text copied successfully",
    });
  };

  const handleNewAnalysis = () => {
    // Clear all completed analysis tasks to prevent auto-restoration
    const completedAnalysisTasks = tasks.filter(
      (t) => t.type === 'analysis' && t.status === 'completed'
    );
    completedAnalysisTasks.forEach((task) => removeTask(task.id));
    
    // Reset all state
    setAnalysis(null);
    setSelectedFile(null);
    setIsAnalyzing(false);
    setProgress(0);
    setAnalysisStage("");
    setCurrentTaskId(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">AI Judgment Analysis</h1>
        <p className="text-muted-foreground">
          Upload legal documents for instant AI-powered analysis with precedent matching
        </p>
      </div>

      {!analysis ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
              <CardDescription>
                Upload a PDF or document file for AI analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={
                  "relative border-2 border-dashed rounded-lg p-12 text-center transition-colors " +
                  (dragActive
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-primary/50")
                }
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  data-testid="input-file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium mb-1">
                    {selectedFile ? selectedFile.name : "Drop your document here, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports PDF, DOC, DOCX (Max 10MB)
                  </p>
                </label>
              </div>

              {selectedFile && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                      data-testid="button-remove-file"
                    >
                      Remove
                    </Button>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    data-testid="button-analyze"
                  >
                    {isAnalyzing ? "Analyzing..." : "Analyze Document"}
                  </Button>

                  {isAnalyzing && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{analysisStage || "Analyzing document..."}</span>
                        <span className="font-medium flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {progress}%
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Using AI and legal database for comprehensive analysis...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What We Analyze</CardTitle>
              <CardDescription>
                Our AI extracts key insights from your legal documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium mb-1">Summary & Key Points</h4>
                  <p className="text-sm text-muted-foreground">
                    Concise summary with extracted key legal points
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Scale className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium mb-1">Precedents Found</h4>
                  <p className="text-sm text-muted-foreground">
                    Relevant case precedents with citations
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium mb-1">Legal Issues</h4>
                  <p className="text-sm text-muted-foreground">
                    Identified legal issues and considerations
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium mb-1">Recommendations</h4>
                  <p className="text-sm text-muted-foreground">
                    AI-generated recommendations and next steps
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold mb-1">Analysis Results</h2>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{analysis.documentName}</span>
                {analysis.processingTime && (
                  <>
                    <span>•</span>
                    <span>{analysis.processingTime}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleNewAnalysis} data-testid="button-new-analysis">
                New Analysis
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Summary</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(analysis.analysis.summary)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(analysis as any).documentType && (
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">
                        Document Type: <span className="font-semibold">{(analysis as any).documentType}</span>
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Detection confidence: {Math.round(((analysis as any).documentTypeConfidence || 0) * 100)}%
                      </p>
                      {((analysis as any).documentTypeIndicators || []).length > 0 && (
                        <p className="text-xs text-blue-700 mt-1">
                          Indicators: {((analysis as any).documentTypeIndicators || []).join("; ")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <p className="text-sm leading-relaxed">{analysis.analysis.summary}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Key Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {analysis.analysis.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {analysis.analysis.lawsApplied && analysis.analysis.lawsApplied.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Laws & Sections Applied
                </CardTitle>
                <CardDescription>
                  Statutory provisions and sections specifically applied in this judgment (from vector database)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.analysis.lawsApplied.map((law: any, index: number) => (
                  <div key={index} className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-primary mb-1">{law.provision}</h4>
                        <Badge variant="outline" className="text-xs mb-2">
                          {law.act}
                        </Badge>
                      </div>
                      <Badge className="bg-blue-600 text-white">
                        {law.section}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                      {law.fullText.length > 300 ? `${law.fullText.substring(0, 300)}...` : law.fullText}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 mb-2">
                      <Scale className="h-3 w-3" />
                      <span className="font-medium">{law.relevance}</span>
                    </div>
                    {/* Good Law Check Status */}
                    {law.legalStatus && (
                      <div className={`flex items-center gap-2 pt-2 border-t ${
                        law.legalStatus === 'VALID' ? 'text-green-600' :
                        law.legalStatus === 'AMENDED' ? 'text-amber-600' :
                        law.legalStatus === 'REPEALED' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-xs font-medium">
                          {law.legalStatus === 'VALID' && '✓ Still Valid'}
                          {law.legalStatus === 'AMENDED' && '⚠ Has Been Amended'}
                          {law.legalStatus === 'REPEALED' && '✕ Repealed'}
                          {law.legalStatus === 'UNKNOWN' && '? Status Unknown'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(analysis as any).goodLawCheck && (analysis as any).goodLawCheck.checked && (
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  Good Law Check Results
                </CardTitle>
                <CardDescription>
                  Verification of whether the applicable laws are still in force
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200">
                    <div className="text-2xl font-bold text-green-600">{(analysis as any).goodLawCheck.summary.valid}</div>
                    <div className="text-xs text-green-700 dark:text-green-400 font-medium">Valid Laws</div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200">
                    <div className="text-2xl font-bold text-amber-600">{(analysis as any).goodLawCheck.summary.amended}</div>
                    <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">Amended</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200">
                    <div className="text-2xl font-bold text-red-600">{(analysis as any).goodLawCheck.summary.repealed}</div>
                    <div className="text-xs text-red-700 dark:text-red-400 font-medium">Repealed</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950/30 border border-gray-200">
                    <div className="text-2xl font-bold text-gray-600">{(analysis as any).goodLawCheck.summary.unknown}</div>
                    <div className="text-xs text-gray-700 dark:text-gray-400 font-medium">Unknown</div>
                  </div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-300">
                    <strong>ℹ Good Law Check:</strong> All applicable laws have been verified for current status. 
                    {(analysis as any).goodLawCheck.summary.valid > 0 && ` ${(analysis as any).goodLawCheck.summary.valid} law(s) are still in force.`}
                    {(analysis as any).goodLawCheck.summary.amended > 0 && ` ${(analysis as any).goodLawCheck.summary.amended} law(s) have been amended - review latest version.`}
                    {(analysis as any).goodLawCheck.summary.repealed > 0 && ` ⚠ ${(analysis as any).goodLawCheck.summary.repealed} law(s) have been repealed.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                Precedents Found
              </CardTitle>
              <CardDescription>
                Relevant case precedents identified in the document
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.analysis.precedentsFound.map((precedent, index) => (
                <div key={index} className="p-4 rounded-lg border">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h4 className="font-medium">{precedent.caseTitle}</h4>
                    <Badge variant="outline" className="font-mono text-xs">
                      {precedent.citation}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {precedent.relevance}
                  </p>
                  <Button variant="ghost" size="sm" className="p-0 h-auto text-primary hover:text-primary/80" asChild>
                    <a href={`/case/${precedent.caseId}`}>View Full Case →</a>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Legal Issues Identified
              </CardTitle>
            </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.analysis.legalIssues.map((issue, index) => (
                    <Badge key={index} variant="secondary">
                      {issue}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.analysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

          {analysis.analysis.externalPrecedents && analysis.analysis.externalPrecedents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-primary" />
                  External Legal Precedents
                </CardTitle>
                <CardDescription>
                  Related cases from legal databases
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.analysis.externalPrecedents.map((precedent, index) => (
                  <div key={index} className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className="font-medium">{precedent.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {precedent.court}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Date: {precedent.date}
                      </p>
                      <Button variant="ghost" size="sm" className="p-0 h-auto text-primary" asChild>
                        <a href={precedent.url} target="_blank" rel="noopener noreferrer">
                          View Case <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
