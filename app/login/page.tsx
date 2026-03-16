"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Employee Performance Appraisal</CardTitle>
          <CardDescription>
            Sign in with your work account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === "CredentialsSignin" && (
            <p className="text-center text-sm text-destructive">
              Sign in failed. Please try again.
            </p>
          )}
          {error && error !== "CredentialsSignin" && (
            <p className="text-center text-sm text-muted-foreground">
              An error occurred. Please try again.
            </p>
          )}
          <Button
            className="w-full"
            size="lg"
            onClick={() => signIn("azure-ad", { callbackUrl })}
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 21 21"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Sign in with Microsoft
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Uses your organization&apos;s Azure AD (Entra ID) account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
