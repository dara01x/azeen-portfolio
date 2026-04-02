import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import PropertiesList from "./pages/PropertiesList";
import PropertyDetail from "./pages/PropertyDetail";
import PropertyForm from "./pages/PropertyForm";
import ProjectsList from "./pages/ProjectsList";
import ProjectForm from "./pages/ProjectForm";
import UnitsList from "./pages/UnitsList";
import UnitForm from "./pages/UnitForm";
import ClientsList from "./pages/ClientsList";
import ClientForm from "./pages/ClientForm";
import UsersList from "./pages/UsersList";
import UserForm from "./pages/UserForm";
import AppVariables from "./pages/AppVariables";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/properties" element={<PropertiesList />} />
            <Route path="/properties/new" element={<PropertyForm />} />
            <Route path="/properties/:id" element={<PropertyDetail />} />
            <Route path="/properties/:id/edit" element={<PropertyForm />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/projects/new" element={<ProjectForm />} />
            <Route path="/projects/:id/edit" element={<ProjectForm />} />
            <Route path="/units" element={<UnitsList />} />
            <Route path="/units/new" element={<UnitForm />} />
            <Route path="/units/:id/edit" element={<UnitForm />} />
            <Route path="/clients" element={<ClientsList />} />
            <Route path="/clients/new" element={<ClientForm />} />
            <Route path="/clients/:id/edit" element={<ClientForm />} />
            <Route path="/users" element={<UsersList />} />
            <Route path="/users/new" element={<UserForm />} />
            <Route path="/users/:id/edit" element={<UserForm />} />
            <Route path="/app-variables" element={<AppVariables />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
