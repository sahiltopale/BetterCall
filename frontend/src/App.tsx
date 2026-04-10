import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { BackgroundTasksProvider } from "@/contexts/BackgroundTasksContext";
import { BackgroundTasksIndicator } from "@/components/background-tasks-indicator";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Search from "@/pages/search";
import Analysis from "@/pages/analysis";
import CounterArgument from "@/pages/counter-argument";
import LegalDraft from "@/pages/legal-draft";
import VectorSearch from "@/pages/vector-search";
import CaseDetails from "@/pages/case-details";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard">
        <AppLayout>
          <ProtectedRoute component={Dashboard} />
        </AppLayout>
      </Route>
      <Route path="/search">
        <AppLayout>
          <ProtectedRoute component={Search} />
        </AppLayout>
      </Route>
      <Route path="/analysis">
        <AppLayout>
          <ProtectedRoute component={Analysis} />
        </AppLayout>
      </Route>
      <Route path="/counter-argument">
        <AppLayout>
          <ProtectedRoute component={CounterArgument} />
        </AppLayout>
      </Route>
      <Route path="/legal-draft">
        <AppLayout>
          <ProtectedRoute component={LegalDraft} />
        </AppLayout>
      </Route>
      <Route path="/vector-search">
        <AppLayout>
          <ProtectedRoute component={VectorSearch} />
        </AppLayout>
      </Route>
      <Route path="/case/:id">
        <AppLayout>
          <ProtectedRoute component={CaseDetails} />
        </AppLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <BackgroundTasksProvider>
            <TooltipProvider>
              <Router />
              <BackgroundTasksIndicator />
              <Toaster />
            </TooltipProvider>
          </BackgroundTasksProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
