
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { mockStalls, Stall } from "../../data/mockData";
import CurrencyWrapper from "@/components/shared/currency";

const StallConfiguration = () => {
  const [stalls, setStalls] = useState<Stall[]>(mockStalls);
  const [newStall, setNewStall] = useState({
    label: "",
    x: 0,
    y: 0,
    width: 80,
    height: 60,
    price: 100,
    description: ""
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddStall = () => {
    const stall: Stall = {
      id: Date.now().toString(),
      ...newStall,
      isBooked: false
    };
    setStalls([...stalls, stall]);
    setNewStall({
      label: "",
      x: 0,
      y: 0,
      width: 80,
      height: 60,
      price: 100,
      description: ""
    });
    setIsDialogOpen(false);
    toast({
      title: "Stall Added",
      description: `Stall ${stall.label} has been added to the layout`
    });
  };

  const handleDeleteStall = (id: string) => {
    setStalls(stalls.filter(s => s.id !== id));
    toast({
      title: "Stall Deleted",
      description: "Stall has been removed from the layout"
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stall Configuration</h1>
          <p className="text-gray-600 mt-1">Design and manage your marketplace layout</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
              Add New Stall
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Stall</DialogTitle>
              <DialogDescription>
                Configure the details for a new stall in your layout
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="label">Stall Label</Label>
                  <Input
                    id="label"
                    value={newStall.label}
                    onChange={(e) => setNewStall({ ...newStall, label: e.target.value })}
                    placeholder="e.g., A1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price <CurrencyWrapper /></Label>
                  <Input
                    id="price"
                    type="number"
                    value={newStall.price}
                    onChange={(e) => setNewStall({ ...newStall, price: Number(e.target.value) })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="x">X Position</Label>
                  <Input
                    id="x"
                    type="number"
                    value={newStall.x}
                    onChange={(e) => setNewStall({ ...newStall, x: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="y">Y Position</Label>
                  <Input
                    id="y"
                    type="number"
                    value={newStall.y}
                    onChange={(e) => setNewStall({ ...newStall, y: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width">Width</Label>
                  <Input
                    id="width"
                    type="number"
                    value={newStall.width}
                    onChange={(e) => setNewStall({ ...newStall, width: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height</Label>
                  <Input
                    id="height"
                    type="number"
                    value={newStall.height}
                    onChange={(e) => setNewStall({ ...newStall, height: Number(e.target.value) })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newStall.description}
                  onChange={(e) => setNewStall({ ...newStall, description: e.target.value })}
                  placeholder="Describe the stall location and features"
                />
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={handleAddStall} className="flex-1">
                  Add Stall
                </Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Layout Preview */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">🗺️</span>
              Layout Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 rounded-lg p-8">
              <svg width="100%" height="400" viewBox="0 0 500 350">
                {stalls.map((stall) => (
                  <g key={stall.id}>
                    <rect
                      x={stall.x}
                      y={stall.y}
                      width={stall.width}
                      height={stall.height}
                      fill={stall.isBooked ? '#ef4444' : '#22c55e'}
                      stroke="#ffffff"
                      strokeWidth="2"
                      rx="4"
                      className="cursor-pointer hover:opacity-80"
                    />
                    <text
                      x={stall.x + stall.width / 2}
                      y={stall.y + stall.height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="12"
                      fontWeight="bold"
                    >
                      {stall.label}
                    </text>
                    <text
                      x={stall.x + stall.width / 2}
                      y={stall.y + stall.height / 2 + 12}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="8"
                    >
                      <CurrencyWrapper amount={stall.price} />
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </CardContent>
        </Card>

        {/* Stall Configuration Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">📊</span>
              Stall Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stalls.map((stall) => (
                    <TableRow key={stall.id}>
                      <TableCell className="font-medium">{stall.label}</TableCell>
                      <TableCell>
                        <CurrencyWrapper amount={stall.price} />
                        </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          stall.isBooked 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {stall.isBooked ? 'Booked' : 'Available'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStall(stall.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StallConfiguration;
