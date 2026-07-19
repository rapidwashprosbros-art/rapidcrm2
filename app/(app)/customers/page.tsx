"use client";

import { useState } from "react";
import { CustomerTable } from "@/components/customers/customer-table";
import { CustomerForm } from "@/components/customers/customer-form";
import { Button } from "@/components/ui/button";

export default function CustomersPage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Everyone you've ever cleaned for, in one place.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>Add customer</Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <CustomerForm onSuccess={() => setShowForm(false)} />
        </div>
      )}

      <CustomerTable onSelect={setSelectedId} />
    </div>
  );
}
