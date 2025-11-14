import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface AccessDeniedProps {
  showSignOut?: boolean;
}

export const AccessDenied: React.FC<AccessDeniedProps> = (props) => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center bg-slate-50">
      <h1 className="text-4xl font-bold text-red-500 mb-4">Access Denied</h1>
      <p className="text-lg text-slate-600 mb-6">
        You don’t have permission to view this page.
      </p>
      <div className="flex space-x-4">
        <a
          href="/"
          className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
        >
          Go Back Home
        </a>
        {props.showSignOut && (
          <a
            onClick={signOut}
            className="px-6 py-3 bg-primary cursor-pointer text-white rounded-lg hover:bg-primary/90 transition"
          >
            Sign Out
          </a>
        )}
      </div>
    </div>
  );
};
