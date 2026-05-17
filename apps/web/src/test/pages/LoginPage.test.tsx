import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { useAuth } from "@/lib/auth";
import LoginPage from "@/pages/LoginPage";

const API_BASE = "http://localhost:3000";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderLoginPage() {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>
        <ThemeProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/inventory" element={<div data-testid="inventory-probe" />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.setState({ user: null, isAuthenticated: false });
  });

  it("renders the login form with email, password inputs and submit button", async () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows an error message when login fails with 401", async () => {
    server.use(
      http.post(`${API_BASE}/api/auth/sign-in/email`, () => {
        return HttpResponse.json(
          { message: "Invalid email or password" },
          { status: 401 },
        );
      }),
    );

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "bad@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
  });

  it("calls setAuth and navigates to /inventory on successful login", async () => {
    server.use(
      http.post(`${API_BASE}/api/auth/sign-in/email`, () => {
        return HttpResponse.json({
          user: { id: "user-1", email: "test@example.com", name: "Test User" },
          token: "mock-token",
        });
      }),
    );

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId("inventory-probe")).toBeInTheDocument();
    });

    expect(useAuth.getState().isAuthenticated).toBe(true);
    expect(useAuth.getState().user?.email).toBe("test@example.com");
  });
});
