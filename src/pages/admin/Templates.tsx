import { useSearchParams } from "react-router-dom";
import { Square, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import StallTemplates from "./StallTemplates";
import EmailTemplates from "./EmailTemplates";

type Tab = "stalls" | "email";

const Templates = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "email" ? "email" : "stalls";
  const setTab = (t: Tab) => setSearchParams(t === "stalls" ? {} : { tab: t }, { replace: true });

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Page header + tab buttons */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage stall designs and email notification templates.
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex items-center rounded-lg border bg-gray-50 p-1">
          <button
            onClick={() => setTab("stalls")}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              tab === "stalls"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Square className="h-4 w-4" />
            Stall Templates
          </button>
          <button
            onClick={() => setTab("email")}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              tab === "email"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Mail className="h-4 w-4" />
            Email Templates
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {tab === "stalls" ? <StallTemplates /> : <EmailTemplates />}
      </div>
    </div>
  );
};

export default Templates;
