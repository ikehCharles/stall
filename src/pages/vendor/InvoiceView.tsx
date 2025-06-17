
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { mockBookings } from "../../data/mockData";

const InvoiceView = () => {
  const { id } = useParams();
  const booking = mockBookings.find(b => b.id === id);

  if (!booking) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Invoice not found</h2>
        <Button asChild className="mt-4">
          <Link to="/vendor/bookings">Back to Bookings</Link>
        </Button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost">
          <Link to="/vendor/bookings">← Back to Bookings</Link>
        </Button>
        <div className="space-x-2">
          <Button variant="outline" onClick={handlePrint}>
            Print Invoice
          </Button>
          <Button>Download PDF</Button>
        </div>
      </div>

      <Card className="shadow-lg print:shadow-none">
        <CardContent className="p-8">
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                StallBook
              </h1>
              <p className="text-gray-600 mt-1">Marketplace Management Platform</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
              <p className="text-gray-600">#{booking.invoiceNumber}</p>
              <p className="text-gray-600">Date: {new Date(booking.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <Separator className="mb-8" />

          {/* Billing Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold mb-3">Bill To:</h3>
              <div className="space-y-1">
                <p className="font-medium">{booking.vendorName}</p>
                <p className="text-gray-600">vendor@example.com</p>
                <p className="text-gray-600">123 Vendor Street</p>
                <p className="text-gray-600">City, State 12345</p>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">Event Details:</h3>
              <div className="space-y-1">
                <p className="font-medium">{booking.eventName}</p>
                <p className="text-gray-600">Date: {new Date(booking.eventDate).toLocaleDateString()}</p>
                <p className="text-gray-600">Location: Downtown Square</p>
              </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Booking Details:</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">Stall</th>
                    <th className="text-left py-3 px-4 font-medium">Description</th>
                    <th className="text-right py-3 px-4 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.stalls.map(stall => (
                    <tr key={stall.id} className="border-t">
                      <td className="py-3 px-4 font-medium">Stall {stall.label}</td>
                      <td className="py-3 px-4 text-gray-600">{stall.description}</td>
                      <td className="py-3 px-4 text-right">${stall.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="border-t pt-6">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${booking.totalAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (0%):</span>
                  <span>$0.00</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${booking.totalAmount}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Paid:</span>
                  <span>${booking.paidAmount}</span>
                </div>
                {booking.paidAmount < booking.totalAmount && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>Outstanding:</span>
                    <span>${booking.totalAmount - booking.paidAmount}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t text-center text-gray-600">
            <p>Thank you for your business!</p>
            <p className="text-sm mt-2">
              For questions about this invoice, contact us at support@stallbook.com
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceView;
