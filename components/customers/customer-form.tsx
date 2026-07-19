"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCustomerSchema, type CreateCustomerInput } from "@/lib/validation/customer.schema";
import { useCreateCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import type { Customer } from "@prisma/client";

interface CustomerFormProps {
  customer?: Customer;
  onSuccess?: () => void;
}

export function CustomerForm({ customer, onSuccess }: CustomerFormProps) {
  const isEditing = Boolean(customer);
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? "");
  const pending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: customer
      ? {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          addressLine1: customer.addressLine1 ?? "",
          city: customer.city ?? "",
          state: customer.state ?? "",
          zip: customer.zip ?? "",
          tags: customer.tags,
        }
      : { tags: [] },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (isEditing) {
      await update.mutateAsync(values);
    } else {
      await create.mutateAsync(values);
    }
    onSuccess?.();
  });

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" error={errors.firstName?.message}>
          <Input {...register("firstName")} placeholder="Jamie" />
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          <Input {...register("lastName")} placeholder="Rivera" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} placeholder="jamie@example.com" />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register("phone")} placeholder="(555) 010-2938" />
        </Field>
      </div>

      <Field label="Address" error={errors.addressLine1?.message}>
        <Input {...register("addressLine1")} placeholder="123 Main St" />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="City" error={errors.city?.message}>
          <Input {...register("city")} />
        </Field>
        <Field label="State" error={errors.state?.message}>
          <Input {...register("state")} />
        </Field>
        <Field label="ZIP" error={errors.zip?.message}>
          <Input {...register("zip")} />
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEditing ? "Save changes" : "Add customer"}
        </Button>
      </div>
    </motion.form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
