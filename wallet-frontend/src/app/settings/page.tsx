"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Settings, Save, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle"; // Assuming this exists based on page.tsx
import { authApi } from "@/lib/api"; // We will add changePassword here shortly

// Schema for password change
const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
    const router = useRouter();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
    });

    const changePasswordMutation = useMutation({
        mutationFn: (data: PasswordFormValues) => {
            // We will need to update api.ts to support this, using a temporary any cast or expecting it to be there
            return (authApi as any).changePassword(data.currentPassword, data.newPassword);
        },
        onSuccess: () => {
            toast.success("Password updated successfully");
            reset();
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to update password");
        },
    });

    const onSubmit = (data: PasswordFormValues) => {
        changePasswordMutation.mutate(data);
    };

    return (
        <div className="min-h-screen container max-w-2xl mx-auto py-8 text-foreground">
            <Button
                variant="ghost"
                className="mb-4 -ml-2 hover:bg-transparent hover:text-primary"
                onClick={() => router.push("/")}
            >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
            </Button>

            <div className="flex items-center gap-2 mb-8">
                <Settings className="h-6 w-6" />
                <h1 className="text-3xl font-bold">Settings</h1>
            </div>

            <div className="space-y-6">
                {/* Preferences Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Preferences</CardTitle>
                        <CardDescription>Manage your app preferences</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Theme</Label>
                                <p className="text-sm text-muted-foreground">
                                    Select your preferred theme
                                </p>
                            </div>
                            <ThemeToggle />
                        </div>
                    </CardContent>
                </Card>

                {/* Security Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Security</CardTitle>
                        <CardDescription>Update your password and security settings</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    {...register("currentPassword")}
                                />
                                {errors.currentPassword && (
                                    <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    {...register("newPassword")}
                                />
                                {errors.newPassword && (
                                    <p className="text-sm text-destructive">{errors.newPassword.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    {...register("confirmPassword")}
                                />
                                {errors.confirmPassword && (
                                    <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                                )}
                            </div>
                            <Button type="submit" disabled={changePasswordMutation.isPending}>
                                {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Export Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Export</CardTitle>
                        <CardDescription>Export your wallet data</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Your secret phrase and private keys can be viewed on the dashboard by clicking "Show Secret Phrase".
                        </p>
                        <Button variant="outline" onClick={() => router.push("/")}>
                            Go to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
