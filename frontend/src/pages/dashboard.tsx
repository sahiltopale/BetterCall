import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  FileText,
  Database,
  TrendingUp,
  Clock,
  BookmarkPlus,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function Dashboard() {
  const [quickSearch, setQuickSearch] = useState("");

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(quickSearch)}`;
    }
  };

  const stats = [
    {
      title: "Cases Searched",
      value: "1,247",
      change: "+12%",
      icon: Search,
      trend: "up",
    },
    {
      title: "Analyses Run",
      value: "89",
      change: "+8%",
      icon: FileText,
      trend: "up",
    },
    {
      title: "Saved Searches",
      value: "34",
      change: "+3",
      icon: BookmarkPlus,
      trend: "up",
    },
    {
      title: "Time Saved",
      value: "156h",
      change: "+24h",
      icon: Clock,
      trend: "up",
    },
  ];

  const recentSearches = [
    "Supreme Court judgments on contract law",
    "High Court precedents on property disputes",
    "Constitutional law cases 2023",
  ];

  const quickActions = [
    {
      title: "Maharashtra Acts",
      description: "Browse and search Maharashtra acts",
      icon: Search,
      href: "/search",
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      title: "Analyze Judgment",
      description: "Upload and analyze legal documents",
      icon: FileText,
      href: "/analysis",
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    {
      title: "Vector Search",
      description: "Search through Indian laws",
      icon: Database,
      href: "/vector-search",
      color: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your legal research activity.
        </p>
      </div>

      <form onSubmit={handleQuickSearch} className="max-w-2xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Quick search across 130K+ legal documents..."
            className="pl-12 h-12 shadow-lg"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            data-testid="input-quick-search"
          />
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`stat-${stat.title.toLowerCase().replace(/\s+/g, "-")}`}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-primary font-medium">{stat.change}</span> from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {quickActions.map((action) => (
          <Link key={action.title} href={action.href}>
            <Card className="hover-elevate active-elevate-2 cursor-pointer h-full">
              <CardHeader className="gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${action.color}`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg mb-2">{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="w-fit gap-2">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Searches
            </CardTitle>
            <CardDescription>Your latest case searches</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSearches.map((search, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg hover-elevate cursor-pointer"
                data-testid={`recent-search-${index}`}
              >
                <Search className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-sm">{search}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Research Insights
            </CardTitle>
            <CardDescription>Key metrics and trends</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Most searched: Contract Law</span>
                <Badge variant="secondary">42 searches</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Top jurisdiction: Supreme Court</span>
                <Badge variant="secondary">68%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg. analysis time</span>
                <Badge variant="secondary">2.3 min</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
