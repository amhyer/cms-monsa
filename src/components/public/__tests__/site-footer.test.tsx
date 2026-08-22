import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<"button">) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

// Store fixture — injected via hoisted factory so the mock factory can reference it.
const h = vi.hoisted(() => ({
  settings: null as Record<string, unknown> | null,
}));

vi.mock("@/store/app", () => ({
  useAppStore: (selector: (s: { settings: Record<string, unknown> | null }) => unknown) =>
    selector({ settings: h.settings }),
}));

import { SiteFooter } from "../site-footer";

beforeEach(() => {
  pushMock.mockClear();
  h.settings = null;
});

// ── Tests ──────────────────────────────────────────────────────────
describe("SiteFooter", () => {
  it("renders with default school name when settings are null", () => {
    render(<SiteFooter />);
    expect(screen.getByText("SD Negeri Unggulan Mongisidi 1")).toBeInTheDocument();
  });

  it("renders school name from settings", () => {
    h.settings = { schoolName: "SMA Negeri 1 Makassar" };
    render(<SiteFooter />);
    expect(screen.getByText("SMA Negeri 1 Makassar")).toBeInTheDocument();
  });

  it("shows NPSN when available in settings", () => {
    h.settings = { npsn: "40313912" };
    render(<SiteFooter />);
    expect(screen.getByText("NPSN 40313912")).toBeInTheDocument();
  });

  it("hides NPSN when not in settings", () => {
    render(<SiteFooter />);
    expect(screen.queryByText(/NPSN/)).not.toBeInTheDocument();
  });

  it("renders address from settings", () => {
    h.settings = { address: "Jl. Sudirman No.1" };
    render(<SiteFooter />);
    expect(screen.getByText("Jl. Sudirman No.1")).toBeInTheDocument();
  });

  it("shows fallback address when not set", () => {
    render(<SiteFooter />);
    // Address, phone, and email all default to "-" — verify at least one exists
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders phone from settings", () => {
    h.settings = { phone: "021-123456" };
    render(<SiteFooter />);
    expect(screen.getByText("021-123456")).toBeInTheDocument();
  });

  it("renders email as mailto link", () => {
    h.settings = { email: "info@school.sch.id" };
    render(<SiteFooter />);
    const emailLink = screen.getByRole("link", { name: "info@school.sch.id" });
    expect(emailLink).toHaveAttribute("href", "mailto:info@school.sch.id");
  });

  it("shows default email when not set", () => {
    render(<SiteFooter />);
    const emailLink = screen.getByRole("link", { name: "-" });
    expect(emailLink).toHaveAttribute("href", "mailto:-");
  });

  it("renders all PUBLIC_NAV quick links", () => {
    render(<SiteFooter />);
    const labels = [
      "Beranda",
      "Profil",
      "Struktur Organisasi",
      "Akademik",
      "Berita",
      "Galeri",
      "Transparansi",
      "Pengaduan",
      "Kontak",
    ];
    for (const label of labels) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("navigates to correct path when a quick link is clicked", () => {
    render(<SiteFooter />);
    fireEvent.click(screen.getByRole("button", { name: "Beranda" }));
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("shows 'Belum ada tautan sosial media' when no social links configured", () => {
    render(<SiteFooter />);
    expect(screen.getByText("Belum ada tautan sosial media.")).toBeInTheDocument();
  });

  it("renders social media links when configured", () => {
    h.settings = {
      facebook: "https://facebook.com/school",
      instagram: "https://instagram.com/school",
    };
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Facebook" })).toHaveAttribute(
      "href",
      "https://facebook.com/school"
    );
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://instagram.com/school"
    );
    // YouTube and TikTok not set — should not render
    expect(screen.queryByRole("link", { name: "YouTube" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "TikTok" })).not.toBeInTheDocument();
  });

  it("renders Portal Admin button", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("button", { name: "Portal Admin" })
    ).toBeInTheDocument();
  });

  it("navigates to /admin-login when Portal Admin is clicked", () => {
    render(<SiteFooter />);
    fireEvent.click(screen.getByRole("button", { name: "Portal Admin" }));
    expect(pushMock).toHaveBeenCalledWith("/admin-login");
  });

  it("renders current year in copyright", () => {
    render(<SiteFooter />);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(String(year)))).toBeInTheDocument();
  });
});
