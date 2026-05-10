import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { queryKeys } from "@/lib/queryKeys";

type Step = "code" | "signup";

export default function JoinHouseholdPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();

  const [step, setStep] = useState<Step>("code");
  const [inviteCode, setInviteCode] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codeError, setCodeError] = useState("");

  // Validate the invite code and advance to the sign-up step (or join directly if authed)
  const validateMutation = useMutation({
    mutationFn: () => api.validateInviteCode(inviteCode.trim().toUpperCase()),
    onSuccess: async (result) => {
      if (!result.valid) {
        setCodeError("Invalid invite code. Please check and try again.");
        return;
      }
      setHouseholdName(result.householdName ?? "");

      if (isAuthenticated) {
        // Already signed in — join directly
        await api.joinHousehold(inviteCode.trim().toUpperCase());
        void queryClient.invalidateQueries({ queryKey: queryKeys.household.all });
        navigate("/inventory");
      } else {
        setStep("signup");
      }
    },
    onError: () => {
      setCodeError("Could not validate code. Please try again.");
    },
  });

  // Sign up and join in one step
  const signUpMutation = useMutation({
    mutationFn: () => api.register(email.trim(), password, name.trim(), inviteCode.trim().toUpperCase()),
    onSuccess: () => {
      navigate("/inventory");
    },
  });

  // If already signed in and already has a household, show a clear message
  if (isAuthenticated && user?.householdId) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 px-4 py-6 sm:p-4">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Already in a Household</CardTitle>
            <CardDescription className="text-center">
              You already belong to a household. Ask your household admin to remove you first if you want to join a different one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/inventory")}>
              Go to Inventory
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 px-4 py-6 sm:p-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md">
        {step === "code" ? (
          <>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Join a Household</CardTitle>
              <CardDescription className="text-center">
                Enter the invite code from your household member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => { e.preventDefault(); setCodeError(""); validateMutation.mutate(); }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="inviteCode">Invite Code</Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setCodeError(""); }}
                    placeholder="8-character code"
                    maxLength={8}
                    autoCapitalize="characters"
                    autoComplete="off"
                    required
                  />
                </div>
                {codeError && (
                  <p className="text-sm text-destructive">{codeError}</p>
                )}
                <Button type="submit" className="w-full" disabled={validateMutation.isPending}>
                  {validateMutation.isPending ? "Checking…" : "Continue"}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/login")}>
                  Back to Login
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Create Your Account</CardTitle>
              <CardDescription className="text-center">
                You're joining <span className="font-semibold text-foreground">{householdName || "a household"}</span>.
                Create an account to continue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => { e.preventDefault(); signUpMutation.mutate(); }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                {signUpMutation.error && (
                  <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                    {signUpMutation.error instanceof Error
                      ? signUpMutation.error.message
                      : "Sign up failed"}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={signUpMutation.isPending}>
                  {signUpMutation.isPending ? "Creating account…" : "Create Account & Join"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("code")}>
                  ← Back
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="underline text-foreground hover:text-primary"
                    onClick={() => navigate("/login")}
                  >
                    Sign in
                  </button>
                </p>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
