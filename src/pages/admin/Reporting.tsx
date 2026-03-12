import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { Receipt, Banknote, ClipboardList } from "lucide-react";

const reportModules = [
  {
    title: "VAT Reporting",
    description: "Manage VAT periods, view ledger entries, and reconcile",
    href: "/admin/reports/vat",
    icon: Receipt,
    permissions: [PERMISSIONS.VAT.VIEW, PERMISSIONS.VAT.MANAGE],
    color: "from-blue-500 to-indigo-500",
    bgColor: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    title: "Cash Reconciliation",
    description: "Review and reconcile cash payments collected by FCA agents",
    href: "/admin/reports/cash",
    icon: Banknote,
    permissions: [PERMISSIONS.PAYMENTS.MANAGE, PERMISSIONS.PAYMENTS.COLLECT],
    color: "from-green-500 to-emerald-500",
    bgColor: "bg-green-50",
    iconColor: "text-green-600",
  },
  {
    title: "Audit Log",
    description: "View the full history of system actions, cancellations, and refund decisions",
    href: "/admin/reports/audit-log",
    icon: ClipboardList,
    permissions: [PERMISSIONS.AUDIT_LOG.VIEW],
    color: "from-purple-500 to-violet-500",
    bgColor: "bg-purple-50",
    iconColor: "text-purple-600",
  },
];

const Reporting = () => {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reporting</h1>
        <p className="text-gray-600 mt-1">
          Access financial reports, VAT tracking, and analytics
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportModules.map((mod) => (
          <PermissionGate key={mod.href} permissions={mod.permissions}>
            <Link to={mod.href} className="group">
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-gray-200 group-hover:border-gray-300">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className={`p-4 rounded-xl ${mod.bgColor} transition-transform duration-200 group-hover:scale-110`}>
                    <mod.icon className={`h-8 w-8 ${mod.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {mod.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </PermissionGate>
        ))}
      </div>
    </div>
  );
};

export default Reporting;
