import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AdminAuditLogs from "@/pages/AdminAuditLogs";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminCriteria from "@/pages/AdminCriteria";
import AdminEvaluationSets from "@/pages/AdminEvaluationSets";
import AdminTrainings from "@/pages/AdminTrainings";
import AdminUsers from "@/pages/AdminUsers";
import ChangePassword from "@/pages/ChangePassword";
import Login from "@/pages/Login";
import AdminReports from "@/pages/AdminReports";
import AdminDetailedReport from "@/pages/AdminDetailedReport";
import Profile from "@/pages/Profile";
import EvaluatorAssignments from "@/pages/EvaluatorAssignments";
import EvaluatorDashboard from "@/pages/EvaluatorDashboard";
import PdfPreview from "@/pages/PdfPreview";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Login} />
      <Route path={"/login"} component={Login} />
      <Route path={"/change-password"} component={ChangePassword} />
      <Route path={"/admin/dashboard"} component={AdminDashboard} />
      <Route path={"/admin/trainings/new"} component={AdminTrainings} />
      <Route path={"/admin/trainings/:id/edit"} component={AdminTrainings} />
      <Route path={"/admin/trainings/:id"} component={AdminTrainings} />
      <Route path={"/admin/trainings"} component={AdminTrainings} />
      <Route path={"/admin/criteria"} component={AdminCriteria} />
      <Route path={"/admin/evaluation-sets"} component={AdminEvaluationSets} />
      <Route path={"/admin/users"} component={AdminUsers} />
      <Route path={"/admin/reports/detailed"} component={AdminDetailedReport} />
      <Route path={"/admin/reports"} component={AdminReports} />
      <Route path={"/admin/reports/preview"} component={PdfPreview} />
      <Route path={"/admin/audit-logs"} component={AdminAuditLogs} />
      <Route path={"/admin/profile"}>{() => <Profile role="ADMIN" />}</Route>
      <Route path={"/evaluator/dashboard"} component={EvaluatorDashboard} />
      <Route path={"/evaluator/assignments"} component={EvaluatorAssignments} />
      <Route path={"/evaluator/assignments/:id/evaluate"} component={EvaluatorAssignments} />
      <Route path={"/evaluator/profile"}>{() => <Profile role="EVALUATOR" />}</Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
